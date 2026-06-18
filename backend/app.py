"""Application factory and shared app-wide concerns (config, errors, health)."""
import os
from typing import Any, Mapping

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from backend.db import close_db, init_db


def create_app(config: Mapping[str, Any] | None = None) -> Flask:
    """Build and configure a Pulse Flask application.

    Args:
        config: optional overrides (used by tests to point at a temp database
            and flip TESTING on)
    """
    app = Flask(__name__)
    app.config.from_mapping(
        DATABASE=os.environ.get("DATABASE", "pulse.db"),
        SECRET_KEY=os.environ.get("SECRET_KEY", "somesortasecret"),
    )
    if config:
        app.config.update(config)

    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db()

    _register_error_handlers(app)
    _register_routes(app)
    return app


def _register_routes(app: Flask) -> None:
    """attach health check and all feature blueprints."""

    @app.get("/api/health")
    def health() -> Any:
        """liveness probe used by the frontend and by smoke tests"""
        return jsonify({"status": "ok"})

    # NOTE: the root "/" + static file serving for the frontend lives in
    # run_app.py (frontend branch) so the SPA and the API share an origin.

    from backend.routes.interests import bp as interests_bp
    from backend.routes.feed import bp as feed_bp
    from backend.routes.stories import bp as stories_bp
    from backend.routes.users import bp as users_bp
    from backend.routes.items import bp as items_bp
    from backend.routes.collections import bp as collections_bp
    from backend.routes.feedback import bp as feedback_bp
    from backend.routes.item_write import bp as item_write_bp
    from backend.routes.oauth import bp as oauth_bp

    # all the blueprints imported here for simplicity and then directly registered
    app.register_blueprint(interests_bp)
    app.register_blueprint(feed_bp)  # I added the blueprint to feed module
    app.register_blueprint(stories_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(items_bp)
    app.register_blueprint(collections_bp)
    app.register_blueprint(feedback_bp)
    app.register_blueprint(item_write_bp)  # frontend: POST /api/items upsert
    app.register_blueprint(oauth_bp)       # frontend: Google OAuth sign-in


def _register_error_handlers(app: Flask) -> None:
    """return every error as a consistent JSON envelope

    Shape: {"error": {"code": <int>, "message": <str>}}, so the frontend gets
    JSON for 4xx/5xx responses instead of Flask's default HTML error pages, easier for debugging in the future
    """

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException) -> Any:
        """Render raised HTTP errors (4xx/5xx) as the standard JSON error envelope."""
        response = jsonify({"error": {"code": exc.code, "message": exc.description}})
        response.status_code = exc.code or 500
        return response

    @app.errorhandler(Exception)
    def handle_unexpected(exc: Exception) -> Any:
        """Catch any uncaught non-HTTP exception and return a generic 500 JSON error."""
        if isinstance(exc, HTTPException):
            raise exc
        response = jsonify({"error": {"code": 500, "message": "Internal server error"}})
        response.status_code = 500
        return response
