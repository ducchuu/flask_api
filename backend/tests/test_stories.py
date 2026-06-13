"""API tests for the read-only stories endpoints."""
import json
import sqlite3


def make_story(db: sqlite3.Connection, title: str = "Big AI story", last_updated_at: str = "2026-01-02T00:00:00") -> int:
    """Insert a story row and return its new id."""
    cur = db.execute(
        "INSERT INTO stories (title, item_count, first_seen_at, last_updated_at) "
        "VALUES (?, ?, ?, ?)",
        [title, 0, "2026-01-01T00:00:00", last_updated_at],
    )
    db.commit()
    return cur.lastrowid


def make_item(db: sqlite3.Connection, story_id: int, title: str = "An article", published_at: str = "2026-01-01T12:00:00") -> int:
    """Insert a news item attached to the given story and return its id."""
    cur = db.execute(
        "INSERT INTO items "
        "(source_type, source_name, url, title, keywords_json, metrics_json, "
        "story_id, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            "news",
            "bbc.com",
            "https://example.com/article",
            title,
            json.dumps(["ai", "ml"]),
            json.dumps({"shares": 42}),
            story_id,
            published_at,
        ],
    )
    db.commit()
    return cur.lastrowid


def test_list_empty_returns_200_and_empty_list(client) -> None:
    """ 'no stories yet' is a normal empty result, not an error"""
    resp = client.get("/api/stories")
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_list_returns_stories_newest_first(db, client) -> None:
    """stories come back ordered by last_updated_at - with most recent first"""
    make_story(db, title="Older", last_updated_at="2026-01-01T00:00:00")
    make_story(db, title="Newer", last_updated_at="2026-03-01T00:00:00")

    resp = client.get("/api/stories")
    assert resp.status_code == 200
    titles = [story["title"] for story in resp.get_json()]
    assert titles == ["Newer", "Older"]


def test_get_story_includes_its_items(db, client) -> None:
    """The detail endpoint returns the story plus every clustered item underneath it"""
    story_id = make_story(db)
    make_item(db, story_id, title="First")
    make_item(db, story_id, title="Second")

    resp = client.get(f"/api/stories/{story_id}")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["id"] == story_id
    assert len(body["items"]) == 2
    assert body["items"][0]["keywords"] == ["ai", "ml"]
    assert body["items"][0]["metrics"] == {"shares": 42}


def test_get_story_orders_items_newest_first(db, client) -> None:
    """items inside a story are ordered by published_at, newest first"""
    story_id = make_story(db)
    make_item(db, story_id, title="Old", published_at="2026-01-01T00:00:00")
    make_item(db, story_id, title="New", published_at="2026-02-01T00:00:00")

    body = client.get(f"/api/stories/{story_id}").get_json()
    assert [item["title"] for item in body["items"]] == ["New", "Old"]


def test_get_story_with_no_items_returns_empty_list(db, client) -> None:
    """A story that has no items yet still returns an empty items list."""
    story_id = make_story(db)
    body = client.get(f"/api/stories/{story_id}").get_json()
    assert body["items"] == []


def test_get_missing_story_is_404(client) -> None:
    """Asking for a story that does not exist is a 404, not a crash."""
    assert client.get("/api/stories/999").status_code == 404
