"""Normalize raw GNews, YouTube, and Reddit responses into one common item shape."""
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any


def _fix_iso_z(timestamp: str) -> str:
    """
    fixing the issue of datetim not accepting timeformats with Z at the end, but GNews and Youtube sometimes retrieve them
    """
    if timestamp.endswith("Z"):
        return timestamp[:-1] + "+00:00"
    return timestamp

def normalize_reddit(raw_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    normalizes a raw json Reddit response into the normalized data shape for project framework
    """
    data = raw_item.get("data", {})
    
    created_utc = data.get("created_utc", 0)
    published_at = datetime.fromtimestamp(created_utc, timezone.utc).isoformat()
    
    return {
        "id": data.get("id", ""),
        "source_type": "discussion",
        "source_name": data.get("subreddit", "unknown"),
        "title": data.get("title", ""),
        "text": data.get("selftext", ""),
        "published_at": published_at,
        "metrics": {
            "upvotes": data.get("ups", 0),
            "comments": data.get("num_comments", 0)
        }
    }

def normalize_youtube(raw_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    normalizes a raw YouTube video json dictionary from response into the normalized data shape
    """
    snippet = raw_item.get("snippet", {})
    statistics = raw_item.get("statistics", {})
    content_details = raw_item.get("contentDetails", {})
    
    return {
        "id": raw_item.get("id", ""),
        "source_type": "video",
        "source_name": snippet.get("channelTitle", "unknown"),
        "title": snippet.get("title", ""),
        "text": snippet.get("description", ""),
        "published_at": _fix_iso_z(snippet.get("publishedAt", "")),
        "iso_duration": content_details.get("duration", ""),
        "metrics": {
            "views": int(statistics.get("viewCount", 0)),
            "likes": int(statistics.get("likeCount", 0)),
            "comments": int(statistics.get("commentCount", 0))
        }
    }

def normalize_gnews(raw_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    normalizes a raw GNews article json dictionary into the normalized data shape.
    """
    url = raw_item.get("url", "")
    item_id = hashlib.md5(url.encode('utf-8')).hexdigest() if url else ""
    
    return {
        "id": item_id,
        "source_type": "news",
        "source_name": raw_item.get("source", {}).get("name", "unknown"),
        "title": raw_item.get("title", ""),
        "text": raw_item.get("content", raw_item.get("description", "")),
        "published_at": _fix_iso_z(raw_item.get("publishedAt", "")),
        "metrics": {
            "shares": 0 # unfortunateluy GNews free tier lacks share metrics so it will be default 0
        }
    }
