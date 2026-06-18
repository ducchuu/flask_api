"""Additive item-write endpoint added for the frontend.

The live feed (`GET /api/items`) returns in-memory items keyed by an external
id, but collections and feedback need a persisted numeric item id. This
endpoint upserts a single item by ``external_id`` and returns its row id, so
the frontend can save or react to a feed item.

Kept in its own blueprint so it's a clean, isolated addition to the shared
backend (flagged to the team) rather than an edit to an existing route file.
"""
from typing import Any

from flask import Blueprint, abort, jsonify, request

from backend.auth import require_auth
from backend.db import get_db

bp = Blueprint("item_write", __name__)

VALID_SOURCES = {"news", "video", "discussion"}


@bp.post("/api/items")
@require_auth
def upsert_item() -> Any:
    """Create an item if it's new (by external_id), or return the existing id.

    Body: a normalized item dict; only ``external_id`` and a valid
    ``source_type`` are required, the rest are stored when present.

    Returns:
        201 with {"id": <int>} when created, 200 with {"id": <int>} if it
        already existed, 400 on a bad payload.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Request body must be a JSON object")

    external_id = data.get("external_id") or data.get("id")
    source_type = data.get("source_type")
    if not external_id:
        abort(400, description="Field 'external_id' is required")
    if source_type not in VALID_SOURCES:
        abort(400, description="Field 'source_type' must be news, video or discussion")

    db = get_db()
    existing = db.execute(
        "SELECT id FROM items WHERE external_id = ?", [str(external_id)]
    ).fetchone()
    if existing is not None:
        return jsonify({"id": existing["id"]}), 200

    cursor = db.execute(
        "INSERT INTO items (external_id, source_type, source_name, url, title, "
        "summary, author, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            str(external_id),
            source_type,
            data.get("source_name"),
            data.get("url"),
            data.get("title"),
            data.get("summary"),
            data.get("author"),
            data.get("published_at"),
        ],
    )
    db.commit()
    return jsonify({"id": cursor.lastrowid}), 201
