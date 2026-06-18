import os
import json
import requests
from pathlib import Path
from typing import List, Dict, Any

from backend.fetchers.normalize import normalize_lemmy
from backend.services.fetchers.base import RateLimitError, UpstreamServerError, UpstreamParseError

FIXTURE_DIR = Path(__file__).parent / "fixtures"

def fetch_lemmy(query: str) -> List[Dict[str, Any]]:
    """
    fetch from Lemmy matching query
    """
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
        "limit": 10,
        # "TopMonth" surfaces recent, well-engaged posts. "TopAll" (the old
        # value) returned years-old viral threads, which made the feed stale.
        "sort": "TopMonth",
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
    return [normalize_lemmy(item) for item in posts]
