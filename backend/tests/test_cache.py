import pytest
from typing import Any
from unittest.mock import patch, MagicMock
from backend.services.cache import get_cached_data, save_cached_data, fetch_with_cache, cleanup_expired_cache, _load_cache

def test_cache_saves_data() -> None:
    # checks if cache can save and retrieve data
    query = "test_query"
    data = [{"title": "Cached content"}]
    
    save_cached_data(query, data, ttl=60)
    result = get_cached_data(query)
    
    assert result == data

@patch('backend.services.cache.fetch_from_api')
def test_cache_hit_retrieves_without_calling_mock(mock_fetch: Any) -> None:
    # checks if it retrieves data from cache without calling the mock API again 
    query = "hit_query"
    data = [{"title": "Query content"}]
    
    save_cached_data(query, data, ttl=60)
    
    # it should hit cache and not fetch from mock
    result = fetch_with_cache(query, mock_fetch)
    
    assert result == data
    mock_fetch.assert_not_called()

@patch('backend.services.cache.fetch_from_api')
def test_cache_miss_invalidates_expired_data(mock_fetch: Any) -> None:
    # checks if cache can invalidate or ignore expired data
    query = "expired_query"
    old_data = [{"title": "Old content"}]
    new_data = [{"title": "New content"}]
    
    save_cached_data(query, old_data, ttl=-1)
    
    mock_fetch.return_value = new_data
    
    # it should ignore expired cache, call mock, and return new data
    result = fetch_with_cache(query, mock_fetch)
    
    assert result == new_data
    mock_fetch.assert_called_once_with(query)

def test_cache_miss_returns_none() -> None:
    # check if get_cached_data() module returns None for not exisitng query
    result = get_cached_data("non_existent_query")
    assert result is None

@patch('backend.services.cache.fetch_from_api')
def test_fetch_with_cache_does_not_cache_empty(mock_fetch: Any) -> None:
    # checks if API returns an empty list, it will not be cached
    query = "empty_query"
    mock_fetch.return_value = []
    
    result = fetch_with_cache(query, mock_fetch)
    assert result == []

    assert get_cached_data(query) is None

@patch('backend.services.cache.fetch_from_api')
def test_cache_miss_on_exact_expiry(mock_fetch: Any) -> None:
    query = "instant_expire_query"
    save_cached_data(query, [{"title": "Old content"}], ttl=0) # ttl = 0 so expires immidiately 
    
    mock_fetch.return_value = [{"title": "Fresh content"}]
    mock_fetch.return_value = [{"title": "Fresh content"}]
    result = fetch_with_cache(query, mock_fetch)
    assert result == [{"title": "Fresh content"}]

def test_save_cached_data_overwrites() -> None:
    query = "overwrite_query"
    save_cached_data(query, [{"data": 1}], ttl=60)
    save_cached_data(query, [{"data": 2}], ttl=60)
    assert get_cached_data(query) == [{"data": 2}]

def test_get_cached_data_expired_cleanup() -> None:
    #tests cleaning up of expired queries
    query = "cleanup_query"
    save_cached_data(query, [{"data": 1}], ttl=-1)
    get_cached_data(query)
    assert query not in _load_cache()

@patch('backend.services.cache.fetch_from_api')
def test_fetch_with_cache_returns_cached_on_subsequent_calls(mock_fetch: Any) -> None:
    import backend.services.cache as cache_module
    cache_module._save_cache({})
    query = "multi_hit_query"
    mock_fetch.return_value = [{"data": "success"}]
    fetch_with_cache(query, mock_fetch)
    fetch_with_cache(query, mock_fetch)
    fetch_with_cache(query, mock_fetch)
    assert mock_fetch.call_count == 1

def test_cleanup_expired_cache() -> None:
    # checks if manually triggering cleanup of cache deletes the data
    import backend.services.cache as cache_module
    cache_module._save_cache({})
    
    save_cached_data("keep_me", [{"data": 1}], ttl=60)
    save_cached_data("delete_me", [{"data": 2}], ttl=-1)
    
    cache_module.cleanup_expired_cache()
    
    cache_data = cache_module._load_cache()
    assert "keep_me" in cache_data
    assert "delete_me" not in cache_data

def test_auto_clear_cache() -> None:
    # checks if autocleaning of cache works with the threshold
    import backend.services.cache as cache_module
    cache_module._save_cache({})
    cache_module._save_calls_count = 0
    cache_module.CLEAR_THRESHOLD = 3 # normally it is 100 but for this test it is set to 3
    
    save_cached_data("delete_me_1", [{"data": 1}], ttl=-1)
    save_cached_data("delete_me_2", [{"data": 2}], ttl=-1)
    
    cache_data = cache_module._load_cache()
    assert "delete_me_1" in cache_data
    assert "delete_me_2" in cache_data
    
    save_cached_data("keep_me", [{"data": 3}], ttl=60)
    
    cache_data = cache_module._load_cache()
    assert "delete_me_1" not in cache_data
    assert "delete_me_2" not in cache_data
    assert "keep_me" in cache_data
    assert cache_module._save_calls_count == 0
    
    cache_module.CLEAR_THRESHOLD = 100 # back to default for other tests
