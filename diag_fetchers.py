"""Diagnostic: run each fetcher LIVE and surface the real error.

The pipeline's _safe_fetch() swallows UpstreamError and returns [], so a
failing GNews/YouTube source silently vanishes from the feed. This script
calls each fetcher directly and prints exactly what happens.

Run from the project root:

    python diag_fetchers.py
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load whichever .env exists (root first, then backend/), and make sure we are
# NOT in fixture mode so we actually hit the live APIs.
load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent / "backend" / ".env")
os.environ.pop("FIXTURE_MODE", None)

from backend.fetchers.gnews import fetch_gnews
from backend.fetchers.youtube import fetch_youtube
from backend.fetchers.lemmy import fetch_lemmy

QUERY = "technology"


def show_key(name: str) -> None:
    val = os.getenv(name, "")
    if val:
        print(f"  {name}: loaded ({len(val)} chars, ends ...{val[-4:]})")
    else:
        print(f"  {name}: MISSING")


def run(label: str, fn) -> None:
    print(f"\n=== {label} ===")
    try:
        items = fn(QUERY)
        print(f"  OK: {len(items)} items")
        if items:
            print(f"  first title: {items[0].get('title', '<no title>')[:70]}")
    except Exception as exc:  # noqa: BLE001 - we want to see everything here
        print(f"  FAILED: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    print("Keys loaded into the process:")
    show_key("GNEWS_API_KEY")
    show_key("YOUTUBE_API_KEY")
    print(f"FIXTURE_MODE = {os.getenv('FIXTURE_MODE')!r} (None/0 means live)")

    run("GNews", fetch_gnews)
    run("YouTube", fetch_youtube)
    run("Lemmy (keyless)", fetch_lemmy)
