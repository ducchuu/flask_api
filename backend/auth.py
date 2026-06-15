"""Stateless authentication helpers.

Login is stateless: instead of a server-side session we hand the client a
signed, expiring token. Every protected request carries it in the
``Authorization: Bearer <token>`` header, and we verify the signature on the
way in. Nothing about "who is logged in" is stored on the server.

This module only provides the token plumbing and the ``require_auth``
decorator. The actual /api/users (register) and /api/tokens (login) endpoints
live with the auth-users feature.
"""
import functools
from typing import Any, Callable, Optional

from flask import current_app, g, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

# Tokens expire after a day so leaked tokens aren't too bad
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24


def _serializer() -> URLSafeTimedSerializer:
    """Build a serializer bound to the app's secret key."""
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="pulse-auth")


def generate_token(user_id: int) -> str:
    """make a signed token that carries the user id"""
    return _serializer().dumps({"user_id": user_id})


def verify_token(token: str, max_age: int = TOKEN_MAX_AGE_SECONDS) -> Optional[int]:
    """Return the user id inside a valid token, or None if it's bad/expired."""
    try:
        payload = _serializer().loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
    return payload.get("user_id")


def _token_from_header() -> Optional[str]:
    """grab the bearer token out of the Authorization header if it's there"""
    raw = request.headers.get("Authorization", "")
    prefix = "Bearer "
    if raw.startswith(prefix):
        return raw[len(prefix):].strip()
    return None


def require_auth(view: Callable[..., Any]) -> Callable[..., Any]:
    """Reject requests without a valid bearer token.

    On success the authenticated user id is stashed on ``g.user_id`` so the
    wrapped view can read it.
    """

    @functools.wraps(view)
    def wrapped(*args: Any, **kwargs: Any) -> Any:
        from flask import abort

        token = _token_from_header()
        user_id = verify_token(token) if token else None
        if user_id is None:
            abort(401, description="Missing or invalid authentication token")
        g.user_id = user_id
        return view(*args, **kwargs)

    return wrapped
