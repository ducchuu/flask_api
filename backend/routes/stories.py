"""Endpoints for stories (clusters of related items).

-> a story groups together the items that the clustering step decided are about the same event.
These endpoints let the frontend list the current stories and open one to see every item underneath it.
Reading stories is global (not owned by a user), so the GET endpoints need no authentication.
A POST runs the ingestion pipeline (fetch -> enrich -> score -> cluster) and persists the result.
"""
from typing import Any, Optional

from flask import Blueprint, abort, jsonify, request

from backend.db import get_db
from backend.models import Item, Story
from backend.services.persistence import save_stories
from backend.services.pipeline import generate_feed

bp = Blueprint("stories", __name__, url_prefix="/api/stories")


def _pagination_args() -> tuple[Optional[int], int]:
    """Read optional ?limit= and ?offset= query params.

    Returns (limit, offset); limit is None when not supplied, meaning "return
    everything". Aborts with 400 if either value is not a valid integer in range.
    """
    raw_limit = request.args.get("limit")
    raw_offset = request.args.get("offset")

    limit: Optional[int] = None
    if raw_limit is not None:
        # isdigit() rejects negatives and non-numeric input; also require >= 1
        if not raw_limit.isdigit() or int(raw_limit) < 1:
            abort(400, description="limit must be a positive integer")
        limit = int(raw_limit)

    offset = 0
    if raw_offset is not None:
        if not raw_offset.isdigit():
            abort(400, description="offset must be a non-negative integer")
        offset = int(raw_offset)

    return limit, offset


@bp.get("")
def list_stories() -> Any:
    """Return stories, most recently updated first, with optional pagination.

    Use ?limit= and ?offset= to page through results; without them every story
    is returned.
    """
    limit, offset = _pagination_args()
    query = "SELECT * FROM stories ORDER BY last_updated_at DESC, id DESC"
    params: list[Any] = []
    if limit is not None or offset:
        # sqlite needs a LIMIT before OFFSET; -1 means "no limit"
        query += " LIMIT ? OFFSET ?"
        params = [limit if limit is not None else -1, offset]
    rows = get_db().execute(query, params).fetchall()
    return jsonify([Story.from_row(row).to_dict() for row in rows])


@bp.post("")
def create_stories() -> Any:
    """Run the ingestion pipeline and persist the resulting stories.

    Triggers fetch -> enrich -> score -> cluster, then stores the stories and
    their items so the GET endpoints can serve them. Optional ?source= and
    ?query= narrow what the pipeline fetches. Returns how many rows were written.
    """
    source = request.args.get("source")
    query = request.args.get("query")
    stories = generate_feed(user_id=None, source_filter=source, search_query=query)
    summary = save_stories(stories)
    return jsonify(summary), 201


@bp.get("/<int:story_id>")
def get_story(story_id: int) -> Any:
    """Return a single story together with all of its clustered items."""
    db = get_db()
    row = db.execute("SELECT * FROM stories WHERE id = ?", [story_id]).fetchone()
    if row is None:
        abort(404, description="Story not found")

    # fetch the story's items separately and nest them under the story
    item_rows = db.execute(
        "SELECT * FROM items WHERE story_id = ? ORDER BY published_at DESC",
        [story_id],
    ).fetchall()
    story = Story.from_row(row).to_dict()
    story["items"] = [Item.from_row(item).to_dict() for item in item_rows]
    return jsonify(story)
