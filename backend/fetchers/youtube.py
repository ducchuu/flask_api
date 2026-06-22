import os
import json
import requests
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

from backend.fetchers.normalize import normalize_youtube
from backend.services.fetchers.base import RateLimitError, UpstreamServerError, UpstreamParseError

load_dotenv()

FIXTURE_DIR = Path(__file__).parent / "fixtures"

def fetch_youtube(query: str, lang: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    updated version with 2 calls, one for searching and sacend to retrieve details fo rsearched query.
    lang, when given, biases the search toward results in that language.
    """
    if os.getenv("FIXTURE_MODE") == "1":
        fixture_path = FIXTURE_DIR / "youtube_sample.json"
        if fixture_path.exists():
            with open(fixture_path) as f:
                data = json.load(f)
                return [normalize_youtube(item) for item in data.get("items", [])]
        return []

    api_key = os.getenv("YOUTUBE_API_KEY", "")
    
    # searching step
    search_url = "https://www.googleapis.com/youtube/v3/search"
    search_params = {
        "part": "id",
        "q": query,
        "type": "video",
        "maxResults": 50 if lang else 10,
        "key": api_key,
    }
    if lang:
        search_params["relevanceLanguage"] = lang

    try:
        search_resp = requests.get(search_url, params=search_params, timeout=5)
    except requests.RequestException as e:
        raise UpstreamServerError(str(e), source="youtube") from e

    if search_resp.status_code == 403 or search_resp.status_code == 429:
        raise RateLimitError("YouTube rate limit reached", source="youtube")
    if search_resp.status_code != 200:
        raise UpstreamServerError(f"YouTube returned {search_resp.status_code}", source="youtube")
        
    search_data = search_resp.json()
    video_ids = [item.get("id", {}).get("videoId") for item in search_data.get("items", []) if item.get("id", {}).get("videoId")]
    
    if not video_ids:
        return []
        
    # details retrieval
    details_url = "https://www.googleapis.com/youtube/v3/videos"
    details_params = {
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(video_ids),
        "key": api_key,
    }
    
    try:
        details_resp = requests.get(details_url, params=details_params, timeout=5)
    except requests.RequestException as e:
        raise UpstreamServerError(str(e), source="youtube") from e
        
    if details_resp.status_code == 403 or details_resp.status_code == 429:
        raise RateLimitError("YouTube rate limit reached", source="youtube")
    if details_resp.status_code != 200:
        raise UpstreamServerError(f"YouTube returned {details_resp.status_code}", source="youtube")

    details_data = details_resp.json()
    items = details_data.get("items", [])
    
    if lang:
        filtered_items = []
        for item in items:
            snippet = item.get("snippet", {})
            default_lang = (snippet.get("defaultLanguage") or "").lower()
            audio_lang = (snippet.get("defaultAudioLanguage") or "").lower()
            
            if default_lang.startswith(lang.lower()) or audio_lang.startswith(lang.lower()):
                filtered_items.append(item)
        items = filtered_items

    return [normalize_youtube(item) for item in items[:10]]
