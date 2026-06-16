"""Read-only endpoints for stories (clusters of related items)

-> a story groups together the items that the clustering step decided are about the same event. 
These endpoints let the frontend list the current stories and open one to see every item underneath it. 
Stories are set as global (basically not owned by a user), so reading them does not need authentication.
"""
from typing import Any

from flask import Blueprint, abort, jsonify

from backend.db import get_db
from backend.models import Item, Story

bp = Blueprint("stories", __name__, url_prefix="/api/stories")


@bp.get("")
def list_stories() -> Any:
    """Return all stories, most recently updated first."""
    rows = get_db().execute("SELECT * FROM stories ORDER BY last_updated_at DESC, id DESC").fetchall()
    return jsonify([Story.from_row(row).to_dict() for row in rows])


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
