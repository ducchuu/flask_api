"""Feed query endpoint — serves the scored, clustered item feed.

Exposes GET /api/items with filters (source type, sort order, free-text
query) that are passed through to the feed-generation pipeline.
"""
from flask import Blueprint, request, jsonify
from backend.services.pipeline import generate_feed
#from backend.auth import require_auth # once authentication is done

bp = Blueprint("feed", __name__, url_prefix="/api")

@bp.route("/items", methods=["GET"])
#@require_auth
def get_items():
    """Return the generated feed, optionally filtered and sorted.

    Query params:
        source: limit to one source type ('news', 'video', 'discussion').
        sort:   sort order — 'relevance' (default) or 'recency'.
        query:  free-text search term overriding the user's interests.

    Returns:
        JSON list of story dicts with HTTP 200, or an error object with
        HTTP 500 if feed generation fails.
    """
    source = request.args.get("source")
    sort = request.args.get("sort", "relevance")
    query = request.args.get("query")
    
    #user_id = getattr(g, "user_id", None) # once authentication is done
    user_id = 1 # only now for testing
    
    try:
        feed = generate_feed(user_id=user_id, source_filter=source, sort_by=sort, search_query=query)
        return jsonify(feed), 200
    except Exception as e:
        return jsonify({"error": "Failed to generate feed", "details": str(e)}), 500