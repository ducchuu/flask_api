"""Enrichment functions for items: read time, sentiment, keywords, credibility tier."""
import math
import re
from collections import Counter
from typing import Optional

import isodate
import tldextract
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

WORDS_PER_MINUTE = 200

# a simple set of common English stopwords to exclude from keyword extraction, I hardcoded this to avoid adding a dependency on nltk or similar libraries
STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "in", "on", "for", "to",
    "is", "are", "was", "were", "be", "been", "being", "this", "that",
    "these", "those", "it", "its", "as", "at", "by", "with", "from",
    "i", "you", "he", "she", "we", "they", "them", "their", "our",
    "do", "does", "did", "has", "have", "had", "not", "no", "so",
    "if", "then", "than", "there", "here", "what", "which", "who",
    "will", "would", "can", "could", "should", "about",
}

NEWS_TIERS = {
    "bbc.com": "high",
    "reuters.com": "high",
    "nytimes.com": "high",
    "theguardian.com": "high",
    "apnews.com": "high",
    "techcrunch.com": "medium",
    "theverge.com": "medium",
    "wired.com": "medium",
    "arstechnica.com": "medium",
}

VIDEO_TIERS = {
    "bbc news": "high",
    "reuters": "high",
    "ap archive": "high",
    "ted": "medium",
    "vox": "medium",
}

DISCUSSION_TIERS = {
    "askscience": "high",
    "science": "high",
    "worldnews": "medium",
    "technology": "medium",
    "programming": "medium",
}

_analyzer = SentimentIntensityAnalyzer()


def read_time(text: Optional[str]) -> int:
    """Estimate reading time in minutes from text length (at an assumed rate of 200 words per minute)"""
    if not text:
        return 0
    words = len(text.split())
    if words == 0:
        return 0
    return max(1, math.ceil(words / WORDS_PER_MINUTE))


def video_duration_minutes(iso_duration: Optional[str]) -> int:
    """Convert an ISO-8601(this is a duration like 'PT1H2M30S' - which represents 1 hour, 2 minutes, and 30 seconds) to whole minutes (rounded up)."""
    if not iso_duration:
        return 0
    try:
        seconds = isodate.parse_duration(iso_duration).total_seconds()
    except (isodate.ISO8601Error, AttributeError, ValueError):
        return 0
    if seconds <= 0:
        return 0
    return max(1, math.ceil(seconds / 60))


def sentiment(text: Optional[str]) -> tuple[float, str]:
    """Score text sentiment in [-1, 1] using VADER and return (compound_score, label)."""
    if not text or not text.strip():
        return 0.0, "neutral"
    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]
    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"
    return compound, label


def keywords(text: Optional[str], top_n: int = 5) -> list[str]:
    """Return the top_n most frequent non-stopword tokens from the text."""
    if not text:
        return []
    tokens = [t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in STOPWORDS]
    if not tokens:
        return []
    counts = Counter(tokens)
    return [word for word, _ in counts.most_common(top_n)]


def _normalize_source_name(source_type: str, source_name: str) -> str:
    """Lowercase and, for news sources, reduce a URL or host string to its registered domain."""
    name = source_name.strip().lower()
    if source_type == "news":
        extracted = tldextract.extract(name)
        if extracted.domain and extracted.suffix:
            return f"{extracted.domain}.{extracted.suffix}"
    return name


def credibility_tier(source_type: str, source_name: Optional[str]) -> str:
    """ Map a source to a credibility tier ('high', 'medium', 'unknown')"""
    if not source_name:
        return "unknown"
    name = _normalize_source_name(source_type, source_name)
    if source_type == "news":
        return NEWS_TIERS.get(name, "unknown")
    if source_type == "video":
        return VIDEO_TIERS.get(name, "unknown")
    if source_type == "discussion":
        return DISCUSSION_TIERS.get(name, "unknown")
    return "unknown"
