"""Unit tests for backend/auth.py.

Coverage:
    hash_password / verify_password — hashing, salt, correct/wrong/empty
    generate_token / verify_token   — valid, tampered, invalid, two users
    @require_auth                   — missing header, bad token, valid token,
                                      g.user_id and g.current_user both set
"""

import pytest
from backend.auth import (
    generate_token,
    hash_password,
    require_auth,
    verify_password,
    verify_token,
)
from conftest import auth_headers, make_user


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

class TestHashPassword:
    """Tests for hash_password and verify_password."""

    def test_hash_differs_from_plain(self):
        """Stored hash must never equal the original password."""
        assert hash_password("secret") != "secret"

    def test_two_hashes_of_same_password_differ(self):
        """Salt ensures identical passwords produce different hashes."""
        assert hash_password("secret") != hash_password("secret")

    def test_correct_password_verifies(self):
        """Correct password returns True."""
        hashed = hash_password("secret")
        assert verify_password("secret", hashed) is True

    def test_wrong_password_fails(self):
        """Wrong password returns False."""
        hashed = hash_password("secret")
        assert verify_password("wrong", hashed) is False

    def test_empty_string_fails(self):
        """Empty string never matches a real hash."""
        hashed = hash_password("secret")
        assert verify_password("", hashed) is False


# ---------------------------------------------------------------------------
# Token generation and verification
# ---------------------------------------------------------------------------

class TestTokens:
    """Tests for generate_token and verify_token."""

    def test_token_is_non_empty_string(self, app):
        """generate_token returns a non-empty string."""
        with app.app_context():
            token = generate_token(1)
            assert isinstance(token, str) and len(token) > 0

    def test_valid_token_returns_correct_user_id(self, app):
        """verify_token decodes the correct user_id."""
        with app.app_context():
            assert verify_token(generate_token(42)) == 42

    def test_tampered_token_returns_none(self, app):
        """Modifying the token invalidates it."""
        with app.app_context():
            token = generate_token(1)
            assert verify_token(token[:-5] + "XXXXX") is None

    def test_invalid_token_returns_none(self, app):
        """Garbage input returns None without raising."""
        with app.app_context():
            assert verify_token("not.a.valid.token") is None

    def test_different_users_get_different_tokens(self, app):
        """Tokens for different users are never equal."""
        with app.app_context():
            assert generate_token(1) != generate_token(2)


# ---------------------------------------------------------------------------
# @require_auth decorator
# ---------------------------------------------------------------------------

class TestRequireAuth:
    """Tests for the @require_auth decorator."""

    @pytest.fixture(autouse=True)
    def _register_test_route(self, app):
        """Add a minimal protected route to test the decorator in isolation."""
        from flask import jsonify, g

        @app.get("/api/test-auth")
        @require_auth
        def _test_route():
            return jsonify({
                "user_id": g.user_id,
                "username": g.current_user.username,
            }), 200

    def test_no_header_returns_401(self, client):
        """Missing Authorization header returns 401 UNAUTHORIZED."""
        r = client.get("/api/test-auth")
        assert r.status_code == 401
        assert r.get_json()["error"]["code"] == "UNAUTHORIZED"

    def test_missing_bearer_prefix_returns_401(self, client, app, db):
        """Header without Bearer prefix returns 401."""
        user_id = make_user(db, "authtest")
        token = auth_headers(app, user_id)["Authorization"].split(" ")[1]
        r = client.get("/api/test-auth", headers={"Authorization": token})
        assert r.status_code == 401

    def test_invalid_token_returns_401(self, client):
        """A bad token string returns 401."""
        r = client.get("/api/test-auth",
                       headers={"Authorization": "Bearer badtoken"})
        assert r.status_code == 401
        assert r.get_json()["error"]["code"] == "UNAUTHORIZED"

    def test_valid_token_grants_access(self, client, app, db):
        """Valid token reaches the route and returns 200."""
        user_id = make_user(db, "authtest2")
        r = client.get("/api/test-auth", headers=auth_headers(app, user_id))
        assert r.status_code == 200

    def test_g_user_id_is_set(self, client, app, db):
        """g.user_id is set to the correct integer for teammates' routes."""
        user_id = make_user(db, "authtest3")
        r = client.get("/api/test-auth", headers=auth_headers(app, user_id))
        assert r.get_json()["user_id"] == user_id

    def test_g_current_user_is_set(self, client, app, db):
        """g.current_user is set with correct username for our routes."""
        user_id = make_user(db, "authtest4")
        r = client.get("/api/test-auth", headers=auth_headers(app, user_id))
        assert r.get_json()["username"] == "authtest4"
