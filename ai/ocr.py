"""
Email image/GIF OCR pipeline.

Pipeline per email:
  1. Download every image URL (deduped by content hash of the URL, cached
     across runs in cache/ocr_results.json via ai/ocr_cache.py).
  2. Skip tiny images (tracking pixels, icons, logos).
  3. Static images -> OCR directly. Animated GIFs -> sample frames, OCR each,
     merge unique text across frames.
  4. Run per-image OCR concurrently (I/O + CPU bound, but independent).
  5. Merge subject + email body + image OCR + GIF OCR into one document —
     this merged document (not the raw body) is what gets sent to the
     offer-extraction AI. The original `body` column is never touched.

PaddleOCR runs entirely locally (no paid OCR API). If paddleocr/paddlepaddle
aren't installed, or OCR_ENABLED=false, this module degrades to a no-op:
logs one clear warning and returns empty OCR text — the rest of the email
pipeline (AI analysis on subject+body alone) keeps working either way.
"""
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from typing import Optional

import requests

from ai import ocr_cache
from config import (
    OCR_DOWNLOAD_TIMEOUT,
    OCR_ENABLED,
    OCR_GIF_FRAME_STEP,
    OCR_LANG,
    OCR_MAX_DOWNLOAD_BYTES,
    OCR_MAX_GIF_FRAMES,
    OCR_MAX_IMAGES_PER_EMAIL,
    OCR_MAX_WORKERS,
    OCR_MIN_CONFIDENCE,
    OCR_MIN_IMAGE_SIZE,
    logger,
)

_SEP = "-" * 32

_engine = None
_engine_load_failed = False
# A single shared PaddleOCR instance is not guaranteed safe for concurrent
# inference calls from multiple threads. email_sync.py processes several
# emails at once (its own thread pool), each of which can spawn this
# module's own per-image thread pool — so actual .predict() calls are
# serialized here while downloads/decoding above stay concurrent.
_engine_lock = threading.Lock()


def _get_engine():
    """Lazy singleton — PaddleOCR model loading is expensive, do it once per
    process. Returns None (logging once) if the package isn't installed or
    fails to initialize, so callers can degrade gracefully."""
    global _engine, _engine_load_failed
    if _engine is not None:
        return _engine
    if _engine_load_failed:
        return None
    try:
        from paddleocr import PaddleOCR
        # PaddleOCR 3.x API: use_angle_cls/show_log (2.x) were replaced by
        # use_textline_orientation; doc orientation/unwarping are for scanned
        # documents, not needed for email-embedded promo images.
        _engine = PaddleOCR(
            use_textline_orientation=True,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            lang=OCR_LANG,
        )
        logger.info("PaddleOCR engine loaded (lang=%s)", OCR_LANG)
        return _engine
    except Exception as exc:
        _engine_load_failed = True
        logger.warning(
            "OCR disabled — PaddleOCR unavailable (%s). Install paddleocr + paddlepaddle "
            "to enable image/GIF text extraction; email analysis will proceed on subject+body only.",
            exc,
        )
        return None


def _run_ocr_on_array(img_array) -> tuple[str, float]:
    """Run OCR on a numpy image array. Returns (joined_text, avg_confidence).

    PaddleOCR 3.x's .predict() returns one dict-like OCRResult per input
    image, with "rec_texts" (list[str]) and "rec_scores" (list[float])."""
    engine = _get_engine()
    if engine is None:
        return "", 0.0

    lines: list[str] = []
    confidences: list[float] = []
    with _engine_lock:
        # .predict() returns a lazy generator — the actual inference happens
        # while iterating it, so the lock must stay held through the loop.
        for res in engine.predict(img_array):
            texts = res.get("rec_texts") or []
            scores = res.get("rec_scores") or []
            for text, confidence in zip(texts, scores):
                if text and text.strip():
                    lines.append(text.strip())
                    confidences.append(float(confidence))

    joined = "\n".join(lines)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return joined, avg_confidence


def _download_image(url: str) -> Optional[bytes]:
    try:
        resp = requests.get(url, timeout=OCR_DOWNLOAD_TIMEOUT, stream=True)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        if content_type and not content_type.startswith("image/"):
            return None
        data = resp.content
        if len(data) > OCR_MAX_DOWNLOAD_BYTES:
            logger.warning("OCR: skipping image over size cap — %s", url)
            return None
        return data
    except Exception as exc:
        logger.warning("OCR: failed to download image %s: %s", url, exc)
        return None


def _is_gif(data: bytes) -> bool:
    return data[:6] in (b"GIF87a", b"GIF89a")


def _dedupe_lines(text_blocks: list[str]) -> str:
    """Merge multiple OCR text blocks into one, dropping duplicate lines
    (case-insensitive) while preserving first-seen order."""
    seen: set[str] = set()
    out: list[str] = []
    for block in text_blocks:
        for line in block.splitlines():
            line = line.strip()
            if not line:
                continue
            key = line.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(line)
    return "\n".join(out)


def _process_static_image(data: bytes) -> tuple[str, float]:
    from PIL import Image
    import numpy as np

    with Image.open(BytesIO(data)) as img:
        if img.width < OCR_MIN_IMAGE_SIZE or img.height < OCR_MIN_IMAGE_SIZE:
            return "", 0.0  # icon / logo / tracking pixel
        rgb = img.convert("RGB")
        array = np.array(rgb)[:, :, ::-1]  # RGB -> BGR, PaddleOCR's expected channel order

    return _run_ocr_on_array(array)


def _process_gif(data: bytes) -> tuple[str, float]:
    from PIL import Image, ImageSequence
    import numpy as np

    texts: list[str] = []
    confidences: list[float] = []

    with Image.open(BytesIO(data)) as img:
        if img.width < OCR_MIN_IMAGE_SIZE or img.height < OCR_MIN_IMAGE_SIZE:
            return "", 0.0

        # Adapt the sample step to the GIF's actual frame count: a fixed step
        # of e.g. 5 would silently skip every frame of a short (<5-frame)
        # GIF. Never sample coarser than OCR_GIF_FRAME_STEP, but sample
        # finer when needed so short GIFs still get covered.
        n_frames = getattr(img, "n_frames", 1)
        step = max(1, min(OCR_GIF_FRAME_STEP, n_frames // OCR_MAX_GIF_FRAMES or 1))

        frames_done = 0
        for i, frame in enumerate(ImageSequence.Iterator(img)):
            if frames_done >= OCR_MAX_GIF_FRAMES:
                break
            if i % step != 0:
                continue
            array = np.array(frame.convert("RGB"))[:, :, ::-1]
            text, confidence = _run_ocr_on_array(array)
            frames_done += 1
            if text:
                texts.append(text)
                confidences.append(confidence)

    merged_text = _dedupe_lines(texts)
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return merged_text, avg_confidence


def process_image_url(url: str, cache: dict) -> Optional[dict]:
    """Full pipeline for one image URL: cache check -> download -> OCR ->
    cache write. Returns {url, text, confidence, is_gif} or None if there's
    nothing usable (skipped/tiny/failed/low-confidence) — never raises, so
    one bad image never aborts the rest of the batch."""
    cached = ocr_cache.get(url, cache)
    if cached is not None:
        if cached.get("skipped") or not cached.get("text"):
            return None
        return {"url": url, "text": cached["text"], "confidence": cached["confidence"], "is_gif": cached["is_gif"]}

    t_start = time.monotonic()
    try:
        data = _download_image(url)
        if data is None:
            ocr_cache.put(url, cache, text="", confidence=0.0, is_gif=False, skipped=True)
            return None

        is_gif = _is_gif(data)
        text, confidence = (_process_gif(data) if is_gif else _process_static_image(data))
        elapsed = time.monotonic() - t_start

        if not text or confidence < OCR_MIN_CONFIDENCE:
            logger.info("OCR: no usable text — url=%s gif=%s confidence=%.2f (%.2fs)", url, is_gif, confidence, elapsed)
            ocr_cache.put(url, cache, text="", confidence=confidence, is_gif=is_gif, skipped=True)
            return None

        logger.info("OCR: extracted %d chars — url=%s gif=%s confidence=%.2f (%.2fs)", len(text), url, is_gif, confidence, elapsed)
        ocr_cache.put(url, cache, text=text, confidence=confidence, is_gif=is_gif)
        return {"url": url, "text": text, "confidence": confidence, "is_gif": is_gif}
    except Exception as exc:
        logger.warning("OCR: failed for %s (%.2fs): %s", url, time.monotonic() - t_start, exc)
        return None


def run_ocr_for_urls(image_urls: list[str]) -> dict:
    """Concurrently OCR every (deduped) image URL. Returns
    {"image_texts": [...], "gif_texts": [...]} — non-GIF and GIF results
    kept separate for the merged-document format."""
    if not OCR_ENABLED or not image_urls:
        return {"image_texts": [], "gif_texts": []}
    if _get_engine() is None:
        return {"image_texts": [], "gif_texts": []}

    # Dedupe by URL, cap how many images one email can trigger OCR for.
    deduped = list(dict.fromkeys(image_urls))[:OCR_MAX_IMAGES_PER_EMAIL]

    cache = ocr_cache.load()
    image_texts: list[str] = []
    gif_texts: list[str] = []

    t_start = time.monotonic()
    with ThreadPoolExecutor(max_workers=OCR_MAX_WORKERS) as pool:
        futures = {pool.submit(process_image_url, url, cache): url for url in deduped}
        for future in as_completed(futures):
            result = future.result()  # process_image_url never raises
            if result is None:
                continue
            (gif_texts if result["is_gif"] else image_texts).append(result["text"])

    ocr_cache.save(cache)
    logger.info(
        "OCR batch done — %d image(s), %d with text (%.2fs)",
        len(deduped), len(image_texts) + len(gif_texts), time.monotonic() - t_start,
    )
    return {"image_texts": image_texts, "gif_texts": gif_texts}


def merge_email_content(subject: str, body: str, image_texts: list[str], gif_texts: list[str]) -> dict:
    """Build the merged document sent to the AI, plus raw/clean OCR text
    kept separately in the DB for debugging.

    Returns {"merged": str, "ocr_raw": str, "ocr_clean": str}.
    """
    ocr_raw = "\n\n".join([*image_texts, *gif_texts])
    image_clean = _dedupe_lines(image_texts)
    gif_clean = _dedupe_lines(gif_texts)
    ocr_clean = "\n\n".join(t for t in (image_clean, gif_clean) if t)

    merged = (
        f"{_SEP}\nEMAIL SUBJECT\n\n{subject or ''}\n{_SEP}\n\n"
        f"EMAIL BODY\n\n{body or '(empty body)'}\n{_SEP}\n\n"
        f"IMAGE OCR\n\n{image_clean or '(no text found in images)'}\n{_SEP}\n\n"
        f"GIF OCR\n\n{gif_clean or '(no text found in GIFs)'}\n{_SEP}"
    )
    return {"merged": merged, "ocr_raw": ocr_raw, "ocr_clean": ocr_clean}


def extract_and_merge(subject: str, body: str, image_urls: list[str]) -> dict:
    """Top-level entrypoint used by services/jobs/process_pending.py.
    Runs OCR (if enabled/available) over image_urls and returns the merged
    document ready to send to ai.analyzer.analyze_email, plus raw/clean OCR
    text to persist on the Email row for debugging."""
    ocr_result = run_ocr_for_urls(image_urls)
    return merge_email_content(subject, body, ocr_result["image_texts"], ocr_result["gif_texts"])
