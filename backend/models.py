"""Domain data structures for the entities owned by the CRUD layer.

Each model knows how to build itself from a database row and how to turn
itself back into a plain dict for JSON responses. 
"""
import json
from dataclasses import dataclass
from typing import Any, Optional

import sqlite3


def _load_keywords(raw: Optional[str]) -> list[str]:
    """decode a keywords_json column into a list, shrugging off null/garbage"""
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        return []
    return value if isinstance(value, list) else []


def _load_metrics(raw: Optional[str]) -> dict[str, Any]:
    """Decode a metrics_json column into a dict, tolerating null/garbage."""
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        return {}
    return value if isinstance(value, dict) else {}


@dataclass
class Interest:
    """A topic a user follows, with optional keywords used for scoring."""

    id: int
    user_id: int
    name: str
    keywords: list[str]
    weight: float
    created_at: str

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Interest":
        """build an Interest off a db row"""
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            name=row["name"],
            keywords=_load_keywords(row["keywords_json"]),
            weight=row["weight"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-friendly dict (user_id stays server-side)."""
        return { "id": self.id, "name": self.name, "keywords": self.keywords, "weight": self.weight, "created_at": self.created_at}


@dataclass
class Collection:
    """A named bucket of saved items belonging to a user."""

    id: int
    user_id: int
    name: str
    description: Optional[str]
    created_at: str

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Collection":
        """build a Collection from a row"""
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            name=row["name"],
            description=row["description"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        """json-friendly dict for the response"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at,
        }


@dataclass
class Feedback:
    """A user's signal on an item: more like this, less, or hide it."""

    id: int
    user_id: int
    item_id: int
    kind: str
    created_at: str

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Feedback":
        """Build a Feedback from a database row."""
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            item_id=row["item_id"],
            kind=row["kind"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        """json-friendly dict (no user_id, that stays server side)"""
        return {
            "id": self.id,
            "item_id": self.item_id,
            "kind": self.kind,
            "created_at": self.created_at,
        }


@dataclass
class Story:
    """A cluster of related items that all cover the same event."""

    id: int
    title: Optional[str]
    item_count: int
    first_seen_at: Optional[str]
    last_updated_at: Optional[str]

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Story":
        """Build a Story from a database row."""
        return cls(
            id=row["id"],
            title=row["title"],
            item_count=row["item_count"],
            first_seen_at=row["first_seen_at"],
            last_updated_at=row["last_updated_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-friendly dict."""
        return {
            "id": self.id,
            "title": self.title,
            "item_count": self.item_count,
            "first_seen_at": self.first_seen_at,
            "last_updated_at": self.last_updated_at,
        }


@dataclass
class Item:
    """A single piece of content (news article, video or discussion)."""

    id: int
    source_type: str
    source_name: Optional[str]
    url: Optional[str]
    title: Optional[str]
    summary: Optional[str]
    author: Optional[str]
    published_at: Optional[str]
    metrics: dict[str, Any]
    read_time_min: Optional[int]
    sentiment_score: Optional[float]
    sentiment_label: Optional[str]
    keywords: list[str]
    credibility_tier: Optional[str]
    story_id: Optional[int]

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Item":
        """Build an Item from a database row."""
        return cls(
            id=row["id"],
            source_type=row["source_type"],
            source_name=row["source_name"],
            url=row["url"],
            title=row["title"],
            summary=row["summary"],
            author=row["author"],
            published_at=row["published_at"],
            metrics=_load_metrics(row["metrics_json"]),
            read_time_min=row["read_time_min"],
            sentiment_score=row["sentiment_score"],
            sentiment_label=row["sentiment_label"],
            keywords=_load_keywords(row["keywords_json"]),
            credibility_tier=row["credibility_tier"],
            story_id=row["story_id"],
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-friendly dict."""
        return {
            "id": self.id,
            "source_type": self.source_type,
            "source_name": self.source_name,
            "url": self.url,
            "title": self.title,
            "summary": self.summary,
            "author": self.author,
            "published_at": self.published_at,
            "metrics": self.metrics,
            "read_time_min": self.read_time_min,
            "sentiment_score": self.sentiment_score,
            "sentiment_label": self.sentiment_label,
            "keywords": self.keywords,
            "credibility_tier": self.credibility_tier,
            "story_id": self.story_id,
        }
