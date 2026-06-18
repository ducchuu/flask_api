"""Authentication helpers for Pulse.

Covers password hashing/verification, signed token generation and
verification, and the @require_auth decorator that protects routes.

Libraries (both ship with Flask - no new dependencies):
    werkzeug.security   password hashing via pbkdf2
    itsdangerous        URL-safe timed token signing
"""

from functools import wraps
from typing import Any, Callable

from flask import g, jsonify, request, current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Hash a plain-text password with werkzeug's pbkdf2 hasher.

    Args:
        plain: The raw password supplied by the user.

    Returns:
        A hashed string safe to store in the database.
    """
    return generate_password_hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a stored hash.

    Args:
        plain:  The raw password to check.
        hashed: The stored hash from the database.

    Returns:
        True if the password matches, False otherwise.
    """
    return check_password_hash(hashed, plain)


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _serializer() -> URLSafeTimedSerializer:
    """Return a serializer bound to the current app's SECRET_KEY."""
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


# Tokens stay valid for 30 days. Whether a session actually persists across
# browser restarts is the client's choice ("Remember me" -> localStorage vs
# sessionStorage); the server just bounds the maximum lifetime.
TOKEN_MAX_AGE = 60 * 60 * 24 * 30


def generate_token(user_id: int) -> str:
    """Create a signed, expiring token for a given user.

    Uses itsdangerous URLSafeTimedSerializer - the payload is signed with
    SECRET_KEY and expires after TOKEN_MAX_AGE. No token state is stored
    server-side.

    Args:
        user_id: The primary key of the authenticated user.

    Returns:
        A signed token string to return to the client.
    """
    return _serializer().dumps({"user_id": user_id}, salt="auth-token")


def verify_token(token: str) -> int | None:
    """Decode and validate a signed token.

    Args:
        token: The token string from the Authorization header.

    Returns:
        The user_id integer if the token is valid and unexpired,
        None if it is expired or has been tampered with.
    """
    try:
        data = _serializer().loads(token, salt="auth-token", max_age=TOKEN_MAX_AGE)
        return int(data["user_id"])
    except SignatureExpired:
        return None
    except BadSignature:
        return None


# ---------------------------------------------------------------------------
# @require_auth decorator
# ---------------------------------------------------------------------------

def require_auth(f: Callable) -> Callable:
    """Protect a route by requiring a valid Bearer token.

    Reads the Authorization header, verifies the token, fetches the user
    from the database, and stores both g.user_id (int) and g.current_user
    (User model) for use by the route.

    Sets:
        g.user_id - integer user id, used by teammates' routes
        g.current_user - User model instance, used by users routes

    Returns:
        401 if the token is missing, invalid, or expired.
        404 if the token is valid but the user no longer exists.
    """
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        from backend.db import get_db
        from backend.models import User

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": {
                "code": "UNAUTHORIZED",
                "message": "Missing or invalid Authorization header",
            }}), 401

        token = auth_header.split(" ", 1)[1]
        user_id = verify_token(token)

        if user_id is None:
            return jsonify({"error": {
                "code": "UNAUTHORIZED",
                "message": "Token is invalid or expired",
            }}), 401

        row = get_db().execute(
            "SELECT * FROM users WHERE id = ?", [user_id]
        ).fetchone()

        if row is None:
            return jsonify({"error": {
                "code": "NOT_FOUND",
                "message": "User not found",
            }}), 404

        # Set both so our routes and teammates' routes both work
        g.user_id = row["id"]
        g.current_user = User.from_row(row)

        return f(*args, **kwargs)

    return decorated
