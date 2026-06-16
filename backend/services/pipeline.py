"""Feed generation pipeline.

Orchestrates fetch → enrich → score → cluster across all sources.
Partial failures are handled gracefully — if one source is down the
pipeline continues with results from the remaining sources.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from backend.fetchers.gnews import fetch_gnews
from backend.fetchers.youtube import fetch_youtube
from backend.fetchers.reddit import fetch_reddit
from backend.services.cache import fetch_with_cache
from backend.services.fetchers.base import UpstreamError

from backend.services.enrich import (
    keywords, sentiment, credibility_tier,
    read_time, video_duration_minutes,
)
from backend.services.scoring import score_item
from backend.services.clustering import cluster_items


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
) -> List[Dict[str, Any]]:
    """Generate a scored, enriched, clustered feed for a user.

    Args:
        user_id:       The authenticated user's ID (used for interest lookup).
        source_filter: Limit to one source type ('news', 'video', 'discussion').
        sort_by:       Sort order — 'relevance' or 'recency'.
        search_query:  Override interests with a manual search term.

    Returns:
        List of story dicts, each containing a list of enriched items.
    """
    user_interests = ["artificial intelligence"]  # placeholder until DB ready
    source_prefs = {"news": 0.8, "video": 0.5, "discussion": 0.7}

    queries = [search_query] if search_query else user_interests
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
                _safe_fetch(fetch_reddit, q, f"reddit_{q}")
            )

    enriched = []
    for item in raw_items:
        text = item.get("text", "")
        item["keywords"] = keywords(text)
        item["sentiment"] = sentiment(text)[1]
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
    weights = {
        "interest": 0.4,
        "recency": 0.3,
        "popularity": 0.2,
        "source": 0.1,
        "source_prefs": source_prefs,
    }

    for item in enriched:
        score, _ = score_item(item, user_interests, weights, now)
        item["relevance_score"] = score

    stories = cluster_items(enriched, threshold=0.3)

    if sort_by == "recency":
        stories.sort(
            key=lambda s: max(
                [it.get("published_at", "") for it in s.get("items", [])],
                default=""
            ),
            reverse=True
        )
    else:
        stories.sort(
            key=lambda s: max(
                [it.get("relevance_score", 0.0) for it in s.get("items", [])],
                default=0.0
            ),
            reverse=True
        )

    return stories
