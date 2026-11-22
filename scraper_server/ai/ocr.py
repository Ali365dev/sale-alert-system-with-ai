"""
Email image/GIF OCR pipeline.

Pipeline per email:
  1. Download every image URL (deduped by content hash of the URL, cached
     across runs in cache/ocr_results.json via ai/ocr_cache.py).
  2. Skip tiny images (tracking pixels, icons, logos).
  3. Static images -> one OCR.space (free plan) call. Animated GIFs ->
     sample frames, stack them into one image, one call.
  4. Run per-image OCR concurrently (network bound, independent).
  5. Merge subject + email body + image OCR + GIF OCR into one document —
     this merged document (not the raw body) is what gets sent to the
     offer-extraction AI. The original `body` column is never touched.

With no "ocr_space" API key configured, or OCR_ENABLED=false, this module
is a no-op: it logs one warning and returns empty OCR text — the rest of the
email pipeline (AI analysis on subject+body alone) keeps working either way.
"""
import base64
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from typing import Optional

import requests

from ai import ocr_cache
from config import (
    OCR_API_TIMEOUT,
    OCR_DOWNLOAD_TIMEOUT,
    OCR_ENABLED,
    OCR_GIF_FRAME_STEP,
    OCR_MAX_DOWNLOAD_BYTES,
    OCR_MAX_GIF_FRAMES,
    OCR_MAX_IMAGE_WIDTH,
    OCR_MAX_IMAGES_PER_EMAIL,
    OCR_MAX_WORKERS,
    OCR_MIN_CONFIDENCE,
    OCR_MIN_IMAGE_SIZE,
    logger,
)

_SEP = "-" * 32
_OCR_SPACE_URL = "https://api.ocr.space/parse/image"
_OCR_SPACE_PROVIDER = "ocr_space"
# The free plan rejects files over 1 MB.
_MAX_UPLOAD_BYTES = 1024 * 1024
_missing_key_logged = False

# Email open-tracking pixels (ESP beacons, 1x1/spacer GIFs). They carry no
# text, cost a download (some hosts don't even resolve), and — because the
# per-email image cap takes the first N URLs — used to push the real sale
# banner out of OCR for about a third of emails.
_TRACKING_PIXEL_RE = re.compile(
    r"(\b1x1\b|/open(\.aspx)?(\?|/|$)|beacon\.|/beacon|/pixel(\.gif|\.png)?(\?|/|$)"
    r"|/(track|tracking)(/|\?|$)|/o\.gif|(spacer|blank|transparent|clear)\.gif"
    r"|impression\.gif|usermatch)",
    re.IGNORECASE,
)


def is_tracking_pixel(url: str) -> bool:
    return bool(_TRACKING_PIXEL_RE.search(url))


class OcrUnavailable(Exception):
    """OCR.space couldn't be asked (bad key, rate limit, network). Unlike "no text in
    this image", the result must not be cached — the image is retried later."""


def _api_key() -> Optional[str]:
    global _missing_key_logged
    from services.settings_service import get_active_api_key

    key = get_active_api_key(_OCR_SPACE_PROVIDER)
    if key is None and not _missing_key_logged:
        _missing_key_logged = True
        logger.warning(
            "OCR disabled — add an OCR.space key (Settings → API Config → OCR.space). "
            "Emails are analysed on subject+body only until then."
        )
    return key


def _annotate(jpeg_bytes: bytes, api_key: str) -> tuple[str, float]:
    """One OCR.space call (Engine 2 reads banner-style text best). Returns
    (text, confidence) — ("", 0.0) when the image has no text; raises
    OcrUnavailable when OCR.space can't answer. The free plan reports no
    confidence, so text it returns counts as 1.0."""
    try:
        resp = requests.post(
            _OCR_SPACE_URL,
            headers={"apikey": api_key},
            data={
                "base64Image": "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode("ascii"),
                "language": "eng",
                "OCREngine": "2",
                "scale": "true",
            },
            timeout=OCR_API_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise OcrUnavailable(f"OCR.space request failed: {exc}") from exc
    try:
        body = resp.json()
    except ValueError:
        raise OcrUnavailable(f"OCR.space HTTP {resp.status_code}: {resp.text[:300]}")
    if resp.status_code != 200 or not isinstance(body, dict):
        raise OcrUnavailable(f"OCR.space HTTP {resp.status_code}: {str(body)[:300]}")
    if body.get("IsErroredOnProcessing"):
        raise OcrUnavailable(f"OCR.space error: {body.get('ErrorMessage')}")

    parsed = "\n".join(r.get("ParsedText") or "" for r in body.get("ParsedResults") or [])
    text = "\n".join(line.strip() for line in parsed.splitlines() if line.strip())
    return (text, 1.0) if text else ("", 0.0)


def probe_ocr_key(api_key: str) -> None:
    """Raises OcrUnavailable when OCR.space rejects the key (Settings → Test)."""
    from PIL import Image

    _annotate(_jpeg(Image.new("RGB", (64, 64), "white")), api_key)


def _fit_width(img):
    rgb = img.convert("RGB")
    if rgb.width > OCR_MAX_IMAGE_WIDTH:
        rgb = rgb.resize((OCR_MAX_IMAGE_WIDTH, max(1, round(rgb.height * OCR_MAX_IMAGE_WIDTH / rgb.width))))
    return rgb


def _jpeg(img) -> bytes:
    """JPEG under the free plan's 1 MB cap — lower quality first, then smaller."""
    while True:
        for quality in (85, 70, 55):
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=quality)
            if buf.tell() <= _MAX_UPLOAD_BYTES:
                return buf.getvalue()
        img = img.resize((max(1, img.width * 3 // 4), max(1, img.height * 3 // 4)))


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


def _process_static_image(data: bytes, api_key: str) -> tuple[str, float]:
    from PIL import Image

    with Image.open(BytesIO(data)) as img:
        if img.width < OCR_MIN_IMAGE_SIZE or img.height < OCR_MIN_IMAGE_SIZE:
            return "", 0.0  # icon / logo / tracking pixel
        upload = _jpeg(_fit_width(img))
    return _annotate(upload, api_key)


def _process_gif(data: bytes, api_key: str) -> tuple[str, float]:
    """Sample frames, drop repeats, and stack the rest vertically so the whole
    GIF is one OCR.space call (free-plan quota) instead of one per frame."""
    from PIL import Image, ImageSequence

    frames = []
    seen: set[bytes] = set()
    with Image.open(BytesIO(data)) as img:
        if img.width < OCR_MIN_IMAGE_SIZE or img.height < OCR_MIN_IMAGE_SIZE:
            return "", 0.0

        # Adapt the sample step to the GIF's actual frame count: a fixed step
        # of e.g. 5 would silently skip every frame of a short (<5-frame) GIF.
        n_frames = getattr(img, "n_frames", 1)
        step = max(1, min(OCR_GIF_FRAME_STEP, n_frames // OCR_MAX_GIF_FRAMES or 1))
        for i, frame in enumerate(ImageSequence.Iterator(img)):
            if len(frames) >= OCR_MAX_GIF_FRAMES:
                break
            if i % step != 0:
                continue
            rgb = _fit_width(frame)
            fingerprint = rgb.resize((16, 16)).tobytes()
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            frames.append(rgb)

    sheet = Image.new("RGB", (max(f.width for f in frames), sum(f.height for f in frames)), "white")
    top = 0
    for frame in frames:
        sheet.paste(frame, (0, top))
        top += frame.height
    return _annotate(_jpeg(sheet), api_key)


def process_image_url(url: str, cache: dict, api_key: Optional[str] = None) -> Optional[dict]:
    """Full pipeline for one image URL: cache check -> download -> OCR ->
    cache write. Returns {url, text, confidence, is_gif} or None if there's
    nothing usable (skipped/tiny/failed/low-confidence) — never raises, so
    one bad image never aborts the rest of the batch."""
    cached = ocr_cache.get(url, cache)
    if cached is not None:
        if cached.get("skipped") or not cached.get("text"):
            return None
        return {"url": url, "text": cached["text"], "confidence": cached["confidence"], "is_gif": cached["is_gif"]}
    api_key = api_key or _api_key()
    if not OCR_ENABLED or api_key is None:
        return None

    t_start = time.monotonic()
    try:
        data = _download_image(url)
        if data is None:
            ocr_cache.put(url, cache, text="", confidence=0.0, is_gif=False, skipped=True)
            return None

        is_gif = _is_gif(data)
        text, confidence = (_process_gif(data, api_key) if is_gif else _process_static_image(data, api_key))
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
    {"image_texts": [...], "gif_texts": [...], "items": [{url, text, confidence, is_gif}, ...]}.
    `items` keeps URL↔text so the pipeline can pick one sale image."""
    if not OCR_ENABLED or not image_urls:
        return {"image_texts": [], "gif_texts": [], "items": []}
    api_key = _api_key()
    if api_key is None:
        return {"image_texts": [], "gif_texts": [], "items": []}

    # Dedupe by URL, drop tracking pixels, then cap how many images one email
    # can trigger OCR for.
    # Read fresh from Settings each call (see services/settings_service.py's
    # module docstring) so a change in the dashboard applies immediately,
    # falling back to the env-configured default if never set.
    from services.settings_service import get_setting
    max_images = get_setting("ocr_max_images_per_email", default=OCR_MAX_IMAGES_PER_EMAIL)
    deduped = [u for u in dict.fromkeys(image_urls) if not is_tracking_pixel(u)][:max_images]

    cache = ocr_cache.load()
    t_start = time.monotonic()
    with ThreadPoolExecutor(max_workers=OCR_MAX_WORKERS) as pool:
        futures = {pool.submit(process_image_url, url, cache, api_key): url for url in deduped}
        by_url: dict[str, dict] = {}
        for future in as_completed(futures):
            result = future.result()  # process_image_url never raises
            if result is None:
                continue
            by_url[result["url"]] = result
    ocr_cache.save(cache)

    items = [by_url[url] for url in deduped if url in by_url]
    image_texts = [item["text"] for item in items if not item["is_gif"]]
    gif_texts = [item["text"] for item in items if item["is_gif"]]

    logger.info(
        "OCR batch done — %d image(s), %d with text (%.2fs)",
        len(deduped), len(items), time.monotonic() - t_start,
    )
    return {"image_texts": image_texts, "gif_texts": gif_texts, "items": items}


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
    merged = merge_email_content(subject, body, ocr_result["image_texts"], ocr_result["gif_texts"])
    merged["items"] = ocr_result["items"]
    return merged
