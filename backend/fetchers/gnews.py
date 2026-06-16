"""GNews fetcher - fetch and normalize news articles from the GNews API."""
import os
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv
from backend.fetchers.normalize import normalize_gnews

load_dotenv()

def fetch_gnews(query: str) -> List[Dict[str, Any]]:
    """
    fetches gnews data using api and normalizes using normalize_gnews module
    """
    api_key = os.getenv("GNEWS_API_KEY", "")
    url = "https://gnews.io/api/v4/search"
    headers = {"User-Agent": "PulseAggregator/1.0"}
    params = {"q": query, "token": api_key}
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=5)
        if response.status_code != 200:
            return []
            
        data = response.json()
        articles = data.get("articles", [])
        
        return [normalize_gnews(item) for item in articles]
        
    except requests.RequestException:
        return []
