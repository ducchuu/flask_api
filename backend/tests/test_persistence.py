"""Unit tests for the story/item persistence layer.

These drive the contract for ``save_stories``: it takes the in-memory output of
the clustering/pipeline step and writes it into the ``stories`` and ``items``
tables so the read-only /api/stories endpoints have real data to serve.
"""
import json
import sqlite3
from typing import Any

from flask import Flask

from backend.services.persistence import save_stories


def make_item(
    title: str = "An article",
    source_type: str = "news",
    published_at: str = "2026-01-01T12:00:00",
    relevance_score: float = 0.5,
    **extra: Any,
) -> dict:
    """build an enriched item dict shaped like the pipeline output."""
    item = {
        "source_type": source_type,
        "source_name": "bbc.com",
        "url": "https://example.com/article",
        "title": title,
        "published_at": published_at,
        "metrics": {"shares": 10},
        "keywords": ["ai", "ml"],
        "sentiment": "positive",        # pipeline field name for the label
        "credibility": "high",          # pipeline field name for the tier
        "read_time": 3,                 # pipeline field name for read minutes
        "relevance_score": relevance_score,
    }
    item.update(extra)
    return item


def make_story(
    items: list[dict],
    keywords: list[str] | None = None,
    title: str | None = None,
) -> dict:
    """build a clustered story dict shaped like cluster_items output."""
    story: dict = {"id": "story-1", "keywords": keywords or ["ai", "ml"], "items": items}
    if title is not None:
        story["title"] = title
    return story


class TestSaveStoriesBasics:
    """Tests for the core persistence behaviour of save_stories."""

    def test_empty_input_persists_nothing(self, app: Flask, db: sqlite3.Connection) -> None:
        """an empty story list writes no rows and reports zero counts."""
        with app.app_context():
            result = save_stories([])
        assert result == {"stories": 0, "items": 0}
        assert db.execute("SELECT COUNT(*) FROM stories").fetchone()[0] == 0
        assert db.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 0

    def test_creates_one_story_row(self, app: Flask, db: sqlite3.Connection) -> None:
        """a single story is written as exactly one stories row."""
        with app.app_context():
            save_stories([make_story([make_item()])])
        assert db.execute("SELECT COUNT(*) FROM stories").fetchone()[0] == 1

    def test_item_count_matches_number_of_items(self, app: Flask, db: sqlite3.Connection) -> None:
        """the stored item_count reflects how many items the story holds."""
        with app.app_context():
            save_stories([make_story([make_item("a"), make_item("b"), make_item("c")])])
        count = db.execute("SELECT item_count FROM stories").fetchone()[0]
        assert count == 3

    def test_items_are_linked_to_their_story(self, app: Flask, db: sqlite3.Connection) -> None:
        """every persisted item points back at its parent story via story_id."""
        with app.app_context():
            save_stories([make_story([make_item("a"), make_item("b")])])
        story_id = db.execute("SELECT id FROM stories").fetchone()[0]
        rows = db.execute("SELECT story_id FROM items").fetchall()
        assert len(rows) == 2
        assert all(r["story_id"] == story_id for r in rows)

    def test_returns_total_counts(self, app: Flask, db: sqlite3.Connection) -> None:
        """the return value reports how many stories and items were written."""
        stories = [
            make_story([make_item("a"), make_item("b")]),
            make_story([make_item("c")]),
        ]
        with app.app_context():
            result = save_stories(stories)
        assert result == {"stories": 2, "items": 3}

    def test_multiple_stories_kept_separate(self, app: Flask, db: sqlite3.Connection) -> None:
        """two stories produce two rows, each linked to its own items."""
        with app.app_context():
            save_stories([
                make_story([make_item("a")], keywords=["ai"]),
                make_story([make_item("b")], keywords=["sports"]),
            ])
        story_ids = [r["id"] for r in db.execute("SELECT id FROM stories").fetchall()]
        assert len(story_ids) == 2
        # each item is linked to a distinct, existing story
        item_story_ids = {r["story_id"] for r in db.execute("SELECT story_id FROM items").fetchall()}
        assert item_story_ids == set(story_ids)


class TestFieldMapping:
    """Tests that pipeline fields map onto the right database columns."""

    def test_relevance_score_persisted(self, app: Flask, db: sqlite3.Connection) -> None:
        """an item's relevance_score is stored so /api/stories can expose it."""
        with app.app_context():
            save_stories([make_story([make_item(relevance_score=0.87)])])
        score = db.execute("SELECT relevance_score FROM items").fetchone()[0]
        assert score == 0.87

    def test_enrichment_fields_mapped(self, app: Flask, db: sqlite3.Connection) -> None:
        """read_time/sentiment/credibility/keywords/metrics land in their columns."""
        with app.app_context():
            save_stories([make_story([make_item()])])
        row = db.execute(
            "SELECT read_time_min, sentiment_label, credibility_tier, "
            "keywords_json, metrics_json FROM items"
        ).fetchone()
        assert row["read_time_min"] == 3
        assert row["sentiment_label"] == "positive"
        assert row["credibility_tier"] == "high"
        assert json.loads(row["keywords_json"]) == ["ai", "ml"]
        assert json.loads(row["metrics_json"]) == {"shares": 10}

    def test_first_and_last_seen_derived_from_items(self, app: Flask, db: sqlite3.Connection) -> None:
        """story timestamps span the earliest and latest item publish dates."""
        items = [
            make_item("old", published_at="2026-01-01T00:00:00"),
            make_item("new", published_at="2026-03-01T00:00:00"),
        ]
        with app.app_context():
            save_stories([make_story(items)])
        row = db.execute("SELECT first_seen_at, last_updated_at FROM stories").fetchone()
        assert row["first_seen_at"] == "2026-01-01T00:00:00"
        assert row["last_updated_at"] == "2026-03-01T00:00:00"

    def test_explicit_title_is_used(self, app: Flask, db: sqlite3.Connection) -> None:
        """a story that carries a title keeps it."""
        with app.app_context():
            save_stories([make_story([make_item()], title="Big AI breakthrough")])
        assert db.execute("SELECT title FROM stories").fetchone()[0] == "Big AI breakthrough"

    def test_title_derived_from_keywords_when_absent(self, app: Flask, db: sqlite3.Connection) -> None:
        """with no explicit title, the story is labelled from its keywords."""
        with app.app_context():
            save_stories([make_story([make_item()], keywords=["ai", "ml"])])
        title = db.execute("SELECT title FROM stories").fetchone()[0]
        assert title is not None
        assert "ai" in title


class TestEdgeCases:
    """Tests for empty, partial, and unusual inputs."""

    def test_story_with_no_items(self, app: Flask, db: sqlite3.Connection) -> None:
        """a story with no items is still stored, with an item_count of 0."""
        with app.app_context():
            result = save_stories([make_story([])])
        assert result == {"stories": 1, "items": 0}
        assert db.execute("SELECT item_count FROM stories").fetchone()[0] == 0

    def test_item_missing_optional_fields_is_safe(self, app: Flask, db: sqlite3.Connection) -> None:
        """an item with only the required source_type still persists without error."""
        with app.app_context():
            result = save_stories([make_story([{"source_type": "news"}])])
        assert result["items"] == 1
        row = db.execute("SELECT source_type, relevance_score FROM items").fetchone()
        assert row["source_type"] == "news"
        assert row["relevance_score"] is None

    def test_discussion_source_item_persists(self, app: Flask, db: sqlite3.Connection) -> None:
        """a discussion-source item (what normalize_lemmy now emits) passes the
        schema CHECK and persists. Regression: it previously emitted
        source_type='lemmy', which the items.source_type CHECK rejects."""
        with app.app_context():
            result = save_stories([make_story([make_item(source_type="discussion")])])
        assert result["items"] == 1
        assert db.execute(
            "SELECT source_type FROM items"
        ).fetchone()["source_type"] == "discussion"

    def test_data_survives_across_connections(self, app: Flask, db: sqlite3.Connection) -> None:
        """writes are committed, so a separate connection can read them back."""
        with app.app_context():
            save_stories([make_story([make_item()])])
        # the db fixture is a different connection to the same file
        assert db.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 1
