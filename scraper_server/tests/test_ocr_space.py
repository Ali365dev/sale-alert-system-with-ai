import base64
import os
from io import BytesIO

from PIL import Image

from ai import ocr


def _png(width=200, height=100) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (width, height), "white").save(buf, format="PNG")
    return buf.getvalue()


def _gif(colors) -> bytes:
    frames = [Image.new("RGB", (200, 100), c) for c in colors]
    buf = BytesIO()
    frames[0].save(buf, format="GIF", save_all=True, append_images=frames[1:])
    return buf.getvalue()


def _ocr_reply(mocker, text="FLAT 50% OFF\r\nTODAY ONLY\r\n", status=200, body=None):
    resp = mocker.Mock(status_code=status)
    resp.json.return_value = body if body is not None else {
        "ParsedResults": [{"ParsedText": text, "FileParseExitCode": 1}],
        "OCRExitCode": 1,
        "IsErroredOnProcessing": False,
    }
    return mocker.patch.object(ocr.requests, "post", return_value=resp)


def _sent_image(post) -> Image.Image:
    data_url = post.call_args.kwargs["data"]["base64Image"]
    return Image.open(BytesIO(base64.b64decode(data_url.split(",", 1)[1])))


def _setup(mocker, image_bytes):
    mocker.patch.object(ocr, "OCR_ENABLED", True)
    mocker.patch("services.settings_service.get_active_api_key", return_value="test-key")
    mocker.patch("services.settings_service.get_setting", return_value=5)
    mocker.patch.object(ocr.ocr_cache, "load", return_value={})
    mocker.patch.object(ocr.ocr_cache, "save")
    mocker.patch.object(ocr, "_download_image", return_value=image_bytes)


def test_static_image_text_comes_from_ocr_space(mocker):
    _setup(mocker, _png())
    post = _ocr_reply(mocker)

    result = ocr.run_ocr_for_urls(["https://cdn.example.com/sale.png"])

    assert result["image_texts"] == ["FLAT 50% OFF\nTODAY ONLY"]
    assert post.call_args.kwargs["headers"] == {"apikey": "test-key"}
    assert "test-key" not in post.call_args.args[0]
    assert post.call_args.kwargs["data"]["OCREngine"] == "2"


def test_gif_frames_go_out_as_one_stacked_image(mocker):
    _setup(mocker, _gif(["red", "green", "blue"]))
    post = _ocr_reply(mocker, text="SALE")

    result = ocr.run_ocr_for_urls(["https://cdn.example.com/promo.gif"])

    assert result["gif_texts"] == ["SALE"]
    assert post.call_count == 1
    with _sent_image(post) as sheet:
        assert sheet.height == 300


def test_rate_limit_is_not_cached_so_the_image_is_retried(mocker):
    _setup(mocker, _png())
    _ocr_reply(mocker, status=403, body={"error": "You may only perform this action upto maximum 180 times"})
    cache: dict = {}

    assert ocr.process_image_url("https://cdn.example.com/sale.png", cache, "test-key") is None
    assert cache == {}


def test_no_key_means_no_download_and_no_text(mocker):
    _setup(mocker, _png())
    mocker.patch("services.settings_service.get_active_api_key", return_value=None)
    post = _ocr_reply(mocker)

    result = ocr.run_ocr_for_urls(["https://cdn.example.com/sale.png"])

    assert result == {"image_texts": [], "gif_texts": [], "items": []}
    ocr._download_image.assert_not_called()
    post.assert_not_called()


def test_errored_processing_is_not_cached(mocker):
    _setup(mocker, _png())
    _ocr_reply(mocker, body={"IsErroredOnProcessing": True, "ErrorMessage": ["Timed out waiting for results"]})
    cache: dict = {}

    assert ocr.process_image_url("https://cdn.example.com/sale.png", cache, "test-key") is None
    assert cache == {}


def test_uploads_stay_under_the_free_plan_1mb_cap(mocker):
    noisy = Image.frombytes("RGB", (2400, 2400), os.urandom(2400 * 2400 * 3))
    buf = BytesIO()
    noisy.save(buf, format="PNG")
    _setup(mocker, buf.getvalue())
    post = _ocr_reply(mocker)

    ocr.run_ocr_for_urls(["https://cdn.example.com/huge.png"])

    data_url = post.call_args.kwargs["data"]["base64Image"]
    assert len(base64.b64decode(data_url.split(",", 1)[1])) <= 1024 * 1024
