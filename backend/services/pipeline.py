"""Feed generation pipeline.

Orchestrates fetch → enrich → score → cluster across all sources.
Partial failures are handled gracefully - if one source is down the
pipeline continues with results from the remaining sources.
"""

import json
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from flask import has_app_context

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

# How user feedback nudges the relevance score. Each item keyword that overlaps
# with a topic the user asked "more"/"less" of shifts the score by FEEDBACK_STEP,
# capped at FEEDBACK_MAX_SHIFT so feedback only nudges the ranking, never
# dominates the four scored components.
FEEDBACK_STEP = 0.05
FEEDBACK_MAX_SHIFT = 0.15

# Feed selection thresholds. These decide which fetched items actually make the
# feed; tune them against real data (lower for a fuller feed, raise to be
# stricter).
INTEREST_RELEVANCE_FLOOR = 0.3   # below this an item is treated as off-topic
SUBSTANCE_MIN_WORDS = 6          # body word-count needed to count as substantive
MIN_FEED_ITEMS = 5               # safety floor so the feed is never left empty

# Most interests that drive a single feed fetch. Beyond this the combined query
# gets unwieldy and per-topic results get too thin, so we use the first N.
MAX_FEED_TOPICS = 10

# Tiny set of very common English words used as a cheap language signal.
_COMMON_EN = {
    "the", "a", "an", "and", "or", "to", "of", "in", "is", "are", "for", "on",
    "with", "that", "this", "it", "as", "at", "by", "you", "we", "be", "how",
    "what", "why", "new", "from", "has", "have", "will", "your", "about",
}


def _looks_english(text: Optional[str]) -> bool:
    """Cheap heuristic to keep English content (Lemmy has no language filter).

    Drops text written in a non-Latin script, or Latin-script text (e.g.
    German/Spanish) that contains none of the most common English words. Short
    or empty text is kept, since there isn't enough signal to judge.
    """
    if not text or not text.strip():
        return True
    letters = [c for c in text if c.isalpha()]
    if letters:
        latin = sum(1 for c in letters if ord(c) < 0x250)  # Latin + accents
        if latin / len(letters) < 0.65:
            return False
    words = re.findall(r"[a-zA-Z]+", text.lower())
    if len(words) >= 6:
        return any(w in _COMMON_EN for w in words)
    return True


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


def _load_feedback_signals(user_id: int) -> Dict[str, Any]:
    """Turn a user's stored feedback into signals the feed can act on.

    Joins feedback back to the persisted item it refers to so we can read its
    external id (for hiding) and its title (to learn topics from).

    Returns a dict with:
        hidden_ids:  external ids the user asked to hide -> dropped from the feed.
        liked_kw:    keywords drawn from items the user wanted more of.
        disliked_kw: keywords drawn from items the user wanted less of.
    """
    rows = get_db().execute(
        "SELECT i.external_id AS external_id, i.title AS title, f.kind AS kind "
        "FROM feedback f JOIN items i ON f.item_id = i.id "
        "WHERE f.user_id = ?",
        [user_id],
    ).fetchall()

    hidden_ids: set = set()
    liked_kw: set = set()
    disliked_kw: set = set()
    for r in rows:
        if r["kind"] == "hide":
            if r["external_id"]:
                hidden_ids.add(str(r["external_id"]))
        elif r["kind"] == "more":
            liked_kw.update(keywords(r["title"]))
        elif r["kind"] == "less":
            disliked_kw.update(keywords(r["title"]))
    return {"hidden_ids": hidden_ids, "liked_kw": liked_kw, "disliked_kw": disliked_kw}


def _feedback_shift(item_keywords: List[str], liked_kw: set, disliked_kw: set) -> float:
    """Net relevance adjustment for one item from like/dislike keyword overlap.

    Each shared keyword moves the score by FEEDBACK_STEP; boost and penalty are
    each capped at FEEDBACK_MAX_SHIFT, so the result stays in
    [-FEEDBACK_MAX_SHIFT, +FEEDBACK_MAX_SHIFT].
    """
    kw = set(item_keywords)
    boost = min(len(kw & liked_kw) * FEEDBACK_STEP, FEEDBACK_MAX_SHIFT)
    penalty = min(len(kw & disliked_kw) * FEEDBACK_STEP, FEEDBACK_MAX_SHIFT)
    return boost - penalty


def _has_substance(item: Dict[str, Any]) -> bool:
    """Whether an item has enough content to be worth showing.

    Keeps items with a reasonably long body, or a short one that's backed by
    real engagement; drops empty-body stubs (common from Lemmy) and
    contentless videos.
    """
    body = item.get("summary") or item.get("text") or ""
    if len(body.split()) >= SUBSTANCE_MIN_WORDS:
        return True
    return popularity(item.get("metrics", {}) or {}, item.get("source_type", "")) > 0


def _select_items(items: List[Dict[str, Any]], drop_off_topic: bool) -> List[Dict[str, Any]]:
    """Keep substantive items, with a safety floor.

    Thin items are always dropped. When ``drop_off_topic`` is set (an explicit
    search / single-interest focus) items below INTEREST_RELEVANCE_FLOOR are
    dropped too, for precision. The default multi-interest feed leaves off-topic
    items in and lets ranking sink them, so it stays full. If selection leaves
    fewer than MIN_FEED_ITEMS, the best of the dropped items (by relevance score)
    are added back so the feed is never needlessly empty.
    """
    keep: List[Dict[str, Any]] = []
    dropped: List[Dict[str, Any]] = []
    for it in items:
        on_topic = (not drop_off_topic) or it.get("_interest", 0.0) >= INTEREST_RELEVANCE_FLOOR
        (keep if (_has_substance(it) and on_topic) else dropped).append(it)

    if len(keep) < MIN_FEED_ITEMS and dropped:
        dropped.sort(key=lambda it: it.get("relevance_score", 0.0), reverse=True)
        keep.extend(dropped[: MIN_FEED_ITEMS - len(keep)])

    for it in keep:
        it.pop("_interest", None)  # internal-only signal, don't leak to the API
    return keep


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
    # interest_terms are the (possibly multi-word) phrases an item is scored
    # against (the search term, or the user's interest names).
    if search_query:
        queries = interest_terms = [search_query]
    elif user_id is not None:
        rows = get_db().execute(
            "SELECT name FROM interests WHERE user_id = ?",
            [user_id],
        ).fetchall()
        queries = interest_terms = [r["name"] for r in rows] if rows else ["general news"]
    else:
        queries = interest_terms = ["general news"]

    # Past feedback (hide / more / less) for this user, used to drop hidden
    # items and nudge the score of items on topics they've reacted to. Needs a
    # DB connection, so only when we're inside an app context (always true for a
    # real request; skipped by context-free unit tests that drive the pipeline
    # directly).
    feedback = (
        _load_feedback_signals(user_id)
        if user_id is not None and has_app_context()
        else {"hidden_ids": set(), "liked_kw": set(), "disliked_kw": set()}
    )

    raw_items: List[Dict[str, Any]] = []

    # Combine the user's interests into ONE OR-query per source. Firing one
    # request per interest trips the free-tier burst limits, so a single query
    # keeps the feed to ~3 requests total regardless of how many topics the
    # user follows (no pre-warming needed). We cap the number of topics that
    # drive fetching so the query stays a sane length and results aren't spread
    # too thin; quotes are stripped so an odd custom topic can't break the query.
    fetch_topics = [q.replace('"', "").strip() for q in queries[:MAX_FEED_TOPICS]]
    fetch_topics = [q for q in fetch_topics if q] or ["news"]
    combined = " OR ".join(f'"{q}"' for q in fetch_topics)

    if not source_filter or source_filter == "news":
        raw_items.extend(_safe_fetch(fetch_gnews, combined, f"gnews_{combined}"))
    if not source_filter or source_filter == "video":
        raw_items.extend(_safe_fetch(fetch_youtube, combined, f"youtube_{combined}"))
    if not source_filter or source_filter == "discussion":
        # Lemmy's search doesn't understand the OR-syntax (it treats it as
        # literal text) and it's keyless anyway, so query it per topic.
        for q in fetch_topics:
            raw_items.extend(_safe_fetch(fetch_lemmy, q, f"lemmy_{q}"))

    # keep only English-looking items. GNews/YouTube are queried with an English
    # language hint, but Lemmy has no such filter, so drop obviously non-English
    # posts (judged on the title).
    raw_items = [it for it in raw_items if _looks_english(it.get("title", ""))]

    # drop items the user explicitly hid (matched on external id)
    if feedback["hidden_ids"]:
        raw_items = [
            it for it in raw_items
            if str(it.get("external_id", "")) not in feedback["hidden_ids"]
        ]

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
        score, breakdown = score_item(item, interest_terms, weights, now)
        # keep the interest component around for the off-topic filter below
        item["_interest"] = breakdown["interest"]
        # nudge by past feedback on this topic, keeping the score in [0, 1]
        score += _feedback_shift(
            item.get("keywords", []), feedback["liked_kw"], feedback["disliked_kw"]
        )
        item["relevance_score"] = max(0.0, min(1.0, score))

    # Drop thin items always; drop off-topic ones only when the user has
    # explicitly focused the feed (search box or a single chosen interest), so
    # the default multi-interest feed stays full and relies on ranking.
    selected = _select_items(enriched, drop_off_topic=bool(search_query))

    stories = cluster_items(selected, threshold=0.3)

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
