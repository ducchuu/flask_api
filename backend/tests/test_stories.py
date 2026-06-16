"""API tests for the stories endpoints (read + pipeline-backed ingestion)."""
import json
import sqlite3
from unittest.mock import patch

from flask.testing import FlaskClient


def _pipeline_story(title: str = "AI breakthrough", relevance_score: float = 0.9) -> dict:
    """build a clustered story dict shaped like generate_feed's output."""
    return {
        "id": "story-1",
        "keywords": ["ai"],
        "title": title,
        "items": [
            {
                "source_type": "news",
                "title": "an article",
                "published_at": "2026-01-01T00:00:00",
                "keywords": ["ai"],
                "metrics": {},
                "sentiment": "positive",
                "credibility": "high",
                "read_time": 3,
                "relevance_score": relevance_score,
            }
        ],
    }


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
            json.dumps(["ai", "ml"]),  # keywords/metrics are stored as json strings
            json.dumps({"shares": 42}),
            story_id,
            published_at,
        ],
    )
    db.commit()
    return cur.lastrowid


def test_list_empty_returns_200_and_empty_list(client: FlaskClient) -> None:
    """ 'no stories yet' is a normal empty result, not an error"""
    resp = client.get("/api/stories")
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_list_returns_stories_newest_first(db: sqlite3.Connection, client: FlaskClient) -> None:
    """stories come back ordered by last_updated_at - with most recent first"""
    make_story(db, title="Older", last_updated_at="2026-01-01T00:00:00")
    make_story(db, title="Newer", last_updated_at="2026-03-01T00:00:00")

    resp = client.get("/api/stories")
    assert resp.status_code == 200
    titles = [story["title"] for story in resp.get_json()]
    assert titles == ["Newer", "Older"]


def test_get_story_includes_its_items(db: sqlite3.Connection, client: FlaskClient) -> None:
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


def test_get_story_orders_items_newest_first(db: sqlite3.Connection, client: FlaskClient) -> None:
    """items inside a story are ordered by published_at, newest first"""
    story_id = make_story(db)
    make_item(db, story_id, title="Old", published_at="2026-01-01T00:00:00")
    make_item(db, story_id, title="New", published_at="2026-02-01T00:00:00")

    body = client.get(f"/api/stories/{story_id}").get_json()
    assert [item["title"] for item in body["items"]] == ["New", "Old"]


def test_get_story_with_no_items_returns_empty_list(db: sqlite3.Connection, client: FlaskClient) -> None:
    """A story that has no items yet still returns an empty items list."""
    story_id = make_story(db)
    body = client.get(f"/api/stories/{story_id}").get_json()
    assert body["items"] == []


def test_get_missing_story_is_404(client: FlaskClient) -> None:
    """Asking for a story that does not exist is a 404, not a crash."""
    assert client.get("/api/stories/999").status_code == 404


# --- POST /api/stories: run the pipeline and persist the result -------------

def test_post_runs_pipeline_and_reports_counts(client: FlaskClient) -> None:
    """POST triggers ingestion and reports how many stories/items were stored."""
    with patch("backend.routes.stories.generate_feed", return_value=[_pipeline_story()]):
        resp = client.post("/api/stories")
    assert resp.status_code == 201
    assert resp.get_json() == {"stories": 1, "items": 1}


def test_post_then_story_is_listed(client: FlaskClient) -> None:
    """a story created via POST is afterwards returned by the GET list."""
    with patch("backend.routes.stories.generate_feed", return_value=[_pipeline_story("Fresh")]):
        client.post("/api/stories")
    titles = [s["title"] for s in client.get("/api/stories").get_json()]
    assert "Fresh" in titles


def test_post_empty_pipeline_still_succeeds(client: FlaskClient) -> None:
    """an empty pipeline result persists nothing but is not an error."""
    with patch("backend.routes.stories.generate_feed", return_value=[]):
        resp = client.post("/api/stories")
    assert resp.status_code == 201
    assert resp.get_json() == {"stories": 0, "items": 0}


def test_post_persists_relevance_score_exposed_in_detail(client: FlaskClient) -> None:
    """the pipeline's relevance_score is stored and shown in the detail view."""
    with patch("backend.routes.stories.generate_feed", return_value=[_pipeline_story(relevance_score=0.77)]):
        client.post("/api/stories")
    story_id = client.get("/api/stories").get_json()[0]["id"]
    item = client.get(f"/api/stories/{story_id}").get_json()["items"][0]
    assert item["relevance_score"] == 0.77


# --- GET /api/stories pagination (?limit= & ?offset=) -----------------------

def test_list_respects_limit(db: sqlite3.Connection, client: FlaskClient) -> None:
    """?limit=N returns at most N stories."""
    for i in range(5):
        make_story(db, title=f"S{i}", last_updated_at=f"2026-01-0{i + 1}T00:00:00")
    resp = client.get("/api/stories?limit=2")
    assert resp.status_code == 200
    assert len(resp.get_json()) == 2


def test_list_offset_skips_in_order(db: sqlite3.Connection, client: FlaskClient) -> None:
    """?offset=N skips the first N stories in the newest-first order."""
    make_story(db, title="Newest", last_updated_at="2026-03-01T00:00:00")
    make_story(db, title="Middle", last_updated_at="2026-02-01T00:00:00")
    make_story(db, title="Oldest", last_updated_at="2026-01-01T00:00:00")
    titles = [s["title"] for s in client.get("/api/stories?limit=2&offset=1").get_json()]
    assert titles == ["Middle", "Oldest"]


def test_list_without_pagination_returns_all(db: sqlite3.Connection, client: FlaskClient) -> None:
    """omitting limit/offset returns every story (existing behaviour preserved)."""
    for i in range(3):
        make_story(db, title=f"S{i}", last_updated_at=f"2026-01-0{i + 1}T00:00:00")
    assert len(client.get("/api/stories").get_json()) == 3


def test_list_invalid_limit_is_400(client: FlaskClient) -> None:
    """a non-positive or non-numeric limit is a client error, not a crash."""
    assert client.get("/api/stories?limit=0").status_code == 400
    assert client.get("/api/stories?limit=abc").status_code == 400


def test_list_invalid_offset_is_400(client: FlaskClient) -> None:
    """a negative or non-numeric offset is a client error, not a crash."""
    assert client.get("/api/stories?offset=-1").status_code == 400
    assert client.get("/api/stories?offset=abc").status_code == 400
