import pytest
from typing import Dict, Any
from backend.fetchers.normalize import normalize_reddit, normalize_youtube, normalize_gnews

def test_normalize_reddit_success() -> None:
    raw_reddit_data: Dict[str, Any] = {
        "data": {
            "id": "5a6b7c",
            "subreddit": "science",
            "title": "Quantum computing",
            "selftext": "Content",
            "created_utc": 1718063850.0,
            "ups": 1500,
            "num_comments": 50
        }
    }
    
    result = normalize_reddit(raw_reddit_data)
    assert result["source_type"] == "discussion" #matches services/scoring.py
    assert result["source_name"] == "science"
    assert result["metrics"]["upvotes"] == 1500
    assert result["metrics"]["comments"] == 50
    assert "text" in result
    assert "published_at" in result

def test_normalize_reddit_edge_case() -> None:
    # chekcs if the reddit query is missing something, here it is "selftext"
    raw_reddit_data_missing: Dict[str, Any] = {
        "data": {
            "id": "1a2b3d",
            "subreddit": "science",
            "title": "Just a title without body",
            "created_utc": 1718063850.0,
            "ups": 150,
            "num_comments": 10
        }
    }
    
    result = normalize_reddit(raw_reddit_data_missing)
    assert result["source_type"] == "discussion"
    assert result.get("text") == ""

def test_normalize_youtube_success() -> None:
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
    # chekcs if the youtube query is missing statistics and duration
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
    # checks if gnews is missing description and content
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

def test_normalize_reddit_malformed() -> None:
    # checks empty raw item from reddit
    raw_reddit_data: Dict[str, Any] = {}
    result = normalize_reddit(raw_reddit_data)
    assert result["source_type"] == "discussion"
    assert result["title"] == ""
    assert result["text"] == ""

def test_normalize_youtube_malformed() -> None:
    # checks empty raw item from youtube
    raw_youtube_data: Dict[str, Any] = {}
    result = normalize_youtube(raw_youtube_data)
    assert result["source_type"] == "video"
    assert result["title"] == ""
    assert result["metrics"]["views"] == 0

def test_normalize_gnews_malformed() -> None:
    # checks misisng url from gnews query
    raw_gnews_data: Dict[str, Any] = {}
    result = normalize_gnews(raw_gnews_data)
    assert result["id"] == ""
    assert result["source_type"] == "news"
    assert result["metrics"]["shares"] == 0

def test_normalize_reddit_missing_timestamp() -> None:
    raw_reddit_data: Dict[str, Any] = {"data": {"created_utc": 0}}
    result = normalize_reddit(raw_reddit_data)
    assert result["published_at"] == "1970-01-01T00:00:00+00:00"

def test_normalize_youtube_invalid_statistics() -> None:
    raw_youtube_data: Dict[str, Any] = {"statistics": {"viewCount": "notanumber"}}
    try:
        normalize_youtube(raw_youtube_data)
    except ValueError:
        pass

def test_normalize_gnews_fallback_text() -> None:
    raw_gnews_data: Dict[str, Any] = {
        "description": "Fallback description",
    }
    result = normalize_gnews(raw_gnews_data)
    assert result["text"] == "Fallback description"