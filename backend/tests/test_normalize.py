import pytest
from typing import Dict, Any
from backend.fetchers.normalize import normalize_lemmy, normalize_youtube, normalize_gnews

def test_normalize_lemmy_valid() -> None:
    """
    checks valid lemmy normalization
    """
    raw = {
        "post": {
            "id": 12345,
            "name": "Lemmy Test",
            "body": "This is a body",
            "ap_id": "https://lemmy.ml/post/12345",
            "published": "2026-06-16T12:00:00Z"
        },
        "creator": {"name": "LemmyUser"},
        "community": {"name": "technology"}
    }
    res = normalize_lemmy(raw)
    assert res["id"] == "12345"
    assert res["external_id"] == "12345"
    assert res["source_type"] == "discussion"
    assert res["source_name"] == "Lemmy/c/technology"
    assert res["title"] == "Lemmy Test"
    assert res["text"] == "This is a body"
    assert res["summary"] == "This is a body"
    assert res["url"] == "https://lemmy.ml/post/12345"
    assert res["author"] == "LemmyUser"
    assert res["published_at"] == "2026-06-16T12:00:00+00:00"
    assert res["metrics"]["upvotes"] == 0

def test_normalize_lemmy_missing_fields() -> None:
    """
    checks lemmy missing fields handling
    """
    raw = {}
    res = normalize_lemmy(raw)
    assert res["id"] == ""
    assert res["source_name"] == "Lemmy/c/unknown"
    assert res["title"] == ""
    assert res["text"] == ""
    assert res["metrics"]["upvotes"] == 0

def test_normalize_youtube_success() -> None:
    """
    checks youtube success case
    """
    raw_youtube_data: Dict[str, Any] = {
        "id": "vid123",
        "snippet": {
            "title": "Quantum Computing Tutorial",
            "description": "Learn quantum computing.",
            "publishedAt": "2024-06-11T10:00:00Z",
            "channelTitle": "TechChannel"
        },
        "statistics": {
            "viewCount": "10000",
            "likeCount": "500",
            "commentCount": "100"
        },
        "contentDetails": {
            "duration": "PT10M"
        }
    }
    
    result = normalize_youtube(raw_youtube_data)
    assert result["source_type"] == "video" #matches services/scoring.py
    assert result["source_name"] == "TechChannel"
    assert result["metrics"]["views"] == 10000
    assert result["metrics"]["likes"] == 500
    assert result["metrics"]["comments"] == 100
    assert "text" in result
    assert "published_at" in result

def test_normalize_youtube_edge_case() -> None:
    """
    chekcs if the youtube query is missing statistics and duration
    """
    raw_youtube_data_missing: Dict[str, Any] = {
        "id": "vid124",
        "snippet": {
            "title": "Short Tutorial",
            "publishedAt": "2024-06-11T10:00:00Z",
            "channelTitle": "TechChannel"
        },
        "statistics": {
            "viewCount": "10000"
        }
    }
    
    result = normalize_youtube(raw_youtube_data_missing)
    assert result["source_type"] == "video"
    assert result["metrics"].get("likes") == 0
    assert result["metrics"].get("comments") == 0

def test_normalize_gnews_success() -> None:
    raw_gnews_data: Dict[str, Any] = {
        "title": "Quantum Computing Breakthrough",
        "description": "Scientists made a breakthrough.",
        "content": "Full text of the article about quantum computing...",
        "url": "http://example.com/news",
        "publishedAt": "2024-06-11T10:00:00Z",
        "source": {
            "name": "Tech News",
            "url": "http://example.com"
        }
    }
    
    result = normalize_gnews(raw_gnews_data)
    assert result["source_type"] == "news"
    assert result["source_name"] == "Tech News"
    assert "id" in result
    assert "text" in result
    assert "published_at" in result
    assert "metrics" in result

def test_normalize_gnews_edge_case() -> None:
    """
    checks if gnews is missing description and content
    """
    raw_gnews_data_missing: Dict[str, Any] = {
        "title": "Quantum Computing Breakthrough",
        "url": "http://example.com/news",
        "publishedAt": "2024-06-11T10:00:00Z",
        "source": {
            "name": "Tech News"
        }
    }
    
    result = normalize_gnews(raw_gnews_data_missing)
    assert result["source_type"] == "news"
    assert result.get("text") == ""



def test_normalize_youtube_malformed() -> None:
    """
    checks empty raw item from youtube
    """
    raw_youtube_data: Dict[str, Any] = {}
    result = normalize_youtube(raw_youtube_data)
    assert result["source_type"] == "video"
    assert result["title"] == ""
    assert result["metrics"]["views"] == 0

def test_normalize_gnews_malformed() -> None:
    """
    checks misisng url from gnews query
    """
    raw_gnews_data: Dict[str, Any] = {}
    result = normalize_gnews(raw_gnews_data)
    assert result["id"] == ""
    assert result["source_type"] == "news"
    assert result["metrics"]["shares"] == 0



def test_normalize_youtube_invalid_statistics() -> None:
    """
    checks invalid statistics handling
    """
    raw_youtube_data: Dict[str, Any] = {"statistics": {"viewCount": "notanumber"}}
    try:
        normalize_youtube(raw_youtube_data)
    except ValueError:
        pass

def test_normalize_gnews_fallback_text() -> None:
    """
    checks gnews fallback to description
    """
    raw_gnews_data: Dict[str, Any] = {
        "description": "Fallback description",
    }
    result = normalize_gnews(raw_gnews_data)
    assert result["text"] == "Fallback description"


# testing of Z at the end of timestep fix

from datetime import datetime
from backend.fetchers.normalize import _fix_iso_z

def test_fix_iso_z_converts_z_to_offset() -> None:
    assert _fix_iso_z("2026-06-10T14:30:00Z") == "2026-06-10T14:30:00+00:00"

def test_fix_iso_z_leaves_offset_unchanged() -> None:
    """
    no Z no change required
    """
    ts = "2026-06-10T14:30:00+02:00"
    assert _fix_iso_z(ts) == ts

def test_fix_iso_z_leaves_naive_unchanged() -> None:
    """
    no Z no timezone no change required
    """
    ts = "2026-06-10T14:30:00"
    assert _fix_iso_z(ts) == ts

def test_fix_iso_z_handles_empty_string() -> None:
    assert _fix_iso_z("") == ""

def test_normalize_youtube_z_timestamp_is_parsed() -> None:
    """
    youtube timestamp should also be parsed
    """
    raw = {
        "id": "vid999",
        "snippet": {
            "title": "Test",
            "publishedAt": "2026-06-10T14:30:00Z",
            "channelTitle": "TestChannel"
        }
    }
    result = normalize_youtube(raw)
    parsed = datetime.fromisoformat(result["published_at"])
    assert parsed.year == 2026
    assert parsed.month == 6

def test_normalize_gnews_z_timestamp_is_parseable() -> None:
    """
    also GNews should be parsed
    """
    raw = {
        "title": "Test",
        "url": "http://example.com/article",
        "publishedAt": "2024-12-25T08:00:00Z",
        "source": {"name": "Example"}
    }
    result = normalize_gnews(raw)
    parsed = datetime.fromisoformat(result["published_at"])
    assert parsed.year == 2024
    assert parsed.month == 12

def test_normalize_youtube_non_z_timestamp_unchanged() -> None:
    """
    here shouldn't be changed
    """
    raw = {
        "id": "vid000",
        "snippet": {
            "title": "Test",
            "publishedAt": "2026-01-15T09:00:00+05:30",
            "channelTitle": "TestChannel"
        }
    }
    result = normalize_youtube(raw)
    assert result["published_at"] == "2026-01-15T09:00:00+05:30"
    parsed = datetime.fromisoformat(result["published_at"])
    assert parsed.year == 2026

def test_normalize_gnews_z_timestamp_unchanged() -> None:
    """
    shouldn't be changed 
    """
    raw = {
        "title": "Test",
        "url": "http://example.com/article",
        "publishedAt": "2026-01-15T08:00:00+01:30",
        "source": {"name": "Example"}
    }
    result = normalize_gnews(raw)
    parsed = datetime.fromisoformat(result["published_at"])
    assert parsed.year == 2026
    assert parsed.month == 1