"""SQLite connection handling and schema initialisation.

The connection is stored on Flask's ``g`` so each request reuses a single
connection and it gets closed automatically when the request ends.
"""
import sqlite3
from pathlib import Path

from flask import current_app, g

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_db() -> sqlite3.Connection:
    """Return the request-scoped database connection, opening one if needed.

    Rows come back as ``sqlite3.Row`` so they can be accessed by column name,
    and foreign-key enforcement is turned on (SQLite leaves it off by default).
    """
    if "db" not in g:
        g.db = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(exception: BaseException | None = None) -> None:
    """Close the request connection if one was opened. Registered as a teardown."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    """Create any missing tables by running schema.sql.

    Safe to call repeatedly: every statement uses ``CREATE TABLE IF NOT EXISTS``.
    """
    db = get_db()
    db.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    db.commit()
