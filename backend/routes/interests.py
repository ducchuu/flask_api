"""CRUD endpoints for a user's interests (the topics they follow).

Every route is scoped to the authenticated user, so one user can never see or
change another user's interests. Interests are stored with their keywords as a
JSON-encoded list in the ``keywords_json`` column.
"""
import json
from typing import Any

from flask import Blueprint, abort, g, jsonify, request

from backend.auth import require_auth
from backend.db import get_db
from backend.models import Interest

bp = Blueprint("interests", __name__, url_prefix="/api/interests")


def _parse_payload(data: Any) -> tuple[str, str, float]:
    """Validate an incoming interest body and return (name, keywords_json, weight).

    Aborts with 400 if anything is missing or the wrong type.
    """
    if not isinstance(data, dict):
        abort(400, description="Request body must be a JSON object")

    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        abort(400, description="Field 'name' is required")

    keywords = data.get("keywords", [])
    if not isinstance(keywords, list):
        abort(400, description="Field 'keywords' must be a list")

    weight = data.get("weight", 1.0)
    if isinstance(weight, bool) or not isinstance(weight, (int, float)):
        abort(400, description="Field 'weight' must be a number")

    return name.strip(), json.dumps(keywords), float(weight)


def _get_owned_or_404(interest_id: int) -> Any:
    """Fetch an interest belonging to the current user, or abort with 404."""
    row = get_db().execute(
        "SELECT * FROM interests WHERE id = ? AND user_id = ?",
        [interest_id, g.user_id],
    ).fetchone()
    if row is None:
        abort(404, description="Interest not found")
    return row


@bp.get("")
@require_auth
def list_interests() -> Any:
    """Return all of the current user's interests, newest first."""
    rows = get_db().execute(
        "SELECT * FROM interests WHERE user_id = ? ORDER BY id DESC",
        [g.user_id],
    ).fetchall()
    return jsonify([Interest.from_row(row).to_dict() for row in rows])


@bp.post("")
@require_auth
def create_interest() -> Any:
    """Create a new interest for the current user."""
    name, keywords_json, weight = _parse_payload(request.get_json(silent=True))
    db = get_db()
    cursor = db.execute(
        "INSERT INTO interests (user_id, name, keywords_json, weight) "
        "VALUES (?, ?, ?, ?)",
        [g.user_id, name, keywords_json, weight],
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM interests WHERE id = ?", [cursor.lastrowid]
    ).fetchone()
    return jsonify(Interest.from_row(row).to_dict()), 201


@bp.get("/<int:interest_id>")
@require_auth
def get_interest(interest_id: int) -> Any:
    """Return a single interest by id."""
    row = _get_owned_or_404(interest_id)
    return jsonify(Interest.from_row(row).to_dict())


@bp.put("/<int:interest_id>")
@require_auth
def update_interest(interest_id: int) -> Any:
    """Replace an interest's fields."""
    _get_owned_or_404(interest_id)
    name, keywords_json, weight = _parse_payload(request.get_json(silent=True))
    db = get_db()
    db.execute(
        "UPDATE interests SET name = ?, keywords_json = ?, weight = ? "
        "WHERE id = ? AND user_id = ?",
        [name, keywords_json, weight, interest_id, g.user_id],
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM interests WHERE id = ?", [interest_id]
    ).fetchone()
    return jsonify(Interest.from_row(row).to_dict())


@bp.delete("/<int:interest_id>")
@require_auth
def delete_interest(interest_id: int) -> Any:
    """Delete an interest. Returns 204 with no body on success."""
    _get_owned_or_404(interest_id)
    db = get_db()
    db.execute(
        "DELETE FROM interests WHERE id = ? AND user_id = ?",
        [interest_id, g.user_id],
    )
    db.commit()
    return "", 204
