import threading
import time
from concurrent.futures import ThreadPoolExecutor

from ai import ocr


def test_parallel_emails_never_hold_images_at_the_same_time(mocker):
    """email_sync runs 5 emails in parallel; their image batches must queue,
    or every worker's decoded images sit in memory at once (Render OOM)."""
    mocker.patch.object(ocr, "OCR_ENABLED", True)
    mocker.patch.object(ocr, "_get_engine", return_value=object())
    mocker.patch("services.settings_service.get_setting", return_value=5)
    mocker.patch.object(ocr.ocr_cache, "load", return_value={})
    mocker.patch.object(ocr.ocr_cache, "save")

    lock = threading.Lock()
    in_flight: set[str] = set()
    overlaps: list[set[str]] = []

    def fake_process(url, cache):
        email = url.split("/")[2]
        with lock:
            in_flight.add(email)
            if len(in_flight) > 1:
                overlaps.append(set(in_flight))
        time.sleep(0.02)
        with lock:
            in_flight.discard(email)
        return {"url": url, "text": "SALE", "confidence": 0.9, "is_gif": False}

    mocker.patch.object(ocr, "process_image_url", side_effect=fake_process)

    batches = [[f"https://e{i}/img{j}.png" for j in range(3)] for i in range(5)]
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(ocr.run_ocr_for_urls, batches))

    assert overlaps == []
    assert all(r["image_texts"] == ["SALE"] * 3 for r in results)
