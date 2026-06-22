"""API tests for the interests CRUD endpoints.

"""
from backend.tests.conftest import auth_headers, make_user


def make_interest(client, headers: dict[str, str], name: str = "AI") -> dict:
    """Helper: POST a new interest and return the created JSON body."""
    resp = client.post(
        "/api/interests",
        json={"name": name, "keywords": ["ai", "ml"], "weight": 1.0},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.get_json()


def test_create_persists_and_returns_201(app, client, db) -> None:
    """A valid POST stores the interest and echoes it back with an id."""
    user_id = make_user(db)
    headers = auth_headers(app, user_id)
    body = make_interest(client, headers, name="Climate")

    assert body["id"] > 0
    assert body["name"] == "Climate"
    assert body["keywords"] == ["ai", "ml"]
    row = db.execute(
        "SELECT user_id FROM interests WHERE id = ?", [body["id"]]
    ).fetchone()
    assert row["user_id"] == user_id


def test_list_returns_only_own_interests(app, client, db) -> None:
    """The feed of interests is scoped to the logged-in user."""
    alice = auth_headers(app, make_user(db, "alice"))
    bob = auth_headers(app, make_user(db, "bob"))
    make_interest(client, alice, name="Alice topic")
    make_interest(client, bob, name="Bob topic")

    resp = client.get("/api/interests", headers=alice)
    assert resp.status_code == 200
    assert [item["name"] for item in resp.get_json()] == ["Alice topic"]


def test_update_changes_fields(app, client, db) -> None:
    """PUT replaces the interest's fields and returns the new state."""
    headers = auth_headers(app, make_user(db))
    created = make_interest(client, headers, name="Old")
    resp = client.put(
        f"/api/interests/{created['id']}",
        json={"name": "New", "keywords": ["x"], "weight": 2.5},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["name"] == "New"
    assert resp.get_json()["weight"] == 2.5


def test_delete_then_get_is_404(app, client, db) -> None:
    """A deleted interest is really gone."""
    headers = auth_headers(app, make_user(db))
    created = make_interest(client, headers)
    assert client.delete(
        f"/api/interests/{created['id']}", headers=headers
    ).status_code == 204
    assert client.get(
        f"/api/interests/{created['id']}", headers=headers
    ).status_code == 404


def test_requires_authentication(client) -> None:
    """No bearer token means no access."""
    assert client.get("/api/interests").status_code == 401


def test_missing_name_is_400(app, client, db) -> None:
    """Name is required; a bad body is a client error, not a crash."""
    headers = auth_headers(app, make_user(db))
    resp = client.post("/api/interests", json={"keywords": ["x"]}, headers=headers)
    assert resp.status_code == 400


def test_cannot_touch_another_users_interest(app, client, db) -> None:
    """Acting on someone else's interest returns 404 (no data leak)."""
    owner = auth_headers(app, make_user(db, "owner"))
    intruder = auth_headers(app, make_user(db, "intruder"))
    created = make_interest(client, owner)
    assert client.get(
        f"/api/interests/{created['id']}", headers=intruder
    ).status_code == 404
    assert client.delete(
        f"/api/interests/{created['id']}", headers=intruder
    ).status_code == 404


def test_keywords_default_to_empty(app, client, db):
    # leaving keywords out shouldn't blow up, we just store an empty list
    headers = auth_headers(app, make_user(db))
    resp = client.post("/api/interests", json={"name": "Space"}, headers=headers)
    assert resp.status_code == 201
    assert resp.get_json()["keywords"] == []


def test_blank_name_rejected(app, client, db):
    """A name that's just spaces is not a real name."""
    headers = auth_headers(app, make_user(db))
    resp = client.post("/api/interests", json={"name": "   "}, headers=headers)
    assert resp.status_code == 400


def test_keywords_must_be_a_list(app, client, db):
    headers = auth_headers(app, make_user(db))
    # sending keywords as a comma string instead of a list is a client mistake
    resp = client.post(
        "/api/interests",
        json={"name": "AI", "keywords": "ai,ml"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_weight_must_be_a_number(app, client, db):
    headers = auth_headers(app, make_user(db))
    resp = client.post(
        "/api/interests",
        json={"name": "AI", "weight": "heavy"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_empty_body_is_400(app, client, db):
    # POST with no JSON at all should be a 400, not a 500
    headers = auth_headers(app, make_user(db))
    assert client.post("/api/interests", headers=headers).status_code == 400


def test_garbage_token_is_401(client):
    resp = client.get(
        "/api/interests", headers={"Authorization": "Bearer nonsense"}
    )
    assert resp.status_code == 401


def test_get_missing_interest_is_404(app, client, db):
    headers = auth_headers(app, make_user(db))
    assert client.get("/api/interests/9999", headers=headers).status_code == 404


def test_update_missing_interest_is_404(app, client, db):
    headers = auth_headers(app, make_user(db))
    resp = client.put("/api/interests/9999", json={"name": "x"}, headers=headers)
    assert resp.status_code == 404


def test_add_then_remove_keeps_other_interests(app, client, db):
    """Removing one interest leaves the rest untouched."""
    headers = auth_headers(app, make_user(db))
    space = make_interest(client, headers, name="Space")
    make_interest(client, headers, name="Climate")
    make_interest(client, headers, name="AI")

    assert client.delete(
        f"/api/interests/{space['id']}", headers=headers
    ).status_code == 204

    names = [i["name"] for i in client.get("/api/interests", headers=headers).get_json()]
    assert "Space" not in names
    assert set(names) == {"Climate", "AI"}


def test_re_add_after_remove(app, client, db):
    """An interest can be added again after being deleted (as a new row)."""
    headers = auth_headers(app, make_user(db))
    first = make_interest(client, headers, name="Quantum")
    client.delete(f"/api/interests/{first['id']}", headers=headers)

    again = make_interest(client, headers, name="Quantum")
    assert again["id"] != first["id"]
    names = [i["name"] for i in client.get("/api/interests", headers=headers).get_json()]
    assert names == ["Quantum"]


def test_multi_word_interest_name(app, client, db):
    """A name made of several words is stored and returned verbatim."""
    headers = auth_headers(app, make_user(db))
    resp = client.post(
        "/api/interests",
        json={"name": "machine learning", "keywords": ["ai"]},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.get_json()["name"] == "machine learning"


def test_multi_word_keywords(app, client, db):
    """Keywords can themselves be multi-word phrases."""
    headers = auth_headers(app, make_user(db))
    kws = ["artificial intelligence", "large language models"]
    resp = client.post(
        "/api/interests",
        json={"name": "AI", "keywords": kws},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.get_json()["keywords"] == kws


def test_outer_whitespace_trimmed_inner_spacing_kept(app, client, db):
    """Leading/trailing spaces are stripped but the words stay separated."""
    headers = auth_headers(app, make_user(db))
    resp = client.post(
        "/api/interests",
        json={"name": "  deep learning  ", "keywords": []},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.get_json()["name"] == "deep learning"


def test_interest_name_case_preserved(app, client, db):
    """The name's casing is stored exactly as sent (not lowercased)."""
    headers = auth_headers(app, make_user(db))
    resp = client.post(
        "/api/interests",
        json={"name": "Artificial Intelligence", "keywords": []},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.get_json()["name"] == "Artificial Intelligence"


def test_keyword_case_preserved(app, client, db):
    """Keyword casing round-trips unchanged."""
    headers = auth_headers(app, make_user(db))
    resp = client.post(
        "/api/interests",
        json={"name": "Tech", "keywords": ["GPU", "AI", "MacBook"]},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.get_json()["keywords"] == ["GPU", "AI", "MacBook"]


def test_same_name_different_case_are_distinct(app, client, db):
    """'python' and 'Python' are two separate interests (no case folding)."""
    headers = auth_headers(app, make_user(db))
    make_interest(client, headers, name="python")
    make_interest(client, headers, name="Python")
    names = [i["name"] for i in client.get("/api/interests", headers=headers).get_json()]
    assert sorted(names) == ["Python", "python"]


def test_suggestions_returns_common_interests(client):
    """The suggestions list is public and each entry has a name + keywords."""
    resp = client.get("/api/interests/suggestions")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list) and len(data) > 20
    first = data[0]
    assert isinstance(first["name"], str) and isinstance(first["keywords"], list)
