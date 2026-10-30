"""Tests for app/api/routers/brand_discovery.py's pure-DB endpoints —
update_discovery (field/social edit + source-label diffing) and
save_discovery (create/merge/duplicate-name-conflict). start_discovery and
search_candidates are thin wrappers over job creation / the free-search
service, exercised via live manual verification instead (see this session's
notes) rather than mocked here."""
import json
import types

from app.api.routers.brand_discovery import save_discovery, update_discovery


def _row(**overrides):
    defaults = dict(
        id=1, mode="scan_website", query="https://acme.com", status="review", job_id=1, brand_request_id=None,
        name="Acme", website="https://acme.com", logo_url=None, description=None,
        category="Fashion", subcategory="Footwear", country=None,
        field_sources=json.dumps({"name": "website_metadata"}),
        social_links=json.dumps({"facebook": {"url": "https://facebook.com/acme", "source": "home", "verified": False}}),
        confidence=0.8, duplicate_brand_id=None, duplicate_score=None, duplicate_reason=None, error=None,
        resolved_brand_id=None, resolved_at=None, created_at=None, updated_at=None,
    )
    defaults.update(overrides)
    return types.SimpleNamespace(**defaults)


def test_update_discovery_flips_source_to_manual_entry_on_changed_field(mocker, mock_get_session, mock_session):
    row = _row()
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = row

    result = update_discovery(1, {"name": "Acme Corp"})

    assert row.name == "Acme Corp"
    assert result["field_sources"]["name"] == "manual_entry"


def test_update_discovery_keeps_source_when_value_unchanged(mocker, mock_get_session, mock_session):
    row = _row()
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = row

    result = update_discovery(1, {"name": "Acme"})  # same value as stored

    assert result["field_sources"]["name"] == "website_metadata"


def test_update_discovery_not_found_returns_404(mocker, mock_get_session, mock_session):
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = None

    response = update_discovery(999, {"name": "X"})
    assert response.status_code == 404


def test_update_discovery_social_link_edit_becomes_manual_entry(mocker, mock_get_session, mock_session):
    row = _row()
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = row

    result = update_discovery(1, {"social_links": {"facebook": {"url": "https://facebook.com/different-acme"}}})

    assert result["social_links"]["facebook"] == {
        "url": "https://facebook.com/different-acme", "source": "manual_entry", "verified": False,
    }


def test_update_discovery_social_link_verified_toggle_keeps_source_when_url_unchanged(mocker, mock_get_session, mock_session):
    row = _row()
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = row

    result = update_discovery(1, {"social_links": {"facebook": {"url": "https://facebook.com/acme", "verified": True}}})

    assert result["social_links"]["facebook"] == {
        "url": "https://facebook.com/acme", "source": "home", "verified": True,
    }


def test_update_discovery_can_add_a_brand_new_manual_social_platform(mocker, mock_get_session, mock_session):
    row = _row(social_links=json.dumps({}))
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = row

    result = update_discovery(1, {"social_links": {"tiktok": {"url": "https://tiktok.com/@acme"}}})

    assert result["social_links"]["tiktok"]["source"] == "manual_entry"


def test_save_discovery_create_builds_new_brand(mocker, mock_get_session, mock_session):
    row = _row()

    def query_side_effect(model):
        q = mocker.Mock()
        if "BrandDiscovery" in str(model):
            q.filter.return_value.first.return_value = row
        else:  # Brand — no existing brand with this name
            q.filter.return_value.first.return_value = None
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)

    def add_side_effect(brand):
        brand.id = 123  # simulates the id SQLAlchemy assigns on the flush() right after
    mock_session.add.side_effect = add_side_effect

    result = save_discovery(1, {"action": "create"})

    assert result == {"brand_id": 123, "brand_name": "Acme"}
    assert row.status == "saved"
    assert row.resolved_brand_id == 123


def test_save_discovery_marks_linked_brand_request_as_added(mocker, mock_get_session, mock_session):
    row = _row(brand_request_id=42)
    brand_request = types.SimpleNamespace(id=42, status="pending", resolved_at=None)

    def query_side_effect(model):
        q = mocker.Mock()
        if "BrandDiscovery" in str(model):
            q.filter.return_value.first.return_value = row
        elif "BrandRequest" in str(model):
            q.filter.return_value.first.return_value = brand_request
        else:  # Brand — no existing brand with this name
            q.filter.return_value.first.return_value = None
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.add.side_effect = lambda brand: setattr(brand, "id", 123)

    save_discovery(1, {"action": "create"})

    assert brand_request.status == "added"
    assert brand_request.resolved_at is not None


def test_save_discovery_create_rejects_when_name_already_taken(mocker, mock_get_session, mock_session):
    row = _row()
    existing_brand = types.SimpleNamespace(id=999, name="Acme")

    def query_side_effect(model):
        q = mocker.Mock()
        if "BrandDiscovery" in str(model):
            q.filter.return_value.first.return_value = row
        else:
            q.filter.return_value.first.return_value = existing_brand
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)

    response = save_discovery(1, {"action": "create"})
    assert response.status_code == 409


def test_save_discovery_merge_fills_only_empty_fields_on_existing_brand(mocker, mock_get_session, mock_session):
    row = _row(description="A cool brand.")
    target_brand = types.SimpleNamespace(
        id=42, name="Acme Inc", website="https://existing-acme.com",  # already has a website — must NOT be overwritten
        logo_url=None, description=None, country=None, categories=None, social_links=None,
    )

    def query_side_effect(model):
        q = mocker.Mock()
        if "BrandDiscovery" in str(model):
            q.filter.return_value.first.return_value = row
        else:
            q.filter.return_value.first.return_value = target_brand
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)

    result = save_discovery(1, {"action": "merge", "target_brand_id": 42})

    assert result == {"brand_id": 42, "brand_name": "Acme Inc"}
    assert target_brand.website == "https://existing-acme.com"  # untouched
    assert target_brand.description == "A cool brand."  # filled in since it was empty
    assert json.loads(target_brand.social_links)["facebook"] == "https://facebook.com/acme"


def test_save_discovery_merge_requires_target_brand_id(mocker, mock_get_session, mock_session):
    row = _row()
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = row

    response = save_discovery(1, {"action": "merge"})
    assert response.status_code == 400


def test_save_discovery_requires_a_name(mocker, mock_get_session, mock_session):
    row = _row(name=None)
    mocker.patch("app.api.routers.brand_discovery.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = row

    response = save_discovery(1, {"action": "create"})
    assert response.status_code == 400
