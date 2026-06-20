"""sqlite connection handling + schema setup.

We keep the connection on Flask's ``g`` so each request reuses one connection,
then it gets closed automatically once the request finishes.
"""
import sqlite3
from pathlib import Path

from flask import current_app, g

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_db() -> sqlite3.Connection:
    """Return the per-request db connection, opening one if we don't have it yet.

    Rows come back as sqlite3.Row so we can grab columns by name. Also flip on
    foreign keys since sqlite leaves them off by default.
    """
    if "db" not in g:
        g.db = sqlite3.connect(
            current_app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")  # not on by default, easy to forget
    return g.db


def close_db(exception: BaseException | None = None) -> None:
    """close the request connection if we opened one (hooked up as a teardown)"""
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    """Build any missing tables from schema.sql.

    Fine to run more than once - every statement is CREATE TABLE IF NOT EXISTS.
    """
    conn = get_db()
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    # ponytail: tiny migration for columns added after a db already exists;
    # ALTER errors if the column is already there, which we ignore.
    try:
        conn.execute("ALTER TABLE users ADD COLUMN languages_json TEXT")
    except sqlite3.OperationalError:
        pass
    conn.commit()
