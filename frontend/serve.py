"""Tiny static server for the Pulse frontend that proxies /api to the Flask backend.

This is a frontend-only dev server: it serves the HTML/CSS/JS in this folder and
forwards every /api/* request to the backend on :5000, so the browser sees one
origin and we need no CORS changes on the backend.

Usage:
    python frontend/serve.py            # serves on http://127.0.0.1:8000
    PORT=9000 BACKEND=http://127.0.0.1:5000 python frontend/serve.py
"""
import os
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.environ.get("BACKEND", "http://127.0.0.1:5000")
PORT = int(os.environ.get("PORT", "8000"))
# headers we refuse to copy back from the upstream response (hop-by-hop)
_SKIP = {"connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length"}


class Handler(SimpleHTTPRequestHandler):
    """Serve files from the frontend folder; proxy anything under /api."""

    def _proxy(self) -> None:
        length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(length) if length else None
        req = urllib.request.Request(BACKEND + self.path, data=body, method=self.command)
        for name in ("Authorization", "Content-Type", "Accept"):
            if name in self.headers:
                req.add_header(name, self.headers[name])
        try:
            with urllib.request.urlopen(req) as resp:
                self._relay(resp.status, resp.headers, resp.read())
        except urllib.error.HTTPError as exc:  # backend returned 4xx/5xx — pass it through
            self._relay(exc.code, exc.headers, exc.read())
        except urllib.error.URLError:
            self._relay(502, {"Content-Type": "application/json"},
                        b'{"error":"backend unreachable on ' + BACKEND.encode() + b'"}')

    def _relay(self, status: int, headers, payload: bytes) -> None:
        self.send_response(status)
        for k, v in (headers.items() if hasattr(headers, "items") else headers.items()):
            if k.lower() not in _SKIP:
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        self._proxy() if self.path.startswith("/api") else super().do_GET()

    def do_POST(self) -> None:
        self._proxy()

    def do_PUT(self) -> None:
        self._proxy()

    def do_PATCH(self) -> None:
        self._proxy()

    def do_DELETE(self) -> None:
        self._proxy()

    def log_message(self, *args) -> None:  # quieter console
        pass


if __name__ == "__main__":
    handler = partial(Handler, directory=HERE)
    print(f"Pulse frontend on http://127.0.0.1:{PORT}  (api -> {BACKEND})")
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
