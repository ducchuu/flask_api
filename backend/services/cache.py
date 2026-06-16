import json
from typing import Any, Callable, Dict, List
# so now with the db module implemented, i changed from local caching in json file to caching in our sqlite database
from backend.db import get_db

def cleanup_expired_cache() -> None:
    """
    deletes all data that is currently in the cache db AND is expired
    """
    db = get_db()
    # strftime('%s', ...) returns a string, so we must cast it to INTEGER before adding ttl_seconds
    db.execute(
        "DELETE FROM api_cache WHERE "
        "(CAST(strftime('%s', fetched_at) AS INTEGER) + ttl_seconds) < CAST(strftime('%s', 'now') AS INTEGER)"
    )
    db.commit()

def save_cached_data(query: str, data: List[Dict[str, Any]], ttl: int = 3600) -> None:
    """
    saves data to the cache
    """
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO api_cache (cache_key, payload_json, ttl_seconds) "
        "VALUES (?, ?, ?)",
        [query, json.dumps(data), ttl],
    )
    db.commit()

    cleanup_expired_cache() #instead of timeout, everytime we save data to cache, we also check for expired data in cache to be deleted

def get_cached_data(query: str) -> Any:
    """
    if data well exists in cache, it will be returned 
    """
    db = get_db()
    cleanup_expired_cache()
    row = db.execute(
        "SELECT payload_json FROM api_cache WHERE cache_key = ?", [query]
    ).fetchone()
    if row is None:
        return None
    return json.loads(row["payload_json"])

def fetch_with_cache(query: str, fetch_func: Callable[[str], List[Dict[str, Any]]], ttl: int = 3600) -> List[Dict[str, Any]]:
    """
    additional wrapper fucntion that checks for data if it exists already in cache, and if not then it saves data to cache
    """
    cached_result = get_cached_data(query)
    if cached_result is not None:
        return cached_result
        
    fresh_data = fetch_func(query)

    if fresh_data:
        save_cached_data(query, fresh_data, ttl)
        
    return fresh_data