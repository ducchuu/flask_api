"""Persist clustered stories and their enriched items into the database.
The pipeline (fetch -> enrich -> score -> cluster) produces stories and items as
in-memory dicts. This module writes them into the ``stories`` and ``items``
tables so the read-only /api/stories endpoints can serve real data between
requests.
"""
import json
import sqlite3
from typing import Optional
from backend.db import get_db


def _story_title(story: dict) -> Optional[str]:
    """Pick a label for a story: an explicit title, else its keywords joined."""
    
    title = story.get("title")
    if title:
        return title
    # fall back to the cluster's keywords so the story is never nameless
    keywords = story.get("keywords") or []
    return ", ".join(keywords) if keywords else None


def _published_bounds(items: list[dict]) -> tuple[Optional[str], Optional[str]]:
    """Return the earliest and latest published_at across a story's items."""
    
    dates = [it.get("published_at") for it in items if it.get("published_at")]
    if not dates:
        return None, None
    return min(dates), max(dates)


def _insert_item(db: sqlite3.Connection, story_id: int, item: dict) -> None:
    """Write one enriched item row linked to its parent story.
    Maps the pipeline's in-memory field names (read_time, sentiment,
    credibility) onto the matching columns and stores list/dict fields as json.
    """

    db.execute(
        "INSERT INTO items ("
        "external_id, source_type, source_name, url, title, summary, author, "
        "published_at, metrics_json, read_time_min, sentiment_score, "
        "sentiment_label, keywords_json, credibility_tier, relevance_score, story_id"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            item.get("external_id"),
            item.get("source_type"),
            item.get("source_name"),
            item.get("url"),
            item.get("title"),
            item.get("summary"),
            item.get("author"),
            item.get("published_at"),
            json.dumps(item.get("metrics", {})),
            # pipeline uses short names; accept the column names too as a fallback
            item.get("read_time", item.get("read_time_min")),
            item.get("sentiment_score"),
            item.get("sentiment", item.get("sentiment_label")),
            json.dumps(item.get("keywords", [])),
            item.get("credibility", item.get("credibility_tier")),
            item.get("relevance_score"),
            story_id,
        ],
    )


def save_stories(stories: list[dict]) -> dict[str, int]:
    """Persist clustered stories and their items, reporting how many were written.

    Args:
        stories: clustered story dicts (as produced by cluster_items / the
            pipeline), each carrying a 'keywords' list and an 'items' list.

    Returns:
        A summary dict of the form {"stories": <n>, "items": <m>}.
    """
    db = get_db()
    story_count = 0
    item_count = 0

    for story in stories:
        items = story.get("items", [])
        first_seen, last_updated = _published_bounds(items)
        # write the story first so its items can reference the new id
        cur = db.execute(
            "INSERT INTO stories (title, item_count, first_seen_at, last_updated_at) "
            "VALUES (?, ?, ?, ?)",
            [_story_title(story), len(items), first_seen, last_updated],
        )
        story_id = cur.lastrowid
        story_count += 1
        for item in items:
            _insert_item(db, story_id, item)
            item_count += 1

    db.commit()
    return {"stories": story_count, "items": item_count}