"""User routes — registration, login, and profile management.

Follows the same pattern as routes/interests.py: SQL lives directly in the
route functions, rows are converted via model classes from backend.models.

Endpoints:
    POST  /api/users        register a new user
    POST  /api/tokens       login and receive a signed token
    GET   /api/users/me     fetch the authenticated user's profile
    PATCH /api/users/me     update the authenticated user's profile
"""

import sqlite3
from typing import Any

from flask import Blueprint, g, jsonify, request

from backend.auth import generate_token, hash_password, require_auth, verify_password
from backend.db import get_db
from backend.models import User

bp = Blueprint("users", __name__)


# ---------------------------------------------------------------------------
# POST /api/users — register
# ---------------------------------------------------------------------------

@bp.post("/api/users")
def register() -> Any:
    """Register a new user and return a signed token.

    Request body (JSON):
        username (str, required)
        password (str, required)

    Returns:
        201 with {"token": ..., "user": ...} on success.
        400 if username or password is missing.
        409 if the username is already taken.
    """
    data = request.get_json(silent=True) or {}

    if not data.get("username") or not data.get("password"):
        return jsonify({"error": {
            "code": "BAD_REQUEST",
            "message": "username and password are required",
        }}), 400

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            [data["username"], hash_password(data["password"])],
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": {
            "code": "CONFLICT",
            "message": "Username is already taken",
        }}), 409

    row = db.execute(
        "SELECT * FROM users WHERE id = ?", [cursor.lastrowid]
    ).fetchone()
    user = User.from_row(row)
    return jsonify({"token": generate_token(user.id), "user": user.to_dict()}), 201


# ---------------------------------------------------------------------------
# POST /api/tokens — login
# ---------------------------------------------------------------------------

@bp.post("/api/tokens")
def login() -> Any:
    """Authenticate a user and return a signed token.

    Request body (JSON):
        username (str, required)
        password (str, required)

    Returns:
        200 with {"token": ..., "user": ...} on success.
        400 if username or password is missing.
        401 if credentials are invalid.
    """
    data = request.get_json(silent=True) or {}

    if not data.get("username") or not data.get("password"):
        return jsonify({"error": {
            "code": "BAD_REQUEST",
            "message": "username and password are required",
        }}), 400

    row = get_db().execute(
        "SELECT * FROM users WHERE username = ?", [data["username"]]
    ).fetchone()

    # Intentionally vague — never reveal whether the username exists
    if row is None or not verify_password(data["password"], row["password_hash"]):
        return jsonify({"error": {
            "code": "UNAUTHORIZED",
            "message": "Invalid username or password",
        }}), 401

    user = User.from_row(row)
    return jsonify({"token": generate_token(user.id), "user": user.to_dict()}), 200


# ---------------------------------------------------------------------------
# GET /api/users/me
# ---------------------------------------------------------------------------

@bp.get("/api/users/me")
@require_auth
def get_me() -> Any:
    """Return the authenticated user's profile.

    Returns:
        200 with {"user": ...}.
        401 if the token is missing or invalid (handled by @require_auth).
    """
    return jsonify({"user": g.current_user.to_dict()}), 200


# ---------------------------------------------------------------------------
# PATCH /api/users/me
# ---------------------------------------------------------------------------

@bp.patch("/api/users/me")
@require_auth
def update_me() -> Any:
    """Update the authenticated user's profile.

    Allowed fields: username, weights_json, source_prefs_json.
    All other fields (id, password_hash, created_at) are silently ignored.

    Returns:
        200 with {"user": ...} on success.
        400 if the request body is empty.
        409 if the new username is already taken.
    """
    data = request.get_json(silent=True) or {}

    if not data:
        return jsonify({"error": {
            "code": "BAD_REQUEST",
            "message": "No data provided",
        }}), 400

    # Only these fields can be updated — sensitive fields silently ignored
    allowed = {"username", "weights_json", "source_prefs_json"}
    updates = {k: v for k, v in data.items() if k in allowed}

    if not updates:
        return jsonify({"user": g.current_user.to_dict()}), 200

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [g.user_id]

    db = get_db()
    try:
        db.execute(
            f"UPDATE users SET {set_clause} WHERE id = ?", values
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": {
            "code": "CONFLICT",
            "message": "Username is already taken",
        }}), 409

    row = db.execute(
        "SELECT * FROM users WHERE id = ?", [g.user_id]
    ).fetchone()
    return jsonify({"user": User.from_row(row).to_dict()}), 200
