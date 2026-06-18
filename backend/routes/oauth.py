"""Google OAuth sign-in (additive, for the frontend).

The browser uses Google Identity Services to obtain a signed ID token, then
posts it here. We verify the token with Google, then create-or-find the user
and hand back the same bearer token the rest of the app uses, so OAuth users
are just normal users with a randomly-set (unusable) password.

Kept in its own blueprint so it's an isolated addition to the shared backend.
"""
import os
import secrets
from typing import Any

import requests
from flask import Blueprint, abort, jsonify, request

from backend.auth import generate_token
from backend.db import get_db
from backend.models import User

bp = Blueprint("oauth", __name__)

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


@bp.post("/api/auth/google")
def google_auth() -> Any:
    """Verify a Google ID token and return our own session token.

    Body: {"credential": "<google id token>"}. Returns 200 with
    {"token", "user"}; 400 if missing, 401 if invalid, 502 if Google is
    unreachable.
    """
    data = request.get_json(silent=True) or {}
    credential = data.get("credential")
    if not credential:
        abort(400, description="Missing Google credential")

    try:
        resp = requests.get(TOKENINFO_URL, params={"id_token": credential}, timeout=8)
    except requests.RequestException:
        abort(502, description="Could not reach Google to verify sign-in")

    if resp.status_code != 200:
        abort(401, description="Invalid Google sign-in")
    info = resp.json()

    # Make sure the token was minted for *our* app, not some other site.
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    if client_id and info.get("aud") != client_id:
        abort(401, description="Google sign-in was issued for a different app")

    email = info.get("email")
    if not email:
        abort(401, description="Google account has no email address")

    db = get_db()
    row = db.execute("SELECT * FROM users WHERE username = ?", [email]).fetchone()
    if row is None:
        # OAuth users have no password; store a random unusable hash so the
        # NOT NULL column is satisfied without granting password login.
        db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            [email, "google-oauth:" + secrets.token_hex(16)],
        )
        db.commit()
        row = db.execute("SELECT * FROM users WHERE username = ?", [email]).fetchone()

    user = User.from_row(row)
    return jsonify({"token": generate_token(user.id), "user": user.to_dict()}), 200
