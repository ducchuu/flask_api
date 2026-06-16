import pytest
from typing import Any
from unittest.mock import patch, MagicMock
from backend.fetchers.gnews import fetch_gnews
from backend.fetchers.youtube import fetch_youtube
from backend.fetchers.lemmy import fetch_lemmy
from backend.services.fetchers.base import RateLimitError, UpstreamServerError
import requests


@patch('requests.get')
def test_fetch_gnews_failure(mock_get: Any) -> None:
    """
    checks fetch gnews failure
    """
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_get.return_value = mock_response

    with pytest.raises(UpstreamServerError):
        fetch_gnews("artificial intelligence")




@patch('requests.get')
def test_fetch_youtube_failure(mock_get: Any) -> None:
    """
    checks fetch youtube failure
    """
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_get.return_value = mock_response

    with pytest.raises(RateLimitError):
        fetch_youtube("artificial intelligence")




@patch('requests.get')
def test_fetch_lemmy_failure(mock_get: Any) -> None:
    """
    checks fetch lemmy failure
    """
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_get.return_value = mock_response

    with pytest.raises(RateLimitError):
        fetch_lemmy("artificial intelligence")


@patch('requests.get')
def test_fetch_gnews_timeout(mock_get: Any) -> None:
    """
    checks fetch gnews timeout
    """
    mock_get.side_effect = requests.RequestException("Timeout")
    with pytest.raises(UpstreamServerError):
        fetch_gnews("artificial intelligence")

@patch('requests.get')
def test_fetch_youtube_timeout(mock_get: Any) -> None:
    """
    checks fetch youtube timeout
    """
    mock_get.side_effect = requests.RequestException("Timeout")
    with pytest.raises(UpstreamServerError):
        fetch_youtube("artificial intelligence")

@patch('requests.get')
def test_fetch_lemmy_timeout(mock_get: Any) -> None:
    """
    checks fetch lemmy timeout
    """
    mock_get.side_effect = requests.RequestException("Timeout")
    with pytest.raises(UpstreamServerError):
        fetch_lemmy("artificial intelligence")


@patch('requests.get')
def test_fetch_gnews_missing_articles_key(mock_get: Any) -> None:
    """
    checks fetch gnews missing articles key
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "ok"}
    mock_get.return_value = mock_response
    assert fetch_gnews("test") == []

@patch('requests.get')
def test_fetch_youtube_missing_items_key(mock_get: Any) -> None:
    """
    checks fetch youtube missing items key
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"pageInfo": {}}
    mock_get.return_value = mock_response
    assert fetch_youtube("test") == []

@patch('requests.get')
def test_fetch_lemmy_missing_data_key(mock_get: Any) -> None:
    """
    checks fetch lemmy missing data key
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {}
    mock_get.return_value = mock_response
    assert fetch_lemmy("test") == []

@patch('requests.get')
def test_fetch_lemmy_empty(mock_get: Any) -> None:
    """
    checks fetch lemmy empty
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"posts": []}
    mock_get.return_value = mock_response

    result = fetch_lemmy("unknown query")
    assert result == []

@patch('requests.get')
def test_fetch_youtube_empty(mock_get: Any) -> None:
    """
    checks fetch youtube empty
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"items": []}
    mock_get.return_value = mock_response

    result = fetch_youtube("unknown query")
    assert result == []

@patch('requests.get')
def test_fetch_lemmy_success(mock_get: Any) -> None:
    """
    checks fetch lemmy success
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "posts": [
            {"post": {"name": "Valid Post 1"}}
        ]
    }
    mock_get.return_value = mock_response

    result = fetch_lemmy("artificial intelligence")
    assert len(result) == 1
    assert result[0]["title"] == "Valid Post 1"

@patch('requests.get')
def test_fetch_gnews_empty(mock_get: Any) -> None:
    """
    checks fetch gnews empty
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"articles": []}
    mock_get.return_value = mock_response

    result = fetch_gnews("unknown query")
    assert result == []

@patch('requests.get')
def test_fetch_youtube_success(mock_get: Any) -> None:
    """
    checks fetch youtube success
    """
    mock_response_search = MagicMock()
    mock_response_search.status_code = 200
    mock_response_search.json.return_value = {
        "items": [
            {"id": {"videoId": "vid123"}}
        ]
    }
    
    mock_response_video = MagicMock()
    mock_response_video.status_code = 200
    mock_response_video.json.return_value = {
        "items": [
            {"id": "vid123", "snippet": {"title": "Test Video"}}
        ]
    }
    mock_get.side_effect = [mock_response_search, mock_response_video]

    result = fetch_youtube("artificial intelligence")
    assert len(result) == 1
    assert result[0]["id"] == "vid123"

@patch('requests.get')
def test_fetch_gnews_success(mock_get: Any) -> None:
    """
    checks fetch gnews success
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "articles": [
            {"title": "Valid Article 1"}
        ]
    }
    mock_get.return_value = mock_response

    result = fetch_gnews("artificial intelligence")
    assert len(result) == 1
    assert result[0]["title"] == "Valid Article 1"


@patch('requests.get')
def test_fetch_gnews_special_characters_in_query(mock_get: Any) -> None:
    """
    checks fetch gnews special characters in query
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"articles": []}
    mock_get.return_value = mock_response

    result = fetch_gnews("AI & machine learning #trending")
    assert result == []
    _, kwargs = mock_get.call_args
    assert "params" in kwargs, "Expected query to be passed via params= for URL encoding"

@patch('requests.get')
def test_fetch_youtube_special_characters_in_query(mock_get: Any) -> None:
    """
    checks fetch youtube special characters in query
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"items": []}
    mock_get.return_value = mock_response

    result = fetch_youtube("C++ tutorial & tricks")
    assert result == []
    _, kwargs = mock_get.call_args
    assert "params" in kwargs, "Expected query to be passed via params= for URL encoding"

@patch('requests.get')
def test_fetch_lemmy_special_characters_in_query(mock_get: Any) -> None:
    """
    checks fetch lemmy special characters in query
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"posts": []}
    mock_get.return_value = mock_response

    result = fetch_lemmy("price > $100 & free shipping")
    assert result == []
    _, kwargs = mock_get.call_args
    assert "params" in kwargs, "Expected query to be passed via params= for URL encoding"


@patch('requests.get')
def test_fetch_youtube_second_request_fails(mock_get: Any) -> None:
    """
    checking if the video details request (2nd call) fails, then it should return empty
    """
    mock_response_search = MagicMock()
    mock_response_search.status_code = 200
    mock_response_search.json.return_value = {
        "items": [{"id": {"videoId": "vid123"}}]
    }

    mock_response_video = MagicMock()
    mock_response_video.status_code = 500  # 2nd call 
    mock_get.side_effect = [mock_response_search, mock_response_video]

    with pytest.raises(UpstreamServerError):
        fetch_youtube("test")