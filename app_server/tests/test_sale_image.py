from ai.sale_image import select_sale_image


def test_picks_the_single_image_with_sale_text(mocker):
    mocker.patch("services.settings_service.get_setting", side_effect=lambda key, default=None: default)
    url = select_sale_image([
        {"url": "https://cdn.example/logo.png", "text": "Nike", "confidence": 0.99},
        {"url": "https://cdn.example/banner.png", "text": "50% OFF everything this weekend", "confidence": 0.8},
        {"url": "https://cdn.example/footer.png", "text": "Unsubscribe", "confidence": 0.9},
    ])
    assert url == "https://cdn.example/banner.png"


def test_returns_none_when_no_image_has_sale_text(mocker):
    mocker.patch("services.settings_service.get_setting", side_effect=lambda key, default=None: default)
    assert select_sale_image([
        {"url": "https://cdn.example/logo.png", "text": "Brand logo", "confidence": 0.9},
        {"url": "https://cdn.example/pixel.png", "text": "", "confidence": 0.1},
    ]) is None


def test_returns_none_for_empty_or_missing_items():
    assert select_sale_image(None) is None
    assert select_sale_image([]) is None


def test_tie_break_prefers_higher_ocr_confidence(mocker):
    mocker.patch("services.settings_service.get_setting", side_effect=lambda key, default=None: default)
    url = select_sale_image([
        {"url": "https://cdn.example/a.png", "text": "50% off", "confidence": 0.4},
        {"url": "https://cdn.example/b.png", "text": "50% off", "confidence": 0.95},
    ])
    assert url == "https://cdn.example/b.png"
