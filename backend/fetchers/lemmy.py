import os
import json
import requests
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

from backend.fetchers.normalize import normalize_lemmy
from backend.services.fetchers.base import RateLimitError, UpstreamServerError, UpstreamParseError

FIXTURE_DIR = Path(__file__).parent / "fixtures"

LEMMY_LANG_MAP = {
    "en": 37, "es": 39, "fr": 47, "de": 32, "it": 72, "pt": 130, 
    "nl": 115, "ru": 135, "zh": 182, "ja": 74, "ar": 8, "hi": 57
}

def fetch_lemmy(query: str, lang: Optional[str] = None) -> List[Dict[str, Any]]:
    print(f"fetch_lemmy called with query={query}, lang={lang}", file=sys.stderr)
    if os.getenv("FIXTURE_MODE") == "1":
        fixture_path = FIXTURE_DIR / "lemmy_sample.json"
        if fixture_path.exists():
            with open(fixture_path) as f:
                data = json.load(f)
                return [normalize_lemmy(item) for item in data.get("posts", [])]
        return []

    url = "https://lemmy.ml/api/v3/search"
    headers = {"User-Agent": "PulseAggregator/1.0"}
    params = {
        "q": query,
        "type_": "Posts",
        "limit": 50 if lang else 10,
        "sort": "TopAll"
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=5)
    except requests.RequestException as e:
        raise UpstreamServerError(str(e), source="lemmy") from e

    if response.status_code == 429:
        raise RateLimitError("Lemmy rate limit reached", source="lemmy")
    if response.status_code != 200:
        raise UpstreamServerError(f"Lemmy returned {response.status_code}", source="lemmy")

    try:
        data = response.json()
    except Exception as e:
        raise UpstreamParseError("Failed to parse JSON from Lemmy", source="lemmy") from e

    posts = data.get("posts", [])
    
    if lang and lang in LEMMY_LANG_MAP:
        target_id = LEMMY_LANG_MAP[lang]
        posts = [p for p in posts if p.get("post", {}).get("language_id") == target_id]

    res = [normalize_lemmy(item) for item in posts[:10]]
    print(f"fetch_lemmy returning {len(res)} posts", file=sys.stderr)
    return res
