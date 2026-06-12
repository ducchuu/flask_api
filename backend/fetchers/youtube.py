import os
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv
from backend.fetchers.normalize import normalize_youtube

load_dotenv()

def fetch_youtube(query: str) -> List[Dict[str, Any]]:
    """
    fetches videos from YouTube while matching the query, retrieves statistics, and normalizes the output using normalize_youtube module

    returns a list of normalized YouTube video dictionaries.
    """
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    headers = {"User-Agent": "PulseAggregator/1.0"}
    
    search_url = f"https://www.googleapis.com/youtube/v3/search?part=snippet&q={query}&type=video&maxResults=10&key={api_key}"
    
    try:
        search_res = requests.get(search_url, headers=headers, timeout=5)
        if search_res.status_code != 200:
            return []
            
        search_data = search_res.json()
        
        video_ids = [
            item["id"]["videoId"] 
            for item in search_data.get("items", []) 
            if "videoId" in item.get("id", {})
        ]
        
        if not video_ids:
            return []

        ids_str = ",".join(video_ids)
        video_url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id={ids_str}&key={api_key}"
        
        video_res = requests.get(video_url, headers=headers, timeout=5)
        if video_res.status_code != 200:
            return []
            
        video_data = video_res.json()
        
        return [normalize_youtube(item) for item in video_data.get("items", [])]
        
    except requests.RequestException:
        return []
