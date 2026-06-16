"""API tests for collections: the named buckets users save items into.

Covers the CRUD verbs plus the collection<->item membership join, and the
usual auth / validation / ownership cases.
"""
import sqlite3

from backend.tests.conftest import auth_headers, make_user


def make_collection(client, headers, name="Reading list"):
    """POST a collection and return its JSON body."""
    resp = client.post(
        "/api/collections",
        json={"name": name, "description": "stuff to read later"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.get_json()


def make_item(db: sqlite3.Connection, title="Some article") -> int | None:
    """Insert a bare item row directly and return its id."""
    cur = db.execute(
        "INSERT INTO items (source_type, title, url) VALUES (?, ?, ?)",
        ["news", title, "https://example.com/" + title.replace(" ", "-")],
    )
    db.commit()
    return cur.lastrowid


def test_create_collection_persists(app, client, db):
    user_id = make_user(db)
    headers = auth_headers(app, user_id)
    body = make_collection(client, headers, name="AI papers")

    assert body["id"] > 0
    assert body["name"] == "AI papers"
    row = db.execute(
        "SELECT user_id FROM collections WHERE id = ?", [body["id"]]
    ).fetchone()
    assert row["user_id"] == user_id


def test_list_only_shows_own_collections(app, client, db):
    alice = auth_headers(app, make_user(db, "alice"))
    bob = auth_headers(app, make_user(db, "bob"))
    make_collection(client, alice, name="Alice list")
    make_collection(client, bob, name="Bob list")

    resp = client.get("/api/collections", headers=alice)
    assert resp.status_code == 200
    assert [c["name"] for c in resp.get_json()] == ["Alice list"]


def test_update_collection(app, client, db):
    headers = auth_headers(app, make_user(db))
    created = make_collection(client, headers)
    resp = client.put(
        f"/api/collections/{created['id']}",
        json={"name": "Renamed", "description": "new desc"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["name"] == "Renamed"


def test_delete_collection_then_404(app, client, db):
    headers = auth_headers(app, make_user(db))
    created = make_collection(client, headers)
    assert client.delete(
        f"/api/collections/{created['id']}", headers=headers
    ).status_code == 204
    assert client.get(
        f"/api/collections/{created['id']}", headers=headers
    ).status_code == 404


def test_add_item_then_it_shows_in_the_collection(app, client, db):
    headers = auth_headers(app, make_user(db))
    coll = make_collection(client, headers)
    item_id = make_item(db, "Breaking news")

    add = client.put(
        f"/api/collections/{coll['id']}/items/{item_id}", headers=headers
    )
    assert add.status_code in (200, 204)

    got = client.get(f"/api/collections/{coll['id']}", headers=headers).get_json()
    assert item_id in [it["id"] for it in got["items"]]


def test_adding_same_item_twice_is_idempotent(app, client, db):
    headers = auth_headers(app, make_user(db))
    coll = make_collection(client, headers)
    item_id = make_item(db)

    url = f"/api/collections/{coll['id']}/items/{item_id}"
    client.put(url, headers=headers)
    client.put(url, headers=headers)  # second add should not error or duplicate

    got = client.get(f"/api/collections/{coll['id']}", headers=headers).get_json()
    assert [it["id"] for it in got["items"]].count(item_id) == 1


def test_adding_unknown_item_is_404(app, client, db):
    headers = auth_headers(app, make_user(db))
    coll = make_collection(client, headers)
    resp = client.put(
        f"/api/collections/{coll['id']}/items/9999", headers=headers
    )
    assert resp.status_code == 404


def test_collections_require_auth(client):
    assert client.get("/api/collections").status_code == 401


def test_cannot_access_another_users_collection(app, client, db):
    owner = auth_headers(app, make_user(db, "owner"))
    other = auth_headers(app, make_user(db, "other"))
    coll = make_collection(client, owner)
    assert client.get(
        f"/api/collections/{coll['id']}", headers=other
    ).status_code == 404
    assert client.delete(
        f"/api/collections/{coll['id']}", headers=other
    ).status_code == 404


def test_create_without_name_is_400(app, client, db):
    headers = auth_headers(app, make_user(db))
    resp = client.post("/api/collections", json={"description": "no name"}, headers=headers)
    assert resp.status_code == 400
