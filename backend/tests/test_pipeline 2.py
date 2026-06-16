import pytest
from unittest.mock import patch, call
from backend.services.pipeline import (
    generate_feed,
    resolve_weights,
    DEFAULT_WEIGHTS,
    DEFAULT_SOURCE_PREFS,
)


def _make_raw_item(source_type="news", source_name="Tech Site", title="AI News",
                   text="Text about artificial intelligenceg",
                   published_at="2026-01-01T12:00:00+00:00", **extra):
    """
    helper for building dictionary
    """
    item = {
        "id": "item-1",
        "source_type": source_type,
        "source_name": source_name,
        "title": title,
        "text": text,
        "published_at": published_at,
        "metrics": {"shares": 100},
    }
    item.update(extra)
    return item


@patch('backend.services.pipeline.fetch_with_cache')
def test_generate_feed_orchestrates_data(mock_fetch):
    """
    checks if pipeline correctly generaties and gives scoring
    """
    mock_fetch.return_value = [_make_raw_item()]

    stories = generate_feed(user_id=1, search_query="python")

    assert isinstance(stories, list)
    assert len(stories) > 0

    first_story_items = stories[0].get("items", [])
    assert len(first_story_items) > 0
    assert "relevance_score" in first_story_items[0]
    assert "sentiment" in first_story_items[0]

@patch('backend.services.pipeline.fetch_with_cache')
def test_pipeline_adds_all_enrichment_keys(mock_fetch):
    """
    checkin if enrich module gives keywords, sentiment, credibility and read_time to every item
    """
    mock_fetch.return_value = [_make_raw_item()]

    stories = generate_feed(user_id=1, search_query="test")
    item = stories[0]["items"][0]

    assert "keywords" in item
    assert isinstance(item["keywords"], list)
    assert "sentiment" in item
    assert isinstance(item["sentiment"], str)
    assert item["sentiment"] in ("positive", "negative", "neutral")
    assert "credibility" in item
    assert "read_time" in item
    assert isinstance(item["read_time"], int)

@patch('backend.services.pipeline.fetch_with_cache')
def test_relevance_score_is_between_0_and_1(mock_fetch):
    """
    relevance scores should be within [0,1
    ]"""
    mock_fetch.return_value = [_make_raw_item()]

    stories = generate_feed(user_id=1, search_query="test")

    for story in stories:
        for item in story["items"]:
            assert 0.0 <= item["relevance_score"] <= 1.0


@patch('backend.services.pipeline.fetch_with_cache')
def test_source_filter_news_only_calls_gnews(mock_fetch):
    """
    checking if "news" filter is called then only gnews fetcher should be done
    """
    mock_fetch.return_value = [_make_raw_item()]

    generate_feed(user_id=1, source_filter="news", search_query="test")

    assert mock_fetch.call_count == 1
    cache_key = mock_fetch.call_args_list[0][0][0]
    assert cache_key.startswith("gnews_")


@patch('backend.services.pipeline.fetch_with_cache')
def test_source_filter_video_only_calls_youtube(mock_fetch):
    """
    the same for "video" filter, only youtube fetcher should be called
    """
    mock_fetch.return_value = [_make_raw_item(source_type="video")]

    generate_feed(user_id=1, source_filter="video", search_query="test")

    assert mock_fetch.call_count == 1
    cache_key = mock_fetch.call_args_list[0][0][0]
    assert cache_key.startswith("youtube_")


@patch('backend.services.pipeline.fetch_with_cache')
def test_source_filter_discussion_only_calls_reddit(mock_fetch):
    """
    and also same for reddit and "discussion" filter
    """
    mock_fetch.return_value = [_make_raw_item(source_type="discussion")]

    generate_feed(user_id=1, source_filter="discussion", search_query="test")

    assert mock_fetch.call_count == 1
    cache_key = mock_fetch.call_args_list[0][0][0]
    assert cache_key.startswith("reddit_")


@patch('backend.services.pipeline.fetch_with_cache')
def test_no_source_filter_calls_all_three(mock_fetch):
    """
    when no filter is specified then all 3 fetchers should be called
    """
    mock_fetch.return_value = []

    generate_feed(user_id=1, search_query="test")

    assert mock_fetch.call_count == 3
    cache_keys = [c[0][0] for c in mock_fetch.call_args_list]
    assert any(k.startswith("gnews_") for k in cache_keys)
    assert any(k.startswith("youtube_") for k in cache_keys)
    assert any(k.startswith("reddit_") for k in cache_keys)


@patch('backend.services.pipeline.fetch_with_cache')
def test_sort_by_recency(mock_fetch):
    """
    checkin if the sorting of stories is correct
    """
    mock_fetch.return_value = [
        _make_raw_item(id="old", published_at="2025-01-01T00:00:00+00:00", text="old article about tech"),
        _make_raw_item(id="new", published_at="2026-06-01T00:00:00+00:00", text="new article about tech"),
    ]

    stories = generate_feed(user_id=1, sort_by="recency", search_query="test")

    all_dates = []
    for story in stories:
        max_date = max(it.get("published_at", "") for it in story["items"])
        all_dates.append(max_date)
    assert all_dates == sorted(all_dates, reverse=True)



@patch('backend.services.pipeline.fetch_with_cache')
def test_empty_fetch_returns_empty_stories(mock_fetch):
    """
    checking if all fetchers return empty, then the whole pipeline should return an empty list
    """
    mock_fetch.return_value = []

    stories = generate_feed(user_id=1, search_query="empty query no content")

    assert isinstance(stories, list)
    assert len(stories) == 0


@patch('backend.services.pipeline.fetch_with_cache')
def test_search_query_overrides_default_interests(mock_fetch):
    """
    a search query should be used and cached, not the earlier hardoded test "artifical intelligence"
    """
    mock_fetch.return_value = []

    generate_feed(user_id=1, search_query="quantum computing")

    for c in mock_fetch.call_args_list:
        cache_key = c[0][0]
        assert "quantum computing" in cache_key
        assert "artificial intelligence" not in cache_key


@patch('backend.services.pipeline.fetch_with_cache')
def test_freshness_window_drops_old_items(mock_fetch):
    """
    items older than the freshness window should be filtered out
    """
    mock_fetch.return_value = [
        _make_raw_item(id="old", published_at="2000-01-01T00:00:00+00:00",
                       text="very old article about tech"),
    ]

    stories = generate_feed(user_id=1, search_query="test", freshness_days=7)

    assert stories == []


@patch('backend.services.pipeline.fetch_with_cache')
def test_sort_by_popularity(mock_fetch):
    """
    with popularity sorting the most engaged story should come first
    """
    # different keywords so the two items land in separate stories
    mock_fetch.return_value = [
        _make_raw_item(id="quiet", text="gardening tips beginners roses",
                       metrics={"shares": 1}),
        _make_raw_item(id="viral", text="spacecraft rocket launch orbit",
                       metrics={"shares": 90000}),
    ]

    stories = generate_feed(user_id=1, sort_by="popularity", search_query="test")

    # the viral item's story should be ranked ahead of the quiet one
    ids = [it["id"] for s in stories for it in s["items"]]
    assert ids.index("viral") < ids.index("quiet")


@patch('backend.services.pipeline.fetch_with_cache')
def test_video_items_use_duration_for_read_time(mock_fetch):
    """
    checking if item is used correctly so that is duration is used for read_time, not counting words
    """
    mock_fetch.return_value = [_make_raw_item(
        source_type="video",
        text="Short description",
        iso_duration="PT10M30S",
    )]

    stories = generate_feed(user_id=1, source_filter="video", search_query="test")

    item = stories[0]["items"][0]
    # PT10M30S = 10.5 minutes, rounded up = 11
    assert item["read_time"] == 11