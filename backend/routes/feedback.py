"""Endpoints for user feedback on items (more / less / hide) pretty simple.

feedback feeds back into relevance scoring later on, so it is always tied to
both the user who gave it and the item it is about.
"""
from typing import Any

from flask import Blueprint, abort, g, jsonify, request

from backend.auth import require_auth
from backend.db import get_db
from backend.models import Feedback

bp = Blueprint("feedback", __name__, url_prefix="/api/feedback")

VALID_KINDS = {"more", "less", "hide"}


@bp.get("")
@require_auth
def list_feedback() -> Any:
    """list  current user's feedback, newest first"""
    rows = get_db().execute(
        "SELECT * FROM feedback WHERE user_id = ? ORDER BY id DESC",
        [g.user_id],
    ).fetchall()
    return jsonify([Feedback.from_row(row).to_dict() for row in rows])


@bp.post("")
@require_auth
def create_feedback() -> Any:
    """Record a piece of feedback about an item."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Request body must be a JSON object")

    item_id = data.get("item_id")
    if not isinstance(item_id, int):
        abort(400, description="Field 'item_id' is required")

    kind = data.get("kind")
    if kind not in VALID_KINDS:
        abort(400, description="Field 'kind' must be one of more, less, hide")

    db = get_db()
    # select 1 cus you just need to know if it exists
    if db.execute("SELECT 1 FROM items WHERE id = ?", [item_id]).fetchone() is None:
        abort(404, description="Item not found")

    cur = db.execute(
        "INSERT INTO feedback (user_id, item_id, kind) VALUES (?, ?, ?)",
        [g.user_id, item_id, kind],
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM feedback WHERE id = ?", [cur.lastrowid]
    ).fetchone()
    return jsonify(Feedback.from_row(row).to_dict()), 201


@bp.delete("/<int:feedback_id>")
@require_auth
def delete_feedback(feedback_id: int) -> Any:
    """delete one of the current user's feedback entries"""
    db = get_db()
    row = db.execute(
        "SELECT id FROM feedback WHERE id = ? AND user_id = ?",
        [feedback_id, g.user_id],
    ).fetchone()
    if row is None:
        abort(404, description="Feedback not found")

    db.execute("DELETE FROM feedback WHERE id = ?", [feedback_id])
    db.commit()
    return "", 204
