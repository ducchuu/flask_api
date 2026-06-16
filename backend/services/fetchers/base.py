"""Base fetcher interface and shared upstream exceptions.

All SourceClient implementations (GNews, YouTube, Reddit) raise from this
module so error handling in the pipeline and routes is consistent.

Exception hierarchy:
    UpstreamError - base for all fetcher failures
        RateLimitError - upstream returned 429
        UpstreamServerError - upstream returned 5xx or was unreachable
        UpstreamParseError - response arrived but could not be parsed
"""

from typing import Protocol, runtime_checkable


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class UpstreamError(Exception):
    """Base exception for all upstream fetcher failures.

    Args:
        message: Human-readable description of what went wrong.
        source:  Name of the source that failed (e.g. 'gnews', 'youtube').
    """

    def __init__(self, message: str, source: str = "unknown") -> None:
        super().__init__(message)
        self.message = message
        self.source = source


class RateLimitError(UpstreamError):
    """Raised when an upstream API returns HTTP 429 (Too Many Requests).

    The pipeline catches this and surfaces it as a 429 response so the
    client knows to back off rather than retry immediately.
    """
    pass


class UpstreamServerError(UpstreamError):
    """Raised when an upstream API returns 5xx or is unreachable.

    Covers connection timeouts, DNS failures, and unexpected server errors.
    The pipeline catches this and surfaces it as a 502 Bad Gateway.
    """
    pass


class UpstreamParseError(UpstreamError):
    """Raised when an upstream response cannot be parsed into a valid item.

    The pipeline catches this and surfaces it as a 502 Bad Gateway.
    """
    pass


# ---------------------------------------------------------------------------
# SourceClient protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class SourceClient(Protocol):
    """Interface every fetcher must satisfy.

    Any class implementing search() with this signature is a valid
    SourceClient, no inheritance required (structural subtyping).
    """

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """Fetch items matching the query from the upstream source.

        Args:
            query: Search terms to pass to the upstream API.
            limit: Maximum number of items to return.

        Returns:
            List of raw item dicts in the source's native shape.

        Raises:
            RateLimitError:      If the upstream API returns 429.
            UpstreamServerError: If the upstream returns 5xx or times out.
            UpstreamParseError:  If the response cannot be parsed.
        """
        ...
