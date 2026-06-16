"""Reddit fetcher — fetch and normalize discussion posts."""
import os
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv

from backend.fetchers.normalize import normalize_reddit
from backend.services.fetchers.base import (
    RateLimitError,
    UpstreamServerError,
    UpstreamParseError,
)
load_dotenv()

def fetch_reddit(query: str) -> List[Dict[str, Any]]:
    """Fetch discussion posts from Reddit matching the query.

    Args:
        query: Search terms to pass to the Reddit search API.

    Returns:
        List of normalized discussion dicts.

    Raises:
        RateLimitError:      If Reddit returns 429.
        UpstreamServerError: If Reddit returns 5xx or the request times out.
        UpstreamParseError:  If the response cannot be parsed.
    """
    client_id = os.getenv("REDDIT_CLIENT_ID", "")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET", "")
    url = "https://www.reddit.com/search.json"
    headers = {"User-Agent": "PulseAggregator/1.0"}
    params = {"q": query}

    try:
        response = requests.get(url, headers=headers,
                                params=params, timeout=5)
    except requests.RequestException as e:
        raise UpstreamServerError(str(e), source="reddit") from e

    if response.status_code == 429:
        raise RateLimitError("Reddit rate limit reached", source="reddit")
    if response.status_code != 200:
        raise UpstreamServerError(
            f"Reddit returned {response.status_code}", source="reddit"
        )

    try:
        data = response.json()
        children = data.get("data", {}).get("children", [])
        return [normalize_reddit(item) for item in children]
    except Exception as e:
        raise UpstreamParseError(str(e), source="reddit") from e
