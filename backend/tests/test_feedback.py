"""API tests for feedback: a user's more / less / hide signal on an item."""
import sqlite3

from backend.tests.conftest import auth_headers, make_user


def make_item(db: sqlite3.Connection, title="Some article") -> int | None:
    """Insert a bare item row directly and return its id."""
    cur = db.execute(
        "INSERT INTO items (source_type, title, url) VALUES (?, ?, ?)",
        ["news", title, "https://example.com/x"],
    )
    db.commit()
    return cur.lastrowid


def post_feedback(client, headers, item_id, kind="more"):
    return client.post(
        "/api/feedback", json={"item_id": item_id, "kind": kind}, headers=headers
    )


def test_create_feedback_persists(app, client, db):
    user_id = make_user(db)
    headers = auth_headers(app, user_id)
    item_id = make_item(db)

    resp = post_feedback(client, headers, item_id, "more")
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["item_id"] == item_id
    assert body["kind"] == "more"

    row = db.execute(
        "SELECT user_id FROM feedback WHERE id = ?", [body["id"]]
    ).fetchone()
    assert row["user_id"] == user_id


def test_list_only_own_feedback(app, client, db):
    alice = auth_headers(app, make_user(db, "alice"))
    bob = auth_headers(app, make_user(db, "bob"))
    item_id = make_item(db)
    post_feedback(client, alice, item_id, "more")
    post_feedback(client, bob, item_id, "less")

    resp = client.get("/api/feedback", headers=alice)
    assert resp.status_code == 200
    kinds = [f["kind"] for f in resp.get_json()]
    assert kinds == ["more"]


def test_delete_feedback(app, client, db):
    headers = auth_headers(app, make_user(db))
    item_id = make_item(db)
    created = post_feedback(client, headers, item_id).get_json()

    assert client.delete(
        f"/api/feedback/{created['id']}", headers=headers
    ).status_code == 204
    assert client.get("/api/feedback", headers=headers).get_json() == []


def test_invalid_kind_is_400(app, client, db):
    headers = auth_headers(app, make_user(db))
    item_id = make_item(db)
    resp = post_feedback(client, headers, item_id, "love")
    assert resp.status_code == 400


def test_missing_item_id_is_400(app, client, db):
    headers = auth_headers(app, make_user(db))
    resp = client.post("/api/feedback", json={"kind": "more"}, headers=headers)
    assert resp.status_code == 400


def test_feedback_on_unknown_item_is_404(app, client, db):
    headers = auth_headers(app, make_user(db))
    resp = post_feedback(client, headers, 9999, "more")
    assert resp.status_code == 404


def test_feedback_requires_auth(client):
    assert client.get("/api/feedback").status_code == 401


def test_cannot_delete_another_users_feedback(app, client, db):
    owner = auth_headers(app, make_user(db, "owner"))
    other = auth_headers(app, make_user(db, "other"))
    item_id = make_item(db)
    created = post_feedback(client, owner, item_id).get_json()
    assert client.delete(
        f"/api/feedback/{created['id']}", headers=other
    ).status_code == 404
