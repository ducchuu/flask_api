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
            and flip TESTING on). 
    """
    app = Flask(__name__)
    app.config.from_mapping(
        DATABASE=os.environ.get("DATABASE", "pulse.db"),
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
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
    """Attach the health check and all feature blueprints."""

    @app.get("/api/health")
    def health() -> Any:
        """Liveness probe used by the frontend and by smoke tests."""
        return jsonify({"status": "ok"})



def _register_error_handlers(app: Flask) -> None:
    """Make every error come back as a consistent JSON envelope.

    Shape: ``{"error": {"code": <int>, "message": <str>}}``. The frontend can
    rely on this for all 4xx/5xx responses instead of getting HTML error pages.
    """

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException) -> Any:
        response = jsonify(
            {"error": {"code": exc.code, "message": exc.description}}
        )
        response.status_code = exc.code or 500
        return response

    @app.errorhandler(Exception)
    def handle_unexpected(exc: Exception) -> Any:
        # Let HTTPExceptions fall through to the handler above.
        if isinstance(exc, HTTPException):
            raise exc
        response = jsonify(
            {"error": {"code": 500, "message": "Internal server error"}}
        )
        response.status_code = 500
        return response
