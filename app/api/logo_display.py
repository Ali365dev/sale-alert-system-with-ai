"""Shared brand-logo display transform — one source of truth for API validation
and defaults. Dashboard + mobile both render with the same semantics:

  container (square, overflow hidden)
    image sized to FILL * scale of the container, object-fit contain
    translated by (offset_x * size, offset_y * size) from center

Offsets are fractions of the container edge length (0 = centered).
Scale 1 = default fill used by the mobile BrandLogo before transforms existed.
"""

LOGO_SCALE_MIN = 0.5
LOGO_SCALE_MAX = 3.0
LOGO_OFFSET_MIN = -0.5
LOGO_OFFSET_MAX = 0.5
LOGO_SCALE_DEFAULT = 1.0
LOGO_OFFSET_DEFAULT = 0.0
# Fraction of the circular/square mark filled by the image at scale=1.
LOGO_FILL_RATIO = 0.78


def clamp_logo_scale(value) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return LOGO_SCALE_DEFAULT
    return max(LOGO_SCALE_MIN, min(LOGO_SCALE_MAX, v))


def clamp_logo_offset(value) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return LOGO_OFFSET_DEFAULT
    return max(LOGO_OFFSET_MIN, min(LOGO_OFFSET_MAX, v))


def logo_fields_from_brand(b) -> dict:
    return {
        "logo_url": b.logo_url,
        "logo_scale": float(getattr(b, "logo_scale", None) or LOGO_SCALE_DEFAULT),
        "logo_offset_x": float(getattr(b, "logo_offset_x", None) or LOGO_OFFSET_DEFAULT),
        "logo_offset_y": float(getattr(b, "logo_offset_y", None) or LOGO_OFFSET_DEFAULT),
    }


def apply_logo_body(b, body: dict, *, reset: bool = False) -> None:
    """Apply logo URL + transform from a request body onto a Brand row."""
    if reset:
        b.logo_scale = LOGO_SCALE_DEFAULT
        b.logo_offset_x = LOGO_OFFSET_DEFAULT
        b.logo_offset_y = LOGO_OFFSET_DEFAULT
        return
    if "logo_url" in body:
        b.logo_url = (body["logo_url"] or "").strip() or None
    if "logo_scale" in body:
        b.logo_scale = clamp_logo_scale(body["logo_scale"])
    if "logo_offset_x" in body:
        b.logo_offset_x = clamp_logo_offset(body["logo_offset_x"])
    if "logo_offset_y" in body:
        b.logo_offset_y = clamp_logo_offset(body["logo_offset_y"])
