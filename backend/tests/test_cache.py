import pytest
from typing import Any
from unittest.mock import MagicMock
from backend.services.cache import get_cached_data, save_cached_data, fetch_with_cache, cleanup_expired_cache

def test_cache_saves_data(app: Any) -> None:
    """
    checks if cache saves data
    """
    with app.app_context():
        query = "test_query"
        data = [{"title": "Cached content"}]
        
        save_cached_data(query, data, ttl=60)
        result = get_cached_data(query)
        
        assert result == data

def test_cache_hit_retrieves_without_calling_mock(app: Any) -> None:
    """
    checks if cache hit retrieves data without mock call
    """
    with app.app_context():
        query = "hit_query"
        data = [{"title": "Query content"}]
        
        save_cached_data(query, data, ttl=60)
        
        mock_fetch = MagicMock()
        result = fetch_with_cache(query, mock_fetch)
        
        assert result == data
        mock_fetch.assert_not_called()

def test_cache_miss_invalidates_expired_data(app: Any) -> None:
    """
    checks if cache miss invalidates expired data
    """
    with app.app_context():
        query = "expired_query"
        old_data = [{"title": "Old content"}]
        new_data = [{"title": "New content"}]
        
        save_cached_data(query, old_data, ttl=-100)  # explicitly expired
        
        mock_fetch = MagicMock(return_value=new_data)
        
        result = fetch_with_cache(query, mock_fetch)
        
        assert result == new_data
        mock_fetch.assert_called_once_with(query)

def test_cache_miss_returns_none(app: Any) -> None:
    """
    checks if cache miss returns none
    """
    with app.app_context():
        result = get_cached_data("non_existent_query")
        assert result is None

def test_fetch_with_cache_does_not_cache_empty(app: Any) -> None:
    """
    checks if fetch with cache does not cache empty
    """
    with app.app_context():
        query = "empty_query"
        mock_fetch = MagicMock(return_value=[])
        
        result = fetch_with_cache(query, mock_fetch)
        assert result == []

        assert get_cached_data(query) is None

def test_cache_miss_on_exact_expiry(app: Any) -> None:
    """
    checks cache miss on exact expiry
    """
    with app.app_context():
        query = "instant_expire_query"
        save_cached_data(query, [{"title": "Old content"}], ttl=-1)
        
        mock_fetch = MagicMock(return_value=[{"title": "Fresh content"}])
        result = fetch_with_cache(query, mock_fetch)
        assert result == [{"title": "Fresh content"}]

def test_save_cached_data_overwrites(app: Any) -> None:
    """
    checks if save cached data overwrites
    """
    with app.app_context():
        query = "overwrite_query"
        save_cached_data(query, [{"data": 1}], ttl=60)
        save_cached_data(query, [{"data": 2}], ttl=60)
        assert get_cached_data(query) == [{"data": 2}]

def test_cleanup_expired_cache(app: Any) -> None:
    """
    checks if cleanup expired cache works
    """
    with app.app_context():
        save_cached_data("keep_me", [{"data": 1}], ttl=600)
        save_cached_data("delete_me", [{"data": 2}], ttl=-100)
        
        cleanup_expired_cache()
        
        assert get_cached_data("keep_me") == [{"data": 1}]
        assert get_cached_data("delete_me") is None
