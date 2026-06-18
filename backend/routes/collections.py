"""CRUD endpoints for collections and their saved items.

A collection is a named bucket belonging to one user. Items are linked to
collections through the ``collection_items`` join table, so  same item can
sit in several collections without being duplicated.
"""
from typing import Any

from flask import Blueprint, abort, g, jsonify, request

from backend.auth import require_auth
from backend.db import get_db
from backend.models import Collection

bp = Blueprint("collections", __name__, url_prefix="/api/collections")


def _owned_collection_or_404(collection_id: int) -> Any:
    """fetch a collection owned by the current user, or 404"""
    row = get_db().execute(
        "SELECT * FROM collections WHERE id = ? AND user_id = ?",
        [collection_id, g.user_id],
    ).fetchone()
    if row is None:
        abort(404, description="Collection not found")
    return row


def _collection_items(collection_id: int) -> list[dict[str, Any]]:
    """the items saved in a collection, as small summary dicts"""
    rows = get_db().execute(
        "SELECT i.id, i.title, i.url, i.source_type "
        "FROM collection_items ci JOIN items i ON i.id = ci.item_id "
        "WHERE ci.collection_id = ? ORDER BY ci.added_at",
        [collection_id],
    ).fetchall()
    return [dict(row) for row in rows]


@bp.get("")
@require_auth
def list_collections() -> Any:
    """List the current user's collections, newest first."""
    rows = get_db().execute(
        "SELECT * FROM collections WHERE user_id = ? ORDER BY id DESC",
        [g.user_id],
    ).fetchall()
    return jsonify([Collection.from_row(row).to_dict() for row in rows])


@bp.post("")
@require_auth
def create_collection() -> Any:
    """Create a new collection."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Request body must be a JSON object")
    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        abort(400, description="Field 'name' is required")

    db = get_db()
    cur = db.execute(
        "INSERT INTO collections (user_id, name, description) VALUES (?, ?, ?)",
        [g.user_id, name.strip(), data.get("description")],
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM collections WHERE id = ?", [cur.lastrowid]
    ).fetchone()
    return jsonify(Collection.from_row(row).to_dict()), 201


@bp.get("/<int:collection_id>")
@require_auth
def get_collection(collection_id: int) -> Any:
    """Return a collection together with the items saved in it."""
    row = _owned_collection_or_404(collection_id)
    body = Collection.from_row(row).to_dict()
    body["items"] = _collection_items(collection_id)
    return jsonify(body)


@bp.put("/<int:collection_id>")
@require_auth
def update_collection(collection_id: int) -> Any:
    """Update a collection's name and/or description."""
    _owned_collection_or_404(collection_id)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Request body must be a JSON object")
    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        abort(400, description="Field 'name' is required")

    db = get_db()
    db.execute(
        "UPDATE collections SET name = ?, description = ? WHERE id = ?",
        [name.strip(), data.get("description"), collection_id],
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM collections WHERE id = ?", [collection_id]
    ).fetchone()
    return jsonify(Collection.from_row(row).to_dict())


@bp.delete("/<int:collection_id>")
@require_auth
def delete_collection(collection_id: int) -> Any:
    """Delete a collection. The join rows are removed by ON DELETE CASCADE."""
    _owned_collection_or_404(collection_id)
    db = get_db()
    db.execute("DELETE FROM collections WHERE id = ?", [collection_id])
    db.commit()
    return "", 204


@bp.put("/<int:collection_id>/items/<int:item_id>")
@require_auth
def add_item(collection_id: int, item_id: int) -> Any:
    """Add an item to a collection. Idempotent - adding twice does nothing."""
    _owned_collection_or_404(collection_id)
    db = get_db()
    item = db.execute("SELECT id FROM items WHERE id = ?", [item_id]).fetchone()
    if item is None:
        abort(404, description="Item not found")

    # INSERT OR IGNORE needs the (collection_id, item_id) primary key to
    # skip an item that's already in there
    db.execute(
        "INSERT OR IGNORE INTO collection_items (collection_id, item_id) "
        "VALUES (?, ?)",
        [collection_id, item_id],
    )
    db.commit()
    return "", 204

@bp.post("/<int:collection_id>/items")
@require_auth
def save_external_item(collection_id: int) -> Any:
    """Save a full external item to the DB and add it to a collection."""
    _owned_collection_or_404(collection_id)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, description="Request body must be a JSON object representing the item")
    
    external_id = data.get("id") or data.get("external_id")
    if not external_id:
        abort(400, description="Item must have an id or external_id")
    
    db = get_db()
    # Check if item exists by external_id
    item_row = db.execute("SELECT id FROM items WHERE external_id = ?", [external_id]).fetchone()
    if item_row:
        internal_id = item_row["id"]
    else:
        # Insert the item
        import json
        cur = db.execute(
            """INSERT INTO items (external_id, source_type, source_name, url, title, summary, author, published_at, read_time_min, sentiment_score, sentiment_label, credibility_tier, relevance_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                str(external_id),
                data.get("source_type", "news"),
                data.get("source_name"),
                data.get("url"),
                data.get("title"),
                data.get("summary"),
                data.get("author"),
                data.get("published_at"),
                data.get("read_time_min") or 0,
                data.get("sentiment_score"),
                data.get("sentiment_label"),
                data.get("credibility_tier"),
                data.get("relevance_score")
            ]
        )
        internal_id = cur.lastrowid
        db.commit()

    # Link to collection
    db.execute(
        "INSERT OR IGNORE INTO collection_items (collection_id, item_id) VALUES (?, ?)",
        [collection_id, internal_id]
    )
    db.commit()
    return "", 201


@bp.delete("/<int:collection_id>/items/<int:item_id>")
@require_auth
def remove_item(collection_id: int, item_id: int) -> Any:
    """remove an item from a collection"""
    _owned_collection_or_404(collection_id)
    db = get_db()
    cur = db.execute(
        "DELETE FROM collection_items WHERE collection_id = ? AND item_id = ?",
        [collection_id, item_id],
    )
    db.commit()
    if cur.rowcount == 0:  # nothing deleted = the pair wasn't there
        abort(404, description="Item is not in this collection")
    return "", 204
