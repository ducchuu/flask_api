"""Dev runner that serves the Pulse frontend and API from one Flask app.

This sits on the frontend branch only. It reuses the team's ``create_app``
factory unchanged and adds two routes that serve the static ``frontend/``
folder, so the single-page app and the ``/api`` endpoints share an origin
(no CORS needed). Run it with:

    FIXTURE_MODE=1 python run_app.py

then open http://localhost:5000.
"""
from pathlib import Path

from flask import send_from_directory

from backend.app import create_app

FRONTEND_DIR = Path(__file__).parent / "frontend"

app = create_app()


@app.get("/")
def index() -> object:
    """Serve the SPA entry point."""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename: str) -> object:
    """Serve any other frontend asset (css/js/assets).

    The ``/api`` routes are registered as blueprints and are matched before
    this catch-all, so they are never shadowed. Anything that isn't a real
    file falls back to index.html so client-side (hash) routing still works.
    """
    target = FRONTEND_DIR / filename
    if target.is_file():
        return send_from_directory(FRONTEND_DIR, filename)
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    import os
    mode = "FIXTURE (offline demo data)" if os.getenv("FIXTURE_MODE") == "1" else "LIVE (real APIs)"
    print("=" * 56)
    print(f"  Pulse running in {mode} mode")
    if os.getenv("FIXTURE_MODE") == "1":
        print("  -> to use real sources: clear FIXTURE_MODE and restart")
        print("     PowerShell:  Remove-Item Env:FIXTURE_MODE")
    print("  Open http://localhost:5000")
    print("=" * 56)
    app.run(debug=True, port=5000)
