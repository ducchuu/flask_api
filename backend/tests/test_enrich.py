"""Unit tests for the enrichment service (read time, sentiment, keywords, credibility)."""
from backend.services import enrich


class TestReadTime:
    """Tests for read_time estimation from article text."""

    def test_basic_text(self) -> None:
        """400 words at 200 wpm should be 2 minutes."""
        text = " ".join(["word"] * 400)
        assert enrich.read_time(text) == 2

    def test_empty_text(self) -> None:
        """Empty string has no read time."""
        assert enrich.read_time("") == 0

    def test_short_text_rounds_up_to_one(self) -> None:
        """Any non-empty text should be at least 1 minute."""
        assert enrich.read_time("hello world") == 1

    def test_none_text(self) -> None:
        """None input is treated as no text."""
        assert enrich.read_time(None) == 0


class TestVideoDuration:
    """Tests for parsing ISO-8601 video durations into minutes."""

    def test_minutes_and_seconds(self) -> None:
        """5m30s rounds up to 6 minutes."""
        assert enrich.video_duration_minutes("PT5M30S") == 6

    def test_only_seconds(self) -> None:
        """Sub-minute clip rounds up to 1 minute."""
        assert enrich.video_duration_minutes("PT45S") == 1

    def test_hours(self) -> None:
        """Hours component is included."""
        assert enrich.video_duration_minutes("PT1H2M") == 62

    def test_zero(self) -> None:
        """Zero-length video has zero minutes."""
        assert enrich.video_duration_minutes("PT0S") == 0

    def test_invalid(self) -> None:
        """Malformed string returns zero, not an error."""
        assert enrich.video_duration_minutes("garbage") == 0

    def test_none(self) -> None:
        """None input returns zero."""
        assert enrich.video_duration_minutes(None) == 0


class TestSentiment:
    """Tests for the lexicon-based sentiment scorer."""

    def test_positive(self) -> None:
        """Positive words push the score above zero."""
        score, label = enrich.sentiment("This is great and wonderful and amazing")
        assert score > 0
        assert label == "positive"

    def test_negative(self) -> None:
        """Negative words push the score below zero."""
        score, label = enrich.sentiment("This is terrible awful horrible and bad")
        assert score < 0
        assert label == "negative"

    def test_neutral(self) -> None:
        """Text without sentiment words is neutral."""
        score, label = enrich.sentiment("the cat sat on the mat")
        assert score == 0.0
        assert label == "neutral"

    def test_empty(self) -> None:
        """Empty text is neutral."""
        score, label = enrich.sentiment("")
        assert score == 0.0
        assert label == "neutral"

    def test_bounds(self) -> None:
        """Score must always be clamped to [-1, 1]."""
        score, _ = enrich.sentiment("great " * 1000)
        assert -1.0 <= score <= 1.0

    def test_case_insensitive(self) -> None:
        """Uppercase words still count toward sentiment."""
        _, label = enrich.sentiment("GREAT AMAZING WONDERFUL")
        assert label == "positive"


class TestKeywords:
    """Tests for keyword extraction via frequency after stopword removal."""

    def test_basic_extraction(self) -> None:
        """Most frequent non-stopwords are returned."""
        text = "python python python flask flask django"
        result = enrich.keywords(text, top_n=2)
        assert "python" in result
        assert "flask" in result

    def test_removes_stopwords(self) -> None:
        """Common stopwords are excluded from results."""
        text = "the and of in on for python flask"
        result = enrich.keywords(text, top_n=5)
        assert "the" not in result
        assert "and" not in result
        assert "python" in result

    def test_empty_text(self) -> None:
        """Empty text yields an empty list."""
        assert enrich.keywords("", top_n=5) == []

    def test_top_n_limit(self) -> None:
        """Result length never exceeds top_n."""
        text = "a1 a1 b2 b2 c3 c3 d4 d4"
        result = enrich.keywords(text, top_n=2)
        assert len(result) == 2

    def test_case_insensitive(self) -> None:
        """Different cases collapse to the same keyword."""
        result = enrich.keywords("Python PYTHON python", top_n=1)
        assert result == ["python"]

    def test_ignores_punctuation(self) -> None:
        """Punctuation is stripped before counting."""
        result = enrich.keywords("hello, world! hello.", top_n=2)
        assert "hello" in result
        assert "world" in result


class TestCredibilityTier:
    """Tests for the static credibility tier lookup per source type."""

    def test_known_high_news(self) -> None:
        """A trusted news domain maps to high."""
        assert enrich.credibility_tier("news", "bbc.com") == "high"

    def test_news_full_url_reduced_to_domain(self) -> None:
        """a full news url is cleaned down to its registered domain before lookup"""
        # proves the tldextract-based normalization, not just bare-domain matching
        assert enrich.credibility_tier(
            "news", "https://www.bbc.com/news/world-12345"
        ) == "high"

    def test_known_medium_news(self) -> None:
        """A second-tier news domain maps to medium."""
        assert enrich.credibility_tier("news", "techcrunch.com") == "medium"

    def test_unknown_source(self) -> None:
        """An unrecognised source falls back to unknown."""
        assert enrich.credibility_tier("news", "somerandomblog.xyz") == "unknown"

    def test_video_known(self) -> None:
        """A known video channel maps to its tier."""
        assert enrich.credibility_tier("video", "BBC News") == "high"

    def test_discussion_known(self) -> None:
        """A known subreddit maps to its tier."""
        assert enrich.credibility_tier("discussion", "askscience") == "high"

    def test_discussion_unknown(self) -> None:
        """An unknown subreddit returns unknown."""
        assert enrich.credibility_tier("discussion", "randomsub") == "unknown"

    def test_empty_name(self) -> None:
        """Empty source name returns unknown."""
        assert enrich.credibility_tier("news", "") == "unknown"

    def test_unknown_type(self) -> None:
        """Unsupported source_type returns unknown."""
        assert enrich.credibility_tier("weird", "bbc.com") == "unknown"
