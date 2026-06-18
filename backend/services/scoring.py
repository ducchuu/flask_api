"""Relevance scoring for items: interest match, recency, popularity, source preference."""
import math
import re
from datetime import datetime
from typing import Any, Optional

from backend.services.enrich import STOPWORDS

# rough "very popular" engagement per source type, used to normalize scores to [0, 1]
POPULARITY_CEILING = {
    "news": 100_000,
    "video": 10_000_000,
    "discussion": 10_000,
}

# Scores for how well an interest phrase lands in an item, in priority order.
# A multi-word interest only earns a strong score when the whole phrase (or all
# its words) is present, so e.g. "video games" doesn't match a football story
# just because it mentions "games".
PHRASE_HIT = 1.0       # the exact phrase appears in the item text
ALL_WORDS_HIT = 0.8    # every significant word appears, but not adjacent
PARTIAL_FACTOR = 0.5   # partial overlap is scaled right down (1 of 2 words -> 0.25)


def _significant_words(text: Optional[str]) -> list[str]:
    """Lowercase tokens with stopwords and 1-char noise removed."""
    if not text:
        return []
    return [
        t for t in re.findall(r"[a-z0-9]+", text.lower())
        if t not in STOPWORDS and len(t) > 1
    ]


def interest_match(interest_keywords: list[str], item_keywords: list[str]) -> float:
    """calculate similarity between the user's interest keywords and the item's keywords.

    Legacy keyword-set Jaccard. Superseded by ``interest_relevance`` for feed
    scoring, but kept as a standalone utility.
    """
    if not interest_keywords or not item_keywords:
        return 0.0
    a = {w.lower() for w in interest_keywords}
    b = {w.lower() for w in item_keywords}
    intersection = a & b
    union = a | b
    if not union:
        return 0.0
    # jaccard overlap between the interest and item keywords
    return len(intersection) / len(union)


def interest_relevance(interest_terms: list[str], item: dict) -> float:
    """Score how relevant an item is to any of the user's interest phrases.

    Unlike ``interest_match`` this matches each (possibly multi-word) interest
    against the item's full text - title, summary and body - plus its extracted
    keywords, so multi-word topics like "video games" are handled precisely.

    Returns the best score across all interest terms, in [0, 1].
    """
    corpus_text = " ".join(
        str(item.get(field, "") or "") for field in ("title", "summary", "text")
    ).lower()
    corpus_words = set(_significant_words(corpus_text))
    corpus_words.update(k.lower() for k in (item.get("keywords") or []))
    if not corpus_words or not interest_terms:
        return 0.0

    best = 0.0
    for term in interest_terms:
        words = _significant_words(term)
        if not words:
            continue
        # exact phrase is the strongest signal (only meaningful for multi-word)
        if len(words) > 1 and term.strip().lower() in corpus_text:
            best = max(best, PHRASE_HIT)
            continue
        matched = sum(1 for w in words if w in corpus_words)
        if matched == len(words):
            # every word present: full credit for single-word, near-full for multi
            best = max(best, PHRASE_HIT if len(words) == 1 else ALL_WORDS_HIT)
        else:
            best = max(best, (matched / len(words)) * PARTIAL_FACTOR)
    return best


def recency_decay(published_at: datetime, now: datetime, half_life_hours: float = 24.0) -> float:
    """Exponential decay based on item age with a 24-hour half-life; future timestamps score 1.0"""
    delta = (now - published_at).total_seconds()
    if delta <= 0:
        return 1.0
    hours = delta / 3600.0
    # halves once per half-life, so 24h -> 0.5, 48h -> 0.25, etc.
    return 0.5 ** (hours / half_life_hours)


def popularity(metrics: dict, source_type: str) -> float:
    """log-scale engagement metrics into a [0, 1] popularity score per source type"""
    if not metrics:
        return 0.0
    # each source type measures engagement with a different metric
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
    # log scale against a per-type ceiling so a few viral items don't dominate
    ceiling = POPULARITY_CEILING.get(source_type, 10_000)
    score = math.log10(1 + raw) / math.log10(1 + ceiling)
    return max(0.0, min(1.0, score))


def source_pref(source_type: str, prefs: dict) -> float:
    """Return the user's preference for a source type, clamped to [0, 1] (default 0.5 if missing)"""
    if source_type not in prefs:
        return 0.5
    value = prefs[source_type]
    return max(0.0, min(1.0, float(value)))


def _parse_published(value: Any) -> Optional[datetime]:
    """parse an ISO-8601 string into a datetime, or return None on bad input"""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def score_item(item: dict, interest_keywords: list[str], weights: dict, now: datetime) -> tuple[float, dict]:
    """Compute the weighted relevance score for an item and return (score, breakdown).

    ``interest_keywords`` is the user's list of interest phrases (each may be
    multi-word); the interest component matches them against the item's text.
    """
    source_type = item.get("source_type", "")
    metrics = item.get("metrics", {}) or {}
    published_at = _parse_published(item.get("published_at"))

    # score each component on its own [0, 1] scale; missing date -> no recency
    breakdown = {
        "interest": interest_relevance(interest_keywords, item),
        "recency": recency_decay(published_at, now) if published_at else 0.0,
        "popularity": popularity(metrics, source_type),
        "source": source_pref(source_type, weights.get("source_prefs", {})),
    }
    # combine the components as a weighted sum, then clamp to [0, 1]
    score = (
        breakdown["interest"] * weights.get("interest", 0.0)
        + breakdown["recency"] * weights.get("recency", 0.0)
        + breakdown["popularity"] * weights.get("popularity", 0.0)
        + breakdown["source"] * weights.get("source", 0.0)
    )
    return max(0.0, min(1.0, score)), breakdown
