"""Domain data structures for the entities owned by the CRUD layer.

Each model knows how to build itself from a database row and how to turn
itself back into a plain dict for JSON responses. 
"""
import json
from dataclasses import dataclass
from typing import Any, Optional

import sqlite3


def _load_keywords(raw: Optional[str]) -> list[str]:
    """Decode a keywords_json column into a list, tolerating null/garbage."""
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        return []
    return value if isinstance(value, list) else []


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
        """Build an Interest from a database row."""
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
        """Build a Collection from a database row."""
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            name=row["name"],
            description=row["description"],
            created_at=row["created_at"],
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a JSON-friendly dict."""
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
        """Serialise to a JSON-friendly dict."""
        return {
            "id": self.id,
            "item_id": self.item_id,
            "kind": self.kind,
            "created_at": self.created_at,
        }
