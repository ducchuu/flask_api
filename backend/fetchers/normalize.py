import hashlib
from datetime import datetime, timezone
from typing import Dict, Any


def _fix_iso_z(timestamp: str) -> str:
    """
    fixing the issue of datetim not accepting timeformats with Z at the end, because GNews and Youtube sometimes retrieve them
    """
    if timestamp.endswith("Z"):
        return timestamp[:-1] + "+00:00"
    return timestamp

def normalize_lemmy(raw_item: dict) -> dict:
    """
    normalizes a raw lemmy post json dictionary
    """
    post = raw_item.get("post", {})
    creator = raw_item.get("creator", {})
    community = raw_item.get("community", {})

    url = post.get("ap_id", "")

    return {
        "id": str(post.get("id", "")),
        "external_id": str(post.get("id", "")),
        "source_type": "lemmy",
        "source_name": f"Lemmy/c/{community.get('name', 'unknown')}",
        "title": post.get("name", ""),
        "text": post.get("body", "") or "",
        "summary": (post.get("body", "") or "")[:300],
        "url": url,
        "author": creator.get("name", "Unknown"),
        "published_at": _fix_iso_z(post.get("published", "")),
        "metrics": {
            "upvotes": 0,
            "comments": 0
        }
    }

def normalize_youtube(raw_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    normalizes a raw YouTube video json dictionary from response into the normalized data shape
    """
    snippet = raw_item.get("snippet", {})
    statistics = raw_item.get("statistics", {})
    content_details = raw_item.get("contentDetails", {})
    
    video_id = raw_item.get("id", "")
    description = snippet.get("description", "")

    return {
        "id": video_id,
        "external_id": video_id,
        "source_type": "video",
        "source_name": snippet.get("channelTitle", "unknown"),
        "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
        "title": snippet.get("title", ""),
        "text": description,
        "summary": description[:300] if description else None,
        "author": snippet.get("channelTitle"),
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
        "external_id": item_id,
        "source_type": "news",
        "source_name": raw_item.get("source", {}).get("name", "unknown"),
        "url": url or None,
        "title": raw_item.get("title", ""),
        "text": raw_item.get("content", raw_item.get("description", "")),
        "summary": raw_item.get("description", ""),
        "author": raw_item.get("author"),
        "published_at": _fix_iso_z(raw_item.get("publishedAt", "")),
        "metrics": {
            "shares": 0 # unfortunately GNews free tier lacks share metrics so it will be default 0
        }
    }
