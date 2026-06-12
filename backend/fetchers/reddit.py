import os
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv
from backend.fetchers.normalize import normalize_reddit

load_dotenv()

def fetch_reddit(query: str) -> List[Dict[str, Any]]:
    """
    fetches from reddit app api and normalizes using normalize_reddit module
    """

    url = f"https://www.reddit.com/search.json?q={query}"
    headers = {"User-Agent": "PulseAggregator/1.0"}
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code != 200:
            return []
            
        data = response.json()
        children = data.get("data", {}).get("children", [])

        return [normalize_reddit(item) for item in children]
        
    except requests.RequestException:
        return []
