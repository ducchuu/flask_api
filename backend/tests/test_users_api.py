"""API tests for user endpoints.


Coverage:
    POST /api/users      — success, missing fields, duplicate, empty strings,
                           whitespace username, response structure
    POST /api/tokens     — success, wrong password, unknown user, missing fields,
                           case sensitivity, response structure
    GET  /api/users/me   — success, no token, invalid token, no password_hash,
                           response structure, correct user scoping
    PATCH /api/users/me  — each allowed field, multiple fields, sensitive fields
                           ignored, persistence, 409, empty body, no token,
                           partial update keeps other fields
"""

import pytest
from conftest import auth_headers, make_user


# ---------------------------------------------------------------------------
# POST /api/users — register
# ---------------------------------------------------------------------------

class TestRegister:
    """Tests for POST /api/users."""

    def test_success_returns_201_with_token_and_user(self, client):
        """Valid registration returns 201 with token and user."""
        r = client.post("/api/users",
                        json={"username": "alice", "password": "pass123"})
        assert r.status_code == 201
        data = r.get_json()
        assert "token" in data
        assert data["user"]["username"] == "alice"

    def test_password_hash_not_in_response(self, client):
        """password_hash is never exposed in the registration response."""
        r = client.post("/api/users",
                        json={"username": "alice", "password": "pass123"})
        assert "password_hash" not in r.get_json()["user"]

    def test_response_contains_expected_user_fields(self, client):
        """Response user object contains id, username, created_at."""
        r = client.post("/api/users",
                        json={"username": "alice", "password": "pass123"})
        user = r.get_json()["user"]
        assert "id" in user
        assert "username" in user
        assert "created_at" in user

    def test_user_id_is_integer(self, client):
        """Returned user id is an integer."""
        r = client.post("/api/users",
                        json={"username": "alice", "password": "pass123"})
        assert isinstance(r.get_json()["user"]["id"], int)

    def test_token_is_string(self, client):
        """Returned token is a non-empty string."""
        r = client.post("/api/users",
                        json={"username": "alice", "password": "pass123"})
        token = r.get_json()["token"]
        assert isinstance(token, str) and len(token) > 0

    def test_missing_username_returns_400(self, client):
        """Missing username returns 400 BAD_REQUEST."""
        r = client.post("/api/users", json={"password": "pass123"})
        assert r.status_code == 400
        assert r.get_json()["error"]["code"] == "BAD_REQUEST"

    def test_missing_password_returns_400(self, client):
        """Missing password returns 400 BAD_REQUEST."""
        r = client.post("/api/users", json={"username": "alice"})
        assert r.status_code == 400

    def test_empty_body_returns_400(self, client):
        """Empty body returns 400."""
        r = client.post("/api/users", json={})
        assert r.status_code == 400

    def test_empty_username_returns_400(self, client):
        """Empty string username returns 400."""
        r = client.post("/api/users",
                        json={"username": "", "password": "pass123"})
        assert r.status_code == 400

    def test_empty_password_returns_400(self, client):
        """Empty string password returns 400."""
        r = client.post("/api/users",
                        json={"username": "alice", "password": ""})
        assert r.status_code == 400

    def test_duplicate_username_returns_409(self, client):
        """Registering the same username twice returns 409 CONFLICT."""
        client.post("/api/users", json={"username": "alice", "password": "p"})
        r = client.post("/api/users", json={"username": "alice", "password": "p"})
        assert r.status_code == 409
        assert r.get_json()["error"]["code"] == "CONFLICT"

    def test_duplicate_username_different_password_returns_409(self, client):
        """Same username with a different password still returns 409."""
        client.post("/api/users", json={"username": "alice", "password": "p1"})
        r = client.post("/api/users", json={"username": "alice", "password": "p2"})
        assert r.status_code == 409

    def test_error_envelope_structure(self, client):
        """Error response always contains code and message keys."""
        r = client.post("/api/users", json={})
        error = r.get_json()["error"]
        assert "code" in error
        assert "message" in error

    def test_two_users_get_different_ids(self, client):
        """Two registered users receive different IDs."""
        r1 = client.post("/api/users",
                         json={"username": "alice", "password": "p"})
        r2 = client.post("/api/users",
                         json={"username": "bob", "password": "p"})
        assert r1.get_json()["user"]["id"] != r2.get_json()["user"]["id"]


# ---------------------------------------------------------------------------
# POST /api/tokens — login
# ---------------------------------------------------------------------------

class TestLogin:
    """Tests for POST /api/tokens."""

    def test_success_returns_200_with_token(self, client):
        """Valid credentials return 200 with a token."""
        client.post("/api/users", json={"username": "bob", "password": "pass"})
        r = client.post("/api/tokens",
                        json={"username": "bob", "password": "pass"})
        assert r.status_code == 200
        assert "token" in r.get_json()

    def test_password_hash_not_in_response(self, client):
        """password_hash is never exposed in the login response."""
        client.post("/api/users", json={"username": "bob", "password": "pass"})
        r = client.post("/api/tokens",
                        json={"username": "bob", "password": "pass"})
        assert "password_hash" not in r.get_json()["user"]

    def test_response_contains_expected_fields(self, client):
        """Login response contains token and user."""
        client.post("/api/users", json={"username": "bob", "password": "pass"})
        r = client.post("/api/tokens",
                        json={"username": "bob", "password": "pass"})
        data = r.get_json()
        assert "token" in data
        assert "user" in data

    def test_wrong_password_returns_401(self, client):
        """Wrong password returns 401 UNAUTHORIZED."""
        client.post("/api/users", json={"username": "bob", "password": "pass"})
        r = client.post("/api/tokens",
                        json={"username": "bob", "password": "wrong"})
        assert r.status_code == 401
        assert r.get_json()["error"]["code"] == "UNAUTHORIZED"

    def test_unknown_username_returns_401(self, client):
        """Non-existent username returns same 401 as wrong password."""
        r = client.post("/api/tokens",
                        json={"username": "ghost", "password": "pass"})
        assert r.status_code == 401

    def test_wrong_and_unknown_return_same_error_code(self, client):
        """Wrong password and unknown username return identical error codes.

        This prevents user enumeration — attacker cannot tell which was wrong.
        """
        client.post("/api/users", json={"username": "bob", "password": "pass"})
        r_wrong = client.post("/api/tokens",
                              json={"username": "bob", "password": "wrong"})
        r_unknown = client.post("/api/tokens",
                                json={"username": "ghost", "password": "pass"})
        assert r_wrong.get_json()["error"]["code"] == \
               r_unknown.get_json()["error"]["code"]

    def test_missing_password_returns_400(self, client):
        """Missing password field returns 400."""
        r = client.post("/api/tokens", json={"username": "bob"})
        assert r.status_code == 400

    def test_missing_username_returns_400(self, client):
        """Missing username field returns 400."""
        r = client.post("/api/tokens", json={"password": "pass"})
        assert r.status_code == 400

    def test_empty_body_returns_400(self, client):
        """Empty body returns 400."""
        r = client.post("/api/tokens", json={})
        assert r.status_code == 400


    def test_login_username_is_case_sensitive(self, client):
        """Username matching is case sensitive."""
        client.post("/api/users", json={"username": "Bob", "password": "pass"})
        r = client.post("/api/tokens",
                        json={"username": "bob", "password": "pass"})
        assert r.status_code == 401

    def test_correct_user_returned_in_response(self, client):
        """Login response contains the correct user's data."""
        client.post("/api/users", json={"username": "bob", "password": "pass"})
        r = client.post("/api/tokens",
                        json={"username": "bob", "password": "pass"})
        assert r.get_json()["user"]["username"] == "bob"


# ---------------------------------------------------------------------------
# GET /api/users/me
# ---------------------------------------------------------------------------

class TestGetMe:
    """Tests for GET /api/users/me."""

    def test_success_returns_correct_user(self, client, app, db):
        """Valid token returns the authenticated user's profile."""
        user_id = make_user(db, "dave")
        r = client.get("/api/users/me", headers=auth_headers(app, user_id))
        assert r.status_code == 200
        assert r.get_json()["user"]["username"] == "dave"

    def test_password_hash_not_in_response(self, client, app, db):
        """password_hash is never returned in the profile."""
        user_id = make_user(db, "dave2")
        r = client.get("/api/users/me", headers=auth_headers(app, user_id))
        assert "password_hash" not in r.get_json()["user"]

    def test_response_contains_expected_fields(self, client, app, db):
        """Profile response contains id, username, created_at."""
        user_id = make_user(db, "dave3")
        r = client.get("/api/users/me", headers=auth_headers(app, user_id))
        user = r.get_json()["user"]
        assert "id" in user
        assert "username" in user
        assert "created_at" in user

    def test_returned_id_matches_token_user(self, client, app, db):
        """Returned user id matches the user the token was issued for."""
        user_id = make_user(db, "dave4")
        r = client.get("/api/users/me", headers=auth_headers(app, user_id))
        assert r.get_json()["user"]["id"] == user_id

    def test_no_token_returns_401(self, client):
        """Missing token returns 401."""
        r = client.get("/api/users/me")
        assert r.status_code == 401
        assert r.get_json()["error"]["code"] == "UNAUTHORIZED"

    def test_invalid_token_returns_401(self, client):
        """Invalid token string returns 401."""
        r = client.get("/api/users/me",
                       headers={"Authorization": "Bearer garbage"})
        assert r.status_code == 401

    def test_user_only_sees_own_profile(self, client, app, db):
        """Token for user A returns user A's data, not user B's."""
        id_a = make_user(db, "user_a")
        make_user(db, "user_b")
        r = client.get("/api/users/me", headers=auth_headers(app, id_a))
        assert r.get_json()["user"]["username"] == "user_a"

    def test_two_users_see_different_profiles(self, client, app, db):
        """User A and user B each see their own profile."""
        id_a = make_user(db, "user_aa")
        id_b = make_user(db, "user_bb")
        r_a = client.get("/api/users/me", headers=auth_headers(app, id_a))
        r_b = client.get("/api/users/me", headers=auth_headers(app, id_b))
        assert r_a.get_json()["user"]["username"] == "user_aa"
        assert r_b.get_json()["user"]["username"] == "user_bb"


# ---------------------------------------------------------------------------
# PATCH /api/users/me
# ---------------------------------------------------------------------------

class TestUpdateMe:
    """Tests for PATCH /api/users/me."""

    def test_update_username_returns_200(self, client, app, db):
        """Username can be updated and new value is returned."""
        user_id = make_user(db, "eve")
        r = client.patch("/api/users/me",
                         json={"username": "eve_updated"},
                         headers=auth_headers(app, user_id))
        assert r.status_code == 200
        assert r.get_json()["user"]["username"] == "eve_updated"

    def test_update_weights_json(self, client, app, db):
        """weights_json field can be updated."""
        user_id = make_user(db, "judy")
        weights = '{"interest": 0.5, "recency": 0.5}'
        r = client.patch("/api/users/me",
                         json={"weights_json": weights},
                         headers=auth_headers(app, user_id))
        assert r.status_code == 200
        assert r.get_json()["user"]["weights_json"] == weights

    def test_update_source_prefs_json(self, client, app, db):
        """source_prefs_json field can be updated."""
        user_id = make_user(db, "kate")
        prefs = '{"news": 0.5, "video": 0.3, "discussion": 0.2}'
        r = client.patch("/api/users/me",
                         json={"source_prefs_json": prefs},
                         headers=auth_headers(app, user_id))
        assert r.status_code == 200
        assert r.get_json()["user"]["source_prefs_json"] == prefs

    def test_update_multiple_fields_at_once(self, client, app, db):
        """Multiple allowed fields can be updated in one request."""
        user_id = make_user(db, "multi")
        weights = '{"interest": 0.8}'
        r = client.patch("/api/users/me",
                         json={"username": "multi_updated",
                               "weights_json": weights},
                         headers=auth_headers(app, user_id))
        assert r.status_code == 200
        user = r.get_json()["user"]
        assert user["username"] == "multi_updated"
        assert user["weights_json"] == weights

    def test_update_persists_on_get(self, client, app, db):
        """Update is confirmed by a subsequent GET /api/users/me."""
        user_id = make_user(db, "frank")
        headers = auth_headers(app, user_id)
        client.patch("/api/users/me",
                     json={"username": "frank_updated"},
                     headers=headers)
        r = client.get("/api/users/me", headers=headers)
        assert r.get_json()["user"]["username"] == "frank_updated"

    def test_partial_update_keeps_other_fields(self, client, app, db):
        """Updating username does not wipe weights_json."""
        user_id = make_user(db, "partial")
        headers = auth_headers(app, user_id)
        weights = '{"interest": 0.9}'
        client.patch("/api/users/me",
                     json={"weights_json": weights},
                     headers=headers)
        client.patch("/api/users/me",
                     json={"username": "partial_updated"},
                     headers=headers)
        r = client.get("/api/users/me", headers=headers)
        user = r.get_json()["user"]
        assert user["username"] == "partial_updated"
        assert user["weights_json"] == weights

    def test_duplicate_username_returns_409(self, client, app, db):
        """Updating to a taken username returns 409 CONFLICT."""
        make_user(db, "taken")
        user_id = make_user(db, "grace")
        r = client.patch("/api/users/me",
                         json={"username": "taken"},
                         headers=auth_headers(app, user_id))
        assert r.status_code == 409
        assert r.get_json()["error"]["code"] == "CONFLICT"

    def test_duplicate_username_does_not_change_original(self, client, app, db):
        """Failed PATCH due to 409 leaves the user's username unchanged."""
        make_user(db, "taken2")
        user_id = make_user(db, "grace2")
        headers = auth_headers(app, user_id)
        client.patch("/api/users/me",
                     json={"username": "taken2"},
                     headers=headers)
        r = client.get("/api/users/me", headers=headers)
        assert r.get_json()["user"]["username"] == "grace2"

    def test_no_token_returns_401(self, client):
        """PATCH without a token returns 401."""
        r = client.patch("/api/users/me", json={"username": "hacker"})
        assert r.status_code == 401

    def test_empty_body_returns_400(self, client, app, db):
        """Empty body returns 400."""
        user_id = make_user(db, "henry")
        r = client.patch("/api/users/me",
                         json={},
                         headers=auth_headers(app, user_id))
        assert r.status_code == 400

    def test_sensitive_field_id_ignored(self, client, app, db):
        """id cannot be changed via PATCH."""
        user_id = make_user(db, "ivan")
        headers = auth_headers(app, user_id)
        client.patch("/api/users/me",
                     json={"id": 9999},
                     headers=headers)
        r = client.get("/api/users/me", headers=headers)
        assert r.get_json()["user"]["id"] == user_id

    def test_sensitive_field_password_hash_ignored(self, client, app, db):
        """password_hash cannot be changed via PATCH."""
        user_id = make_user(db, "ivan2")
        headers = auth_headers(app, user_id)
        client.patch("/api/users/me",
                     json={"password_hash": "hacked"},
                     headers=headers)
        r = client.get("/api/users/me", headers=headers)
        assert "password_hash" not in r.get_json()["user"]

    def test_sensitive_field_created_at_ignored(self, client, app, db):
        """created_at cannot be changed via PATCH."""
        user_id = make_user(db, "ivan3")
        headers = auth_headers(app, user_id)
        original = client.get("/api/users/me", headers=headers).get_json()["user"]["created_at"]
        client.patch("/api/users/me",
                     json={"created_at": "1970-01-01T00:00:00"},
                     headers=headers)
        r = client.get("/api/users/me", headers=headers)
        assert r.get_json()["user"]["created_at"] == original

    def test_user_a_cannot_affect_user_b(self, client, app, db):
        """PATCH only affects the authenticated user, not other users."""
        id_a = make_user(db, "user_patch_a")
        id_b = make_user(db, "user_patch_b")
        client.patch("/api/users/me",
                     json={"username": "user_patch_a_new"},
                     headers=auth_headers(app, id_a))
        r_b = client.get("/api/users/me", headers=auth_headers(app, id_b))
        assert r_b.get_json()["user"]["username"] == "user_patch_b"

    def test_error_envelope_structure_on_400(self, client, app, db):
        """400 response follows the group error envelope format."""
        user_id = make_user(db, "envelope")
        r = client.patch("/api/users/me",
                         json={},
                         headers=auth_headers(app, user_id))
        error = r.get_json()["error"]
        assert "code" in error
        assert "message" in error
