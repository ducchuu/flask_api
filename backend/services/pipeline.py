"""Feed generation pipeline.

Orchestrates fetch → enrich → score → cluster across all sources.
Partial failures are handled gracefully - if one source is down the
pipeline continues with results from the remaining sources.
"""

import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from backend.db import get_db

from backend.fetchers.gnews import fetch_gnews
from backend.fetchers.youtube import fetch_youtube
from backend.fetchers.lemmy import fetch_lemmy
from backend.services.cache import fetch_with_cache
from backend.services.fetchers.base import UpstreamError

from backend.services.enrich import (
    keywords, sentiment, credibility_tier,
    read_time, video_duration_minutes,
)
from backend.services.scoring import score_item, popularity
from backend.services.clustering import cluster_items


# Default scoring weights, used when a user has not tuned their own.
# The four component weights are combined as a weighted sum in score_item.
DEFAULT_WEIGHTS = {
    "interest": 0.4,
    "recency": 0.3,
    "popularity": 0.2,
    "source": 0.1,
}
# Default per-source-type preference, feeding the "source" component.
DEFAULT_SOURCE_PREFS = {"news": 0.8, "video": 0.5, "discussion": 0.7}


def _merge_overrides(defaults: Dict[str, float], raw: Optional[str]) -> Dict[str, float]:
    """Merge a user's JSON overrides over a set of default float values.

    Only keys already present in ``defaults`` are honoured, and only when
    the override parses to a finite, non-negative number. Anything else
    (null, malformed JSON, wrong type, unknown key, bad value) is ignored
    so a user can never break their own feed by storing garbage.

    Args:
        defaults: The baseline mapping to start from.
        raw:      A JSON object string from the user's profile, or None.

    Returns:
        A new dict: defaults with any valid overrides applied.
    """
    merged = dict(defaults)
    if not raw:
        return merged
    try:
        overrides = json.loads(raw)
    except (ValueError, TypeError):
        return merged
    if not isinstance(overrides, dict):
        return merged
    for key, value in overrides.items():
        if key not in defaults:
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            continue
        if value < 0 or value != value:  # reject negatives and NaN
            continue
        merged[key] = float(value)
    return merged


def resolve_weights(
    weights_json: Optional[str] = None,
    source_prefs_json: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the scoring weights dict from a user's stored preferences.

    Falls back to DEFAULT_WEIGHTS / DEFAULT_SOURCE_PREFS for anything the
    user has not validly overridden, so the result is always usable by
    score_item.

    Args:
        weights_json:      User's component weights as a JSON string, or None.
        source_prefs_json: User's per-source preferences as a JSON string,
                           or None.

    Returns:
        A weights dict with the four component weights plus a nested
        "source_prefs" mapping.
    """
    weights: Dict[str, Any] = dict(_merge_overrides(DEFAULT_WEIGHTS, weights_json))
    weights["source_prefs"] = _merge_overrides(DEFAULT_SOURCE_PREFS, source_prefs_json)
    return weights


def _within_window(published_at: Optional[str], cutoff: datetime) -> bool:
    """Return True if the item was published at or after the cutoff time.

    Items with a missing or unparseable date are treated as outside the
    window so the freshness filter never lets unknown-age items through.
    """
    if not published_at:
        return False
    try:
        return datetime.fromisoformat(published_at) >= cutoff
    except (ValueError, TypeError):
        return False


def _safe_fetch(fetch_fn, query: str, cache_key: str) -> List[Dict[str, Any]]:
    """Call a fetcher via cache, catching upstream errors so one source
    failing does not bring down the whole pipeline.

    Args:
        fetch_fn:  The fetcher function to call (fetch_gnews, etc.).
        query:     Search query to pass to the fetcher.
        cache_key: Cache key prefix for this source + query combination.

    Returns:
        List of raw items, or empty list if the source is unavailable.
    """
    try:
        return fetch_with_cache(
            cache_key, lambda _, _q=query: fetch_fn(_q)
        )
    except UpstreamError:
        # Log the failure but continue
        return []


def generate_feed(
    user_id: Optional[int],
    source_filter: Optional[str] = None,
    sort_by: str = "relevance",
    search_query: Optional[str] = None,
    freshness_days: Optional[int] = None,
    weights_json: Optional[str] = None,
    source_prefs_json: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Generate a scored, enriched, clustered feed for a user.

    Args:
        user_id:           The authenticated user's ID (used for interest lookup).
        source_filter:     Limit to one source type ('news', 'video', 'discussion').
        sort_by:           Sort order - 'relevance', 'recency', or 'popularity'.
        search_query:      Override interests with a manual search term.
        freshness_days:    If set, only keep items published in the last N days.
        weights_json:      The user's tuned component weights as a JSON string;
                           falls back to defaults when None or invalid.
        source_prefs_json: The user's tuned per-source preferences as a JSON
                           string; falls back to defaults when None or invalid.

    Returns:
        List of story dicts, each containing a list of enriched items.
    """
    if search_query:
        queries = [search_query]
        user_interests = search_query.lower().split()
    elif user_id is not None:
        rows = get_db().execute(
            "SELECT name, keywords_json FROM interests WHERE user_id = ?",
            [user_id],
        ).fetchall()
        queries = [r["name"] for r in rows] if rows else ["general news"]
        user_interests = []
        for r in rows:
            kws = json.loads(r["keywords_json"] or "[]")
            user_interests.extend(kws)
        if not user_interests:
            user_interests = queries  # use interest names as keywords
    else:
        queries = ["general news"]
        user_interests = queries
    raw_items: List[Dict[str, Any]] = []

    for q in queries:
        if not source_filter or source_filter == "news":
            raw_items.extend(
                _safe_fetch(fetch_gnews, q, f"gnews_{q}")
            )
        if not source_filter or source_filter == "video":
            raw_items.extend(
                _safe_fetch(fetch_youtube, q, f"youtube_{q}")
            )
        if not source_filter or source_filter == "discussion":
            raw_items.extend(
                _safe_fetch(fetch_lemmy, q, f"lemmy_{q}")
            )

    # drop anything older than the freshness window before doing any work
    if freshness_days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=freshness_days)
        raw_items = [
            it for it in raw_items if _within_window(it.get("published_at"), cutoff)
        ]

    enriched = []
    for item in raw_items:
        text = item.get("text", "")
        item["keywords"] = keywords(text)
        score, label = sentiment(text)
        item["sentiment_score"] = score
        item["sentiment"] = label
        item["credibility"] = credibility_tier(
            item.get("source_type", ""), item.get("source_name", "")
        )
        if item["source_type"] == "video":
            item["read_time"] = video_duration_minutes(
                item.get("iso_duration", "")
            )
        else:
            item["read_time"] = read_time(text)
        enriched.append(item)

    now = datetime.now(timezone.utc)
    # apply the user's tuned weights, falling back to defaults where unset
    weights = resolve_weights(weights_json, source_prefs_json)

    for item in enriched:
        score, _ = score_item(item, user_interests, weights, now)
        item["relevance_score"] = score

    stories = cluster_items(enriched, threshold=0.3)

    if sort_by == "recency":
        # newest story first, by the most recent item it contains
        stories.sort(
            key=lambda s: max(
                [it.get("published_at", "") for it in s.get("items", [])],
                default=""
            ),
            reverse=True
        )
    elif sort_by == "popularity":
        # most engaged story first, by its most popular item
        stories.sort(
            key=lambda s: max(
                [popularity(it.get("metrics", {}), it.get("source_type", ""))
                 for it in s.get("items", [])],
                default=0.0
            ),
            reverse=True
        )
    else:
        # default: highest relevance score first
        stories.sort(
            key=lambda s: max(
                [it.get("relevance_score", 0.0) for it in s.get("items", [])],
                default=0.0
            ),
            reverse=True
        )

    return stories
