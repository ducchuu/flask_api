from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from backend.fetchers.gnews import fetch_gnews
from backend.fetchers.youtube import fetch_youtube
from backend.fetchers.reddit import fetch_reddit
from backend.services.cache import fetch_with_cache

from backend.services.enrich import keywords, sentiment, credibility_tier, read_time, video_duration_minutes
from backend.services.scoring import score_item
from backend.services.clustering import cluster_items

def generate_feed(
    user_id: Optional[int], 
    source_filter: Optional[str] = None, 
    sort_by: str = "relevance", 
    search_query: Optional[str] = None
) -> List[Dict[str, Any]]:
    
    #user_interests = get_user_interests(user_id) # once db is ready
    user_interests = ["artificial intelligence"] #example
    source_prefs = {"news": 0.8, "video": 0.5, "discussion": 0.7} #example
    
    queries = [search_query] if search_query else user_interests
    raw_items = []

    # fetching news, video or discussion or none should return empty stories later, it is included in testing
    for q in queries:
        if not source_filter or source_filter == "news":
            raw_items.extend(fetch_with_cache(f"gnews_{q}", lambda _, _q=q: fetch_gnews(_q)))
        if not source_filter or source_filter == "video":
            raw_items.extend(fetch_with_cache(f"youtube_{q}", lambda _, _q=q: fetch_youtube(_q)))
        if not source_filter or source_filter == "discussion":
            raw_items.extend(fetch_with_cache(f"reddit_{q}", lambda _, _q=q: fetch_reddit(_q)))
            
    # sentiment analysis
    enriched = []
    for item in raw_items:
        text = item.get("text", "")
        item["keywords"] = keywords(text)
        item["sentiment"] = sentiment(text)[1]
        item["credibility"] = credibility_tier(item.get("source_type", ""), item.get("source_name", ""))
        
        if item["source_type"] == "video":
            item["read_time"] = video_duration_minutes(item.get("iso_duration", ""))
        else:
            item["read_time"] = read_time(text)
        enriched.append(item)

    now = datetime.now(timezone.utc)
    weights = {
        "interest": 0.4, 
        "recency": 0.3, 
        "popularity": 0.2, 
        "source": 0.1,
        "source_prefs": source_prefs 
    }
    # prepare for clustering
    for item in enriched:
        score, _ = score_item(item, user_interests, weights, now)
        item["relevance_score"] = score

    stories = cluster_items(enriched, threshold=0.3)

    if sort_by == "recency":
        stories.sort(key=lambda s: max([it.get("published_at", "") for it in s.get("items", [])], default=""), reverse=True)
    else:
        stories.sort(key=lambda s: max([it.get("relevance_score", 0.0) for it in s.get("items", [])], default=0.0), reverse=True)

    return stories