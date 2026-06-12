"""Shared pytest fixtures for the Pulse backend test suite."""
import os
import sqlite3
import tempfile

import pytest

from backend.app import create_app
from backend.auth import generate_token


@pytest.fixture()
def app():
    """Spin up a test app backed by a real (but temporary) SQLite file.

    Using a file rather than :memory: means separate connections in the same
    test all see each other's committed writes - which is how routes actually
    work in practice.
    """
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    app = create_app({"TESTING": True, "DATABASE": db_path})
    yield app
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture()
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture()
def db(app):
    """Direct SQLite connection to the test database, for seeding data."""
    conn = sqlite3.connect(app.config["DATABASE"])
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    yield conn
    conn.close()


def make_user(db: sqlite3.Connection, username: str = "testuser") -> int:
    """Insert a bare-minimum user row and return the new id."""
    db.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        [username, "fakehash"],
    )
    db.commit()
    return db.execute(
        "SELECT id FROM users WHERE username = ?", [username]
    ).fetchone()["id"]


def auth_headers(app, user_id: int) -> dict[str, str]:
    """Build an Authorization header carrying a valid token for the given user.

    Lets API tests authenticate without going through a login endpoint 
    """
    with app.app_context():
        token = generate_token(user_id)
    return {"Authorization": f"Bearer {token}"}
