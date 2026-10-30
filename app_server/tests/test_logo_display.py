"""Tests for brand logo transform helpers and category CRUD basics."""
from app.api.logo_display import (
    LOGO_SCALE_DEFAULT,
    apply_logo_body,
    clamp_logo_offset,
    clamp_logo_scale,
    logo_fields_from_brand,
)


class _FakeBrand:
    def __init__(self):
        self.logo_url = "https://example.com/logo.png"
        self.logo_scale = 1.0
        self.logo_offset_x = 0.0
        self.logo_offset_y = 0.0


def test_clamp_logo_scale_bounds():
    assert clamp_logo_scale(0.1) == 0.5
    assert clamp_logo_scale(10) == 3.0
    assert clamp_logo_scale("1.5") == 1.5
    assert clamp_logo_scale("nope") == LOGO_SCALE_DEFAULT


def test_clamp_logo_offset_bounds():
    assert clamp_logo_offset(-2) == -0.5
    assert clamp_logo_offset(2) == 0.5
    assert clamp_logo_offset(0.25) == 0.25


def test_apply_logo_body_and_reset():
    b = _FakeBrand()
    apply_logo_body(b, {"logo_scale": 2, "logo_offset_x": 0.2, "logo_offset_y": -0.1})
    assert b.logo_scale == 2
    assert b.logo_offset_x == 0.2
    assert b.logo_offset_y == -0.1
    apply_logo_body(b, {}, reset=True)
    assert b.logo_scale == 1.0
    assert b.logo_offset_x == 0.0
    fields = logo_fields_from_brand(b)
    assert fields["logo_url"] == "https://example.com/logo.png"
    assert fields["logo_scale"] == 1.0
