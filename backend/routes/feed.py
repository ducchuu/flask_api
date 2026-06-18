"""Feed query endpoint - the read-only query service for the dashboard.

Exposes GET /api/items, which returns the scored and clustered feed for the
logged-in user. Supports filtering by source type and a freshness window,
a free-text search query, and choosing the sort order.
"""
from typing import Any

from flask import Blueprint, g, request, jsonify

from backend.auth import require_auth
from backend.services.pipeline import generate_feed

bp = Blueprint("feed", __name__, url_prefix="/api")

# sort orders we accept; anything else falls back to "relevance"
ALLOWED_SORTS = ("relevance", "recency", "popularity")


@bp.route("/items", methods=["GET"])
@require_auth
def get_items() -> Any:
    """Return the personalized feed for the logged-in user.

    Query params (all optional):
        source: one of 'news', 'video', 'discussion' to show only that type.
        sort:   'relevance' (default), 'recency', or 'popularity'.
        query:  free-text search term that overrides the user's interests.
        days:   freshness window - only keep items from the last N days.

    Returns:
        200 with a JSON list of story dicts, or 500 if generation fails.
    """
    source = request.args.get("source")
    query = request.args.get("query")

    # only accept known sort orders, otherwise default to relevance
    sort = request.args.get("sort", "relevance")
    if sort not in ALLOWED_SORTS:
        sort = "relevance"

    # freshness window in days; ignore it if it is missing or not positive
    days = request.args.get("days", type=int)
    if days is not None and days <= 0:
        days = None

    # ?refresh=1 pulls fresh content: clear the cache so the pipeline re-fetches
    # from the live sources instead of serving cached results.
    if request.args.get("refresh"):
        from backend.db import get_db
        db = get_db()
        db.execute("DELETE FROM api_cache")
        db.commit()

    # user_id and the User model are set by @require_auth from the bearer token
    user_id = g.user_id
    user = g.current_user

    try:
        feed = generate_feed(
            user_id=user_id,
            source_filter=source,
            sort_by=sort,
            search_query=query,
            freshness_days=days,
            # the user's tuned scoring preferences, set via PATCH /api/users/me
            weights_json=user.weights_json,
            source_prefs_json=user.source_prefs_json,
        )
        return jsonify(feed), 200
    except Exception as e:
        return jsonify({"error": "Failed to generate feed", "details": str(e)}), 500
