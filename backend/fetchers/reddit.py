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

    url = "https://www.reddit.com/search.json"
    headers = {"User-Agent": "PulseAggregator/1.0"}
    params = {"q": query}
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=5)
        if response.status_code != 200:
            return []
            
        data = response.json()
        children = data.get("data", {}).get("children", [])

        return [normalize_reddit(item) for item in children]
        
    except requests.RequestException:
        return []
