from flask import Blueprint, request, jsonify
from backend.services.pipeline import generate_feed
#from backend.auth import require_auth # once authentication is done

bp = Blueprint("feed", __name__, url_prefix="/api")

@bp.route("/items", methods=["GET"])
#@require_auth
def get_items():
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