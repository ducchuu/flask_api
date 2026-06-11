"""Relevance scoring for items: interest match, recency, popularity, source preference."""
import math
from datetime import datetime
from typing import Any, Optional

POPULARITY_CEILING = {
    "news": 100_000,
    "video": 10_000_000,
    "discussion": 10_000,
}


def interest_match(interest_keywords: list[str], item_keywords: list[str]) -> float:
    """calculate similarity between the user's interest keywords and the item's keywords."""
    if not interest_keywords or not item_keywords:
        return 0.0
    a = {w.lower() for w in interest_keywords}
    b = {w.lower() for w in item_keywords}
    intersection = a & b
    union = a | b
    if not union:
        return 0.0
    return len(intersection) / len(union)


def recency_decay(published_at: datetime, now: datetime, half_life_hours: float = 24.0) -> float:
    """Exponential decay based on item age with a 24-hour half-life; future timestamps score 1.0."""
    delta = (now - published_at).total_seconds()
    if delta <= 0:
        return 1.0
    hours = delta / 3600.0
    return 0.5 ** (hours / half_life_hours)


def popularity(metrics: dict, source_type: str) -> float:
    """Log-scale engagement metrics into a [0, 1] popularity score per source type."""
    if not metrics:
        return 0.0
    if source_type == "video":
        raw = metrics.get("views", 0)
    elif source_type == "news":
        raw = metrics.get("shares", 0)
    elif source_type == "discussion":
        raw = metrics.get("upvotes", 0) + metrics.get("comments", 0)
    else:
        raw = 0
    if raw <= 0:
        return 0.0
    ceiling = POPULARITY_CEILING.get(source_type, 10_000)
    score = math.log10(1 + raw) / math.log10(1 + ceiling)
    return max(0.0, min(1.0, score))


def source_pref(source_type: str, prefs: dict) -> float:
    """Return the user's preference for a source type, clamped to [0, 1] (default 0.5 if missing)."""
    if source_type not in prefs:
        return 0.5
    value = prefs[source_type]
    return max(0.0, min(1.0, float(value)))


def _parse_published(value: Any) -> Optional[datetime]:
    """Parse an ISO-8601 string into a datetime, or return None on bad input."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def score_item(item: dict, interest_keywords: list[str], weights: dict, now: datetime) -> tuple[float, dict]:
    """Compute the weighted relevance score for an item and return (score, breakdown)."""
    item_keywords = item.get("keywords", []) or []
    source_type = item.get("source_type", "")
    metrics = item.get("metrics", {}) or {}
    published_at = _parse_published(item.get("published_at"))

    breakdown = {
        "interest": interest_match(interest_keywords, item_keywords),
        "recency": recency_decay(published_at, now) if published_at else 0.0,
        "popularity": popularity(metrics, source_type),
        "source": source_pref(source_type, weights.get("source_prefs", {})),
    }
    score = (
        breakdown["interest"] * weights.get("interest", 0.0)
        + breakdown["recency"] * weights.get("recency", 0.0)
        + breakdown["popularity"] * weights.get("popularity", 0.0)
        + breakdown["source"] * weights.get("source", 0.0)
    )
    return max(0.0, min(1.0, score)), breakdown
