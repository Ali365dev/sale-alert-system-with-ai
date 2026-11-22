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


def test_tracking_pixels_are_recognised():
    from ai.ocr import is_tracking_pixel

    for url in (
        "https://beacon.krxd.net/1x1_ad_impression.gif?confid=x",
        "https://click.emails.skechers.com/open.aspx?VX6W&d=100227",
        "https://www.pinterest.com/email/open/?pd=abc",
        "https://fossil-cdn.bloomreach.co/fossil-new/e/CgxqQq-GHAZ/open",
        "http://mi.levi.com/p/cp/8283f0c7bc5fd81c/o.gif?mi_u=1",
        "http://braze-images.com/spacer.gif",
        "http://s.sapphireonline.pk/p/be/op/sFt648XC44CbaXfPpRHl3zHha3KNq3",
        "https://p.dengage.com/p/be/op/UdFhqLw7tVV40cj8AkhPwISp2X8sYDScvuozrZnS2BWuJ.gif",
    ):
        assert is_tracking_pixel(url), url
    for url in (
        "https://brxcdn.com/fos-app-storage/241672fe/media/original/5cbd9918",
        "https://hs-45403856.f.hubspotemail.net/hub/45403856/hubfs/GIFr2.gif?width=1120",
        "https://cdn.shop.com/images/tracksuit-sale-banner.jpg",
        "https://cdn.shop.com/opening-sale.png",
    ):
        assert not is_tracking_pixel(url), url


def _img(url, width, height, text=""):
    return {"url": url, "text": text, "confidence": 0.9 if text else 0.0, "width": width, "height": height}


def test_falls_back_to_the_biggest_banner_shaped_image(mocker):
    mocker.patch("services.settings_service.get_setting", side_effect=lambda key, default=None: default)
    images = [
        _img("https://cdn.example/logo.png", 180, 60, "Sapphire"),
        _img("https://cdn.example/divider.png", 1200, 40),
        _img("https://cdn.example/look-1.jpg", 600, 800),
        _img("https://cdn.example/hero.gif", 1200, 900),
        _img("https://cdn.example/full-email.jpg", 600, 5000),
    ]
    items = [i for i in images if i["text"]]
    assert select_sale_image(items, images) == "https://cdn.example/hero.gif"


def test_sale_image_still_wins_over_a_bigger_one(mocker):
    mocker.patch("services.settings_service.get_setting", side_effect=lambda key, default=None: default)
    images = [
        _img("https://cdn.example/hero.jpg", 1600, 1200),
        _img("https://cdn.example/banner.png", 600, 300, "FLAT 50% OFF"),
    ]
    assert select_sale_image([images[1]], images) == "https://cdn.example/banner.png"


def test_no_fallback_when_every_image_is_small(mocker):
    mocker.patch("services.settings_service.get_setting", side_effect=lambda key, default=None: default)
    assert select_sale_image([], [_img("https://cdn.example/icon.png", 120, 120)]) is None
