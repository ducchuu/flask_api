import os
import json
import requests
from typing import List, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

from backend.fetchers.normalize import normalize_gnews
from backend.services.fetchers.base import RateLimitError, UpstreamServerError, UpstreamParseError

load_dotenv()

FIXTURE_DIR = Path(__file__).parent / "fixtures"

def fetch_gnews(query: str) -> List[Dict[str, Any]]:
    """
    fetches news articles from gnews matching the query
    """
    if os.getenv("FIXTURE_MODE") == "1":
        fixture_path = FIXTURE_DIR / "gnews_sample.json"
        if fixture_path.exists():
            with open(fixture_path) as f:
                data = json.load(f)
                return [normalize_gnews(item) for item in data.get("articles", [])]
        return []

    api_key = os.getenv("GNEWS_API_KEY", "")
    url = "https://gnews.io/api/v4/search"
    headers = {"User-Agent": "PulseAggregator/1.0"}
    params = {"q": query, "token": api_key}
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=5)
    except requests.RequestException as e:
        raise UpstreamServerError(str(e), source="gnews") from e

    if response.status_code == 429:
        raise RateLimitError("GNews rate limit reached", source="gnews")
    if response.status_code != 200:
        raise UpstreamServerError(f"GNews returned {response.status_code}", source="gnews")
        
    try:
        data = response.json()
    except Exception as e:
        raise UpstreamParseError("Failed to parse JSON from GNews", source="gnews") from e

    articles = data.get("articles", [])
    
    return [normalize_gnews(item) for item in articles]
