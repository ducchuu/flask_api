"""Tests for database initialisation and the health endpoint"""
import sqlite3

from backend.db import get_db


EXPECTED_TABLES = {
    "users",
    "interests",
    "items",
    "stories",
    "collections",
    "collection_items",
    "feedback",
    "api_cache",
}


class TestDatabaseInit:
    """All tables should exist as soon as the app starts up."""

    def test_all_tables_created(self, db: sqlite3.Connection) -> None:
        """Every table in the schema should be present after init_db runs."""
        rows = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        tables = {row["name"] for row in rows}
        assert EXPECTED_TABLES.issubset(tables)

    def test_foreign_keys_enforced(self, db: sqlite3.Connection) -> None:
        """SQLite foreign-key enforcement must be on (PRAGMA foreign_keys = 1)."""
        row = db.execute("PRAGMA foreign_keys").fetchone()
        assert row[0] == 1

    def test_second_init_is_idempotent(self, app) -> None:
        """running init_db again shouldn't duplicate or drop anything"""
        with app.app_context():
            from backend.db import init_db
            init_db()  
            db = get_db()
            rows = db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        tables = {row["name"] for row in rows}
        assert EXPECTED_TABLES.issubset(tables)


class TestHealthEndpoint:
    """The /api/health route should always return 200 with a status field."""

    def test_returns_ok(self, client) -> None:
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "ok"

    def test_response_is_json(self, client) -> None:
        resp = client.get("/api/health")
        assert resp.content_type == "application/json"
