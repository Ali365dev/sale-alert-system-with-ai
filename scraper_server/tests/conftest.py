"""Shared test fixtures.

This app has no test-database infrastructure (no SQLite fallback — see
config.py, DATABASE_URL is required and always points at a real Postgres/
Supabase instance). Tests must never touch that real, shared database, so
every fixture here mocks at a function boundary (job_service, gmail_service,
ai.analyzer, fcm_client) rather than opening a real DB session — see each
test module for exactly what's mocked and why.
"""
from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def mock_session():
    """A MagicMock standing in for a SQLAlchemy Session. Configure
    `.query(...).filter(...).first()` / `.all()` per test as needed — see
    test_email_automation_job.py for examples."""
    return MagicMock()


@pytest.fixture
def mock_get_session(mock_session):
    """A drop-in replacement for database.db.get_session — a context manager
    yielding the same mock_session every time it's called, so a test can
    configure query results once and have every `with get_session() as db:`
    block in the code under test see them."""
    @contextmanager
    def _get_session():
        yield mock_session
    return _get_session
