"""Application factory and shared app-wide concerns (config, errors, health)."""
from IPython.core import application
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

    _register_routes(app)
    return app


def _register_routes(app: Flask) -> None:
    """Attach the health check and all feature blueprints."""

    @app.get("/api/health")
    def health() -> Any:
        """Liveness probe used by the frontend and by smoke tests."""
        return jsonify({"status": "ok"})

    from backend.routes.interests import bp as interests_bp
    from backend.routes.feed import bp as feed_bp

    app.register_blueprint(interests_bp)
    app.register_blueprint(feed_bp) # I added the blueprint to feed module

