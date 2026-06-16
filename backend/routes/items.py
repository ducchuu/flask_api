"""Items routes — stats endpoint with upstream error handling.

Endpoints:
    GET /api/items/stats?by=source_type|interest|day
"""

import json
from typing import Any

from flask import Blueprint, g, jsonify, request

from backend.auth import require_auth
from backend.services.fetchers.base import RateLimitError, UpstreamError

bp = Blueprint("items", __name__)

VALID_BY_VALUES = {"source_type", "interest", "day"}


# ---------------------------------------------------------------------------
# SQL helpers — stats queries live here since the group doesn't use repos
# ---------------------------------------------------------------------------

def stats_by_source_type() -> list[dict[str, Any]]:
    """Count items grouped by source_type.

    Returns:
        List of dicts with source_type and count keys.
    """
    from backend.db import get_db
    rows = get_db().execute(
        """SELECT source_type, COUNT(*) AS count
           FROM items
           GROUP BY source_type
           ORDER BY count DESC"""
    ).fetchall()
    return [dict(row) for row in rows]


def stats_by_day(window_days: int = 30) -> list[dict[str, Any]]:
    """Count items per day over the given window.

    Args:
        window_days: How many days back to include. Defaults to 30.

    Returns:
        List of dicts with day (YYYY-MM-DD) and count, oldest first.
    """
    from backend.db import get_db
    rows = get_db().execute(
        """SELECT DATE(published_at) AS day, COUNT(*) AS count
           FROM items
           WHERE published_at >= DATE('now', ? || ' days')
           GROUP BY day
           ORDER BY day ASC""",
        [f"-{window_days}"]
    ).fetchall()
    return [dict(row) for row in rows]


def stats_by_interest(user_id: int) -> list[dict[str, Any]]:
    """Count items matched per interest for the given user.

    Uses keyword overlap via LIKE — an item is counted under an interest
    if its keywords_json contains at least one of the interest's keywords.

    Args:
        user_id: The authenticated user's primary key.

    Returns:
        List of dicts with interest name and count.
    """
    from backend.db import get_db
    db = get_db()

    interests = db.execute(
        "SELECT id, name, keywords_json FROM interests WHERE user_id = ?",
        [user_id]
    ).fetchall()

    results = []
    for interest in interests:
        kws = json.loads(interest["keywords_json"] or "[]")

        if not kws:
            results.append({"interest": interest["name"], "count": 0})
            continue

        like_clauses = " OR ".join(
            "LOWER(keywords_json) LIKE ?" for _ in kws
        )
        like_values = [f"%{kw.lower()}%" for kw in kws]

        row = db.execute(
            f"SELECT COUNT(*) AS count FROM items WHERE {like_clauses}",
            like_values
        ).fetchone()

        results.append({
            "interest": interest["name"],
            "count": row["count"] if row else 0,
        })

    return results


# ---------------------------------------------------------------------------
# GET /api/items/stats
# ---------------------------------------------------------------------------

@bp.get("/api/items/stats")
@require_auth
def get_stats() -> Any:
    """Return aggregated item statistics for the authenticated user.

    Query parameters:
        by (str, required): source_type | interest | day

    Returns:
        200 with {"by": ..., "stats": [...], "total": <int>}
        400 if by= is missing or invalid
        401 if unauthenticated (handled by @require_auth)
        429 if an upstream source is rate-limiting
        502 if an upstream source is unavailable
    """
    by = request.args.get("by")

    if not by:
        return jsonify({"error": {
            "code": "BAD_REQUEST",
            "message": "Query parameter 'by' is required. "
                       "Valid values: source_type, interest, day",
        }}), 400

    if by not in VALID_BY_VALUES:
        return jsonify({"error": {
            "code": "BAD_REQUEST",
            "message": f"Invalid value '{by}' for 'by'. "
                       f"Valid values: source_type, interest, day",
        }}), 400

    try:
        if by == "source_type":
            stats = stats_by_source_type()
        elif by == "day":
            stats = stats_by_day()
        else:
            stats = stats_by_interest(g.user_id)

        total = sum(entry.get("count", 0) for entry in stats)
        return jsonify({"by": by, "stats": stats, "total": total}), 200

    except RateLimitError as e:
        return jsonify({"error": {
            "code": "RATE_LIMITED",
            "message": f"Upstream source '{e.source}' is rate-limiting. "
                       f"Please try again later.",
        }}), 429

    except UpstreamError as e:
        return jsonify({"error": {
            "code": "BAD_GATEWAY",
            "message": f"Upstream source '{e.source}' is unavailable. "
                       f"Please try again later.",
        }}), 502
