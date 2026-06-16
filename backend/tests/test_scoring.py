"""Unit tests for the relevance scoring service."""
from datetime import datetime, timedelta, timezone

from backend.services import scoring


# fixed "current time" so recency-based tests are deterministic
NOW = datetime(2026, 6, 11, 12, 0, 0, tzinfo=timezone.utc)

# sample weights that sum to 1.0, mirroring a realistic scoring config
DEFAULT_WEIGHTS = {
    "interest": 0.4,
    "recency": 0.3,
    "popularity": 0.2,
    "source": 0.1,
}


def make_item(
    keywords: list[str] | None = None,
    published_at: datetime | None = None,
    metrics: dict | None = None,
    source_type: str = "news",
) -> dict:
    """Build a minimal item dict for use in scoring tests."""
    return {
        "keywords": keywords if keywords is not None else [],
        "published_at": (published_at or NOW).isoformat(),
        "metrics": metrics or {},
        "source_type": source_type,
    }


class TestInterestMatch:
    """Tests for keyword-overlap component of the relevance score."""

    def test_full_match(self) -> None:
        """All interest keywords present gives a score of 1.0."""
        assert scoring.interest_match(["python", "flask"], ["python", "flask"]) == 1.0

    def test_no_match(self) -> None:
        """No overlap gives a score of 0.0."""
        assert scoring.interest_match(["python"], ["rust"]) == 0.0

    def test_partial_match(self) -> None:
        """Partial overlap is between 0 and 1."""
        result = scoring.interest_match(["python", "django"], ["python", "flask"])
        assert 0.0 < result < 1.0

    def test_empty_interest(self) -> None:
        """No interests defined yields neutral 0.0."""
        assert scoring.interest_match([], ["python"]) == 0.0

    def test_empty_item_keywords(self) -> None:
        """Item with no keywords cannot match."""
        assert scoring.interest_match(["python"], []) == 0.0

    def test_case_insensitive(self) -> None:
        """Matching is case insensitive."""
        assert scoring.interest_match(["Python"], ["PYTHON"]) == 1.0


class TestRecency:
    """Tests for exponential recency decay (half-life 24h)."""

    def test_just_published(self) -> None:
        """An item published right now scores 1.0."""
        assert scoring.recency_decay(NOW, NOW) == 1.0

    def test_one_half_life(self) -> None:
        """After 24 hours the score is 0.5."""
        published = NOW - timedelta(hours=24)
        assert abs(scoring.recency_decay(published, NOW) - 0.5) < 1e-6

    def test_two_half_lives(self) -> None:
        """After 48 hours the score is 0.25."""
        published = NOW - timedelta(hours=48)
        assert abs(scoring.recency_decay(published, NOW) - 0.25) < 1e-6

    def test_future_timestamp_clamped(self) -> None:
        """A timestamp in the future is treated as just published."""
        published = NOW + timedelta(hours=5)
        assert scoring.recency_decay(published, NOW) == 1.0

    def test_very_old(self) -> None:
        """Old items decay toward zero but stay non-negative."""
        published = NOW - timedelta(days=365)
        result = scoring.recency_decay(published, NOW)
        assert 0.0 <= result < 0.01


class TestPopularity:
    """Tests for log-scaled popularity per source type."""

    def test_zero_metrics(self) -> None:
        """An item with no engagement scores 0.0."""
        assert scoring.popularity({"views": 0}, "video") == 0.0

    def test_returns_in_range(self) -> None:
        """Result is always within [0, 1]."""
        assert 0.0 <= scoring.popularity({"views": 1_000_000}, "video") <= 1.0

    def test_more_is_higher(self) -> None:
        """More engagement scores higher than less engagement."""
        low = scoring.popularity({"views": 100}, "video")
        high = scoring.popularity({"views": 100_000}, "video")
        assert high > low

    def test_news_uses_shares(self) -> None:
        """News popularity uses share count."""
        assert scoring.popularity({"shares": 5000}, "news") > 0.0

    def test_discussion_uses_upvotes(self) -> None:
        """Discussion popularity uses upvotes plus comments."""
        assert scoring.popularity({"upvotes": 500, "comments": 100}, "discussion") > 0.0

    def test_missing_metrics(self) -> None:
        """Missing engagement metrics score 0.0 without error."""
        assert scoring.popularity({}, "news") == 0.0


class TestSourcePref:
    """Tests for the user's per-source-type preference component."""

    def test_preferred_source(self) -> None:
        """A preferred source type scores 1.0."""
        prefs = {"news": 1.0, "video": 0.0, "discussion": 0.5}
        assert scoring.source_pref("news", prefs) == 1.0

    def test_disliked_source(self) -> None:
        """A disliked source type scores 0.0."""
        prefs = {"news": 1.0, "video": 0.0, "discussion": 0.5}
        assert scoring.source_pref("video", prefs) == 0.0

    def test_unknown_source_neutral(self) -> None:
        """Missing preference defaults to neutral 0.5."""
        assert scoring.source_pref("video", {}) == 0.5

    def test_clamped(self) -> None:
        """Out-of-range preferences are clamped into [0, 1]."""
        assert scoring.source_pref("news", {"news": 5.0}) == 1.0
        assert scoring.source_pref("news", {"news": -3.0}) == 0.0


class TestScoreItem:
    """Tests for the top-level score_item function combining all components."""

    def test_returns_score_and_breakdown(self) -> None:
        """score_item returns a numeric score and a dict breakdown"""
        item = make_item(keywords=["python"], metrics={"shares": 10})
        score, breakdown = scoring.score_item(
            item, ["python"], DEFAULT_WEIGHTS, now=NOW
        )
        assert isinstance(score, float)
        assert isinstance(breakdown, dict)
        assert {"interest", "recency", "popularity", "source"} <= breakdown.keys()

    def test_score_in_range(self) -> None:
        """the combined score stays within [0, 1] even for high engagement"""
        item = make_item(
            keywords=["python", "flask"], metrics={"shares": 1000}
        )
        score, _ = scoring.score_item(
            item, ["python", "flask"], DEFAULT_WEIGHTS, now=NOW
        )
        assert 0.0 <= score <= 1.0

    def test_breakdown_sums_to_score(self) -> None:
        """The weighted breakdown components sum to the total score"""
        item = make_item(
            keywords=["python"],
            metrics={"shares": 500},
            published_at=NOW - timedelta(hours=12),
        )
        score, breakdown = scoring.score_item(
            item, ["python"], DEFAULT_WEIGHTS, now=NOW
        )
        total = (
            breakdown["interest"] * DEFAULT_WEIGHTS["interest"]
            + breakdown["recency"] * DEFAULT_WEIGHTS["recency"]
            + breakdown["popularity"] * DEFAULT_WEIGHTS["popularity"]
            + breakdown["source"] * DEFAULT_WEIGHTS["source"]
        )
        assert abs(score - total) < 1e-6

    def test_zero_weights(self) -> None:
        """all-zero weights produce a zero score"""
        item = make_item(keywords=["python"], metrics={"shares": 1000})
        zero_weights = {"interest": 0.0, "recency": 0.0, "popularity": 0.0, "source": 0.0}
        score, _ = scoring.score_item(item, ["python"], zero_weights, now=NOW)
        assert score == 0.0

    def test_missing_fields_safe(self) -> None:
        """an item missing optional fields still produces a valid score."""
        item = {"source_type": "news"}
        score, breakdown = scoring.score_item(
            item, ["python"], DEFAULT_WEIGHTS, now=NOW
        )
        assert 0.0 <= score <= 1.0
        assert breakdown["interest"] == 0.0
        assert breakdown["popularity"] == 0.0

    def test_malformed_published_at(self) -> None:
        """a malformed published_at is treated as fully decayed (recency score 0.0) but doesn't cause an error."""
        item = {"source_type": "news", "published_at": "not-a-date"}
        score, breakdown = scoring.score_item(
            item, ["python"], DEFAULT_WEIGHTS, now=NOW
        )
        assert breakdown["recency"] == 0.0
        assert 0.0 <= score <= 1.0

