import time
import json
import os
from typing import Any, Callable, Dict, List

CACHE_FILE = "api_cache.json"
_save_calls_count: int = 0
CLEAR_THRESHOLD: int = 100

def _load_cache() -> Dict[str, Dict[str, Any]]:
    """Loads the cache from the JSON file if it exists."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}  # Return empty if the file is corrupted or empty
    return {}

def _save_cache(cache_data: Dict[str, Dict[str, Any]]) -> None:
    """Saves the cache dictionary to the JSON file."""
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache_data, f)

def cleanup_expired_cache() -> None:
    """
    iterates through the cache and deletes all expired entries
    """
    cache_data = _load_cache()
    current_time = time.time()
    
    expired_keys = [
        k for k, v in cache_data.items() 
        if current_time > v["expires_at"]
    ]
    
    # Only save back to disk if we actually deleted something
    if expired_keys:
        for k in expired_keys:
            del cache_data[k]
        _save_cache(cache_data)

def save_cached_data(query: str, data: List[Dict[str, Any]], ttl: int = 3600) -> None:
    """
    saves data to cache and sets defualt timer for 3600 seconds. 
    Also when the count of cached data goes above the threshold, calls cleanup_expired_cache() which will clean expired data from cache
    """
    global _save_calls_count
    
    cache_data = _load_cache()
    cache_data[query] = {
        "data": data,
        "expires_at": time.time() + ttl
    }
    _save_cache(cache_data)
    
    _save_calls_count += 1
    if _save_calls_count >= CLEAR_THRESHOLD:
        cleanup_expired_cache()
        _save_calls_count = 0

def get_cached_data(query: str) -> Any:
    """
    retrieves data if it exists and hasn't expired
    """
    cache_data = _load_cache()
    cache_entry = cache_data.get(query)
    
    if not cache_entry:
        return None
        
    if time.time() > cache_entry["expires_at"]:
        # Data expired, clean it up individually on fetch
        del cache_data[query]
        _save_cache(cache_data)
        return None
        
    return cache_entry["data"]

def fetch_with_cache(query: str, fetch_func: Callable[[str], List[Dict[str, Any]]], ttl: int = 3600) -> List[Dict[str, Any]]:
    """
    wrapper function that checks cache first, then calls the fetch function if missed
    """
    cached_result = get_cached_data(query)
    if cached_result is not None:
        return cached_result
        
    fresh_data = fetch_func(query)

    if fresh_data:
        save_cached_data(query, fresh_data, ttl)
        
    return fresh_data

def fetch_from_api(query: str) -> List[Dict[str, Any]]:
    """
    for mock patch in testing for now, later this will be the right implementation
    """
    pass