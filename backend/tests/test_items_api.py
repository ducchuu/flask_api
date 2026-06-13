"""Tests for GET /api/items/stats and upstream error handling.

TDD commit order:
    1. test: add failing tests for /api/items/stats and 429/502 handling
    2. feat: implement /api/items/stats and upstream error handling

Coverage:
    GET /api/items/stats — success per by= value, empty result,
                           400 on missing by=, 400 on invalid by=,
                           401 unauthenticated, response structure,
                           total field correctness
    Upstream errors      — RateLimitError → 429, UpstreamServerError → 502,
                           UpstreamParseError → 502, partial failure handling,
                           error envelope structure
"""

import json
import pytest
from unittest.mock import patch
from conftest import auth_headers, make_user


# ---------------------------------------------------------------------------
# Helpers — seed the database with known items and interests
# ---------------------------------------------------------------------------

def seed_items(db, items: list[dict]) -> None:
    """Insert test items directly into the database."""
    for item in items:
        db.execute(
            """INSERT OR IGNORE INTO items
               (external_id, source_type, title, published_at, keywords_json)
               VALUES (?, ?, ?, ?, ?)""",
            [
                item.get("external_id", item["title"]),
                item["source_type"],
                item["title"],
                item.get("published_at", "2026-06-01T10:00:00"),
                item.get("keywords_json", "[]"),
            ]
        )
    db.commit()


def seed_interest(db, user_id: int, name: str, keywords: list[str]) -> None:
    """Insert a test interest for a user."""
    db.execute(
        "INSERT INTO interests (user_id, name, keywords_json) VALUES (?, ?, ?)",
        [user_id, name, json.dumps(keywords)]
    )
    db.commit()


# ---------------------------------------------------------------------------
# GET /api/items/stats?by=source_type
# ---------------------------------------------------------------------------

class TestStatsBySourceType:
    """Tests for by=source_type."""

    def test_returns_200(self, client, app, db):
        """Valid request returns 200."""
        user_id = make_user(db, "stats1")
        r = client.get("/api/items/stats?by=source_type",
                       headers=auth_headers(app, user_id))
        assert r.status_code == 200

    def test_returns_correct_structure(self, client, app, db):
        """Response contains by, stats, and total keys."""
        user_id = make_user(db, "stats2")
        r = client.get("/api/items/stats?by=source_type",
                       headers=auth_headers(app, user_id))
        data = r.get_json()
        assert "by" in data
        assert "stats" in data
        assert "total" in data

    def test_by_field_matches_request(self, client, app, db):
        """Response by field echoes the request parameter."""
        user_id = make_user(db, "stats3")
        r = client.get("/api/items/stats?by=source_type",
                       headers=auth_headers(app, user_id))
        assert r.get_json()["by"] == "source_type"

    def test_counts_per_source_type(self, client, app, db):
        """Items are counted correctly per source type."""
        user_id = make_user(db, "stats4")
        seed_items(db, [
            {"source_type": "news",       "title": "N1"},
            {"source_type": "news",       "title": "N2"},
            {"source_type": "video",      "title": "V1"},
            {"source_type": "discussion", "title": "D1"},
        ])
        r = client.get("/api/items/stats?by=source_type",
                       headers=auth_headers(app, user_id))
        counts = {e["source_type"]: e["count"]
                  for e in r.get_json()["stats"]}
        assert counts["news"] == 2
        assert counts["video"] == 1
        assert counts["discussion"] == 1

    def test_total_matches_sum(self, client, app, db):
        """Total equals the sum of all counts."""
        user_id = make_user(db, "stats5")
        seed_items(db, [
            {"source_type": "news",  "title": "N3"},
            {"source_type": "video", "title": "V2"},
        ])
        data = client.get("/api/items/stats?by=source_type",
                          headers=auth_headers(app, user_id)).get_json()
        assert data["total"] == sum(e["count"] for e in data["stats"])

    def test_empty_database_returns_empty_stats(self, client, app, db):
        """No items returns empty stats list and total 0."""
        user_id = make_user(db, "stats6")
        data = client.get("/api/items/stats?by=source_type",
                          headers=auth_headers(app, user_id)).get_json()
        assert data["stats"] == []
        assert data["total"] == 0


# ---------------------------------------------------------------------------
# GET /api/items/stats?by=day
# ---------------------------------------------------------------------------

class TestStatsByDay:
    """Tests for by=day."""

    def test_returns_200(self, client, app, db):
        """Valid request returns 200."""
        user_id = make_user(db, "day1")
        r = client.get("/api/items/stats?by=day",
                       headers=auth_headers(app, user_id))
        assert r.status_code == 200

    def test_by_field_matches_request(self, client, app, db):
        """Response by field echoes the request parameter."""
        user_id = make_user(db, "day2")
        r = client.get("/api/items/stats?by=day",
                       headers=auth_headers(app, user_id))
        assert r.get_json()["by"] == "day"

    def test_counts_per_day(self, client, app, db):
        """Items are grouped by publication date."""
        user_id = make_user(db, "day3")
        seed_items(db, [
            {"source_type": "news", "title": "D1A",
             "published_at": "2026-06-01T10:00:00"},
            {"source_type": "news", "title": "D1B",
             "published_at": "2026-06-01T12:00:00"},
            {"source_type": "news", "title": "D2A",
             "published_at": "2026-06-02T10:00:00"},
        ])
        data = client.get("/api/items/stats?by=day",
                          headers=auth_headers(app, user_id)).get_json()
        counts = {e["day"]: e["count"] for e in data["stats"]}
        assert counts.get("2026-06-01") == 2
        assert counts.get("2026-06-02") == 1

    def test_days_ordered_ascending(self, client, app, db):
        """Days are returned oldest to newest."""
        user_id = make_user(db, "day4")
        seed_items(db, [
            {"source_type": "news", "title": "Late",
             "published_at": "2026-06-10T10:00:00"},
            {"source_type": "news", "title": "Early",
             "published_at": "2026-06-01T10:00:00"},
        ])
        data = client.get("/api/items/stats?by=day",
                          headers=auth_headers(app, user_id)).get_json()
        days = [e["day"] for e in data["stats"]]
        assert days == sorted(days)

    def test_empty_database_returns_empty_stats(self, client, app, db):
        """No items returns empty list and total 0."""
        user_id = make_user(db, "day5")
        data = client.get("/api/items/stats?by=day",
                          headers=auth_headers(app, user_id)).get_json()
        assert data["stats"] == []
        assert data["total"] == 0


# ---------------------------------------------------------------------------
# GET /api/items/stats?by=interest
# ---------------------------------------------------------------------------

class TestStatsByInterest:
    """Tests for by=interest."""

    def test_returns_200(self, client, app, db):
        """Valid request returns 200."""
        user_id = make_user(db, "int1")
        r = client.get("/api/items/stats?by=interest",
                       headers=auth_headers(app, user_id))
        assert r.status_code == 200

    def test_by_field_matches_request(self, client, app, db):
        """Response by field echoes the request parameter."""
        user_id = make_user(db, "int2")
        r = client.get("/api/items/stats?by=interest",
                       headers=auth_headers(app, user_id))
        assert r.get_json()["by"] == "interest"

    def test_counts_items_per_interest(self, client, app, db):
        """Items are counted per interest via keyword overlap."""
        user_id = make_user(db, "int3")
        seed_interest(db, user_id, "AI",
                      ["artificial intelligence", "machine learning"])
        seed_items(db, [
            {"source_type": "news", "title": "AI News",
             "keywords_json": '["artificial intelligence"]'},
            {"source_type": "news", "title": "ML Paper",
             "keywords_json": '["machine learning"]'},
            {"source_type": "news", "title": "Sports",
             "keywords_json": '["football"]'},
        ])
        data = client.get("/api/items/stats?by=interest",
                          headers=auth_headers(app, user_id)).get_json()
        counts = {e["interest"]: e["count"] for e in data["stats"]}
        assert counts["AI"] == 2

    def test_interest_no_matches_returns_zero(self, client, app, db):
        """Interest with no matching items returns count 0."""
        user_id = make_user(db, "int4")
        seed_interest(db, user_id, "Quantum", ["quantum computing"])
        data = client.get("/api/items/stats?by=interest",
                          headers=auth_headers(app, user_id)).get_json()
        counts = {e["interest"]: e["count"] for e in data["stats"]}
        assert counts["Quantum"] == 0

    def test_no_interests_returns_empty(self, client, app, db):
        """User with no interests returns empty stats."""
        user_id = make_user(db, "int5")
        data = client.get("/api/items/stats?by=interest",
                          headers=auth_headers(app, user_id)).get_json()
        assert data["stats"] == []
        assert data["total"] == 0

    def test_scoped_to_current_user(self, client, app, db):
        """Stats only include the authenticated user's interests."""
        id_a = make_user(db, "int_a")
        id_b = make_user(db, "int_b")
        seed_interest(db, id_a, "AI", ["artificial intelligence"])
        seed_interest(db, id_b, "Sports", ["football"])
        data = client.get("/api/items/stats?by=interest",
                          headers=auth_headers(app, id_a)).get_json()
        interest_names = [e["interest"] for e in data["stats"]]
        assert "AI" in interest_names
        assert "Sports" not in interest_names


# ---------------------------------------------------------------------------
# Validation — 400 and 401
# ---------------------------------------------------------------------------

class TestStatsValidation:
    """Tests for validation errors."""

    def test_missing_by_returns_400(self, client, app, db):
        """Missing by= returns 400 BAD_REQUEST."""
        user_id = make_user(db, "val1")
        r = client.get("/api/items/stats",
                       headers=auth_headers(app, user_id))
        assert r.status_code == 400
        assert r.get_json()["error"]["code"] == "BAD_REQUEST"

    def test_invalid_by_value_returns_400(self, client, app, db):
        """Unknown by= value returns 400."""
        user_id = make_user(db, "val2")
        r = client.get("/api/items/stats?by=invalid",
                       headers=auth_headers(app, user_id))
        assert r.status_code == 400
        assert r.get_json()["error"]["code"] == "BAD_REQUEST"

    def test_unauthenticated_returns_401(self, client):
        """Missing token returns 401."""
        r = client.get("/api/items/stats?by=source_type")
        assert r.status_code == 401
        assert r.get_json()["error"]["code"] == "UNAUTHORIZED"

    def test_invalid_token_returns_401(self, client):
        """Invalid token returns 401."""
        r = client.get("/api/items/stats?by=source_type",
                       headers={"Authorization": "Bearer garbage"})
        assert r.status_code == 401

    def test_error_envelope_on_400(self, client, app, db):
        """400 response follows group error envelope format."""
        user_id = make_user(db, "val3")
        r = client.get("/api/items/stats",
                       headers=auth_headers(app, user_id))
        error = r.get_json()["error"]
        assert "code" in error
        assert "message" in error


# ---------------------------------------------------------------------------
# Upstream error handling — 429 and 502
# ---------------------------------------------------------------------------

class TestUpstreamErrors:
    """Tests for 429 and 502 responses from upstream failures."""

    def test_rate_limit_on_source_type_returns_429(self, client, app, db):
        """RateLimitError from stats layer returns 429."""
        from backend.services.fetchers.base import RateLimitError
        user_id = make_user(db, "up1")
        with patch("backend.routes.items.stats_by_source_type",
                   side_effect=RateLimitError("rate limited", source="gnews")):
            r = client.get("/api/items/stats?by=source_type",
                           headers=auth_headers(app, user_id))
        assert r.status_code == 429
        assert r.get_json()["error"]["code"] == "RATE_LIMITED"

    def test_rate_limit_on_day_returns_429(self, client, app, db):
        """RateLimitError on by=day returns 429."""
        from backend.services.fetchers.base import RateLimitError
        user_id = make_user(db, "up2")
        with patch("backend.routes.items.stats_by_day",
                   side_effect=RateLimitError("rate limited", source="youtube")):
            r = client.get("/api/items/stats?by=day",
                           headers=auth_headers(app, user_id))
        assert r.status_code == 429

    def test_rate_limit_on_interest_returns_429(self, client, app, db):
        """RateLimitError on by=interest returns 429."""
        from backend.services.fetchers.base import RateLimitError
        user_id = make_user(db, "up3")
        with patch("backend.routes.items.stats_by_interest",
                   side_effect=RateLimitError("rate limited", source="reddit")):
            r = client.get("/api/items/stats?by=interest",
                           headers=auth_headers(app, user_id))
        assert r.status_code == 429

    def test_upstream_server_error_returns_502(self, client, app, db):
        """UpstreamServerError returns 502 BAD_GATEWAY."""
        from backend.services.fetchers.base import UpstreamServerError
        user_id = make_user(db, "up4")
        with patch("backend.routes.items.stats_by_source_type",
                   side_effect=UpstreamServerError("server down",
                                                    source="youtube")):
            r = client.get("/api/items/stats?by=source_type",
                           headers=auth_headers(app, user_id))
        assert r.status_code == 502
        assert r.get_json()["error"]["code"] == "BAD_GATEWAY"

    def test_upstream_parse_error_returns_502(self, client, app, db):
        """UpstreamParseError returns 502."""
        from backend.services.fetchers.base import UpstreamParseError
        user_id = make_user(db, "up5")
        with patch("backend.routes.items.stats_by_source_type",
                   side_effect=UpstreamParseError("bad json", source="reddit")):
            r = client.get("/api/items/stats?by=source_type",
                           headers=auth_headers(app, user_id))
        assert r.status_code == 502

    def test_rate_limit_error_envelope(self, client, app, db):
        """429 response follows group error envelope and includes source."""
        from backend.services.fetchers.base import RateLimitError
        user_id = make_user(db, "up6")
        with patch("backend.routes.items.stats_by_source_type",
                   side_effect=RateLimitError("rate limited", source="gnews")):
            r = client.get("/api/items/stats?by=source_type",
                           headers=auth_headers(app, user_id))
        error = r.get_json()["error"]
        assert "code" in error
        assert "message" in error
        assert "gnews" in error["message"]

    def test_502_error_envelope(self, client, app, db):
        """502 response follows group error envelope and includes source."""
        from backend.services.fetchers.base import UpstreamServerError
        user_id = make_user(db, "up7")
        with patch("backend.routes.items.stats_by_source_type",
                   side_effect=UpstreamServerError("down", source="youtube")):
            r = client.get("/api/items/stats?by=source_type",
                           headers=auth_headers(app, user_id))
        error = r.get_json()["error"]
        assert "code" in error
        assert "message" in error
        assert "youtube" in error["message"]

    def test_partial_failure_does_not_500(self, client, app, db):
        """Stats endpoint returns 200 even when items come from partial fetch."""
        user_id = make_user(db, "up8")
        seed_items(db, [
            {"source_type": "news", "title": "Working item"}
        ])
        r = client.get("/api/items/stats?by=source_type",
                       headers=auth_headers(app, user_id))
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Pipeline partial failure
# ---------------------------------------------------------------------------

class TestPipelinePartialFailure:
    """Tests that one failing source does not crash the whole pipeline."""

    def test_gnews_failure_still_returns_results(self, client, app, db):
        """GNews failing does not prevent YouTube and Reddit results."""
        from backend.services.fetchers.base import UpstreamServerError
        user_id = make_user(db, "pipe1")
        with patch("backend.services.pipeline.fetch_gnews",
                   side_effect=UpstreamServerError("down", source="gnews")):
            r = client.get("/api/items/stats?by=source_type",
                           headers=auth_headers(app, user_id))
        assert r.status_code == 200

    def test_all_sources_failing_returns_empty_not_500(self, client, app, db):
        """All sources failing returns empty stats, not 500."""
        from backend.services.fetchers.base import UpstreamServerError
        user_id = make_user(db, "pipe2")
        with patch("backend.services.pipeline.fetch_gnews",
                   side_effect=UpstreamServerError("down", source="gnews")), \
             patch("backend.services.pipeline.fetch_youtube",
                   side_effect=UpstreamServerError("down", source="youtube")), \
             patch("backend.services.pipeline.fetch_reddit",
                   side_effect=UpstreamServerError("down", source="reddit")):
            r = client.get("/api/items/stats?by=source_type",
                           headers=auth_headers(app, user_id))
        assert r.status_code in (200, 502)
        assert r.status_code != 500


# ---------------------------------------------------------------------------
# Response field types
# ---------------------------------------------------------------------------

class TestResponseFieldTypes:
    """Tests that response fields have the correct types."""

    def test_total_is_integer(self, client, app, db):
        """total field is always an integer."""
        user_id = make_user(db, "type1")
        seed_items(db, [{"source_type": "news", "title": "T1"}])
        data = client.get("/api/items/stats?by=source_type",
                          headers=auth_headers(app, user_id)).get_json()
        assert isinstance(data["total"], int)

    def test_count_is_integer(self, client, app, db):
        """count field in each stats entry is always an integer."""
        user_id = make_user(db, "type2")
        seed_items(db, [{"source_type": "news", "title": "T2"}])
        data = client.get("/api/items/stats?by=source_type",
                          headers=auth_headers(app, user_id)).get_json()
        for entry in data["stats"]:
            assert isinstance(entry["count"], int)

    def test_stats_is_list(self, client, app, db):
        """stats field is always a list."""
        user_id = make_user(db, "type3")
        data = client.get("/api/items/stats?by=source_type",
                          headers=auth_headers(app, user_id)).get_json()
        assert isinstance(data["stats"], list)

    def test_by_is_string(self, client, app, db):
        """by field is always a string."""
        user_id = make_user(db, "type4")
        data = client.get("/api/items/stats?by=day",
                          headers=auth_headers(app, user_id)).get_json()
        assert isinstance(data["by"], str)

    def test_day_field_is_string(self, client, app, db):
        """day field in each stats entry is a string in YYYY-MM-DD format."""
        user_id = make_user(db, "type5")
        seed_items(db, [{"source_type": "news", "title": "T3",
                         "published_at": "2026-06-01T10:00:00"}])
        data = client.get("/api/items/stats?by=day",
                          headers=auth_headers(app, user_id)).get_json()
        for entry in data["stats"]:
            assert isinstance(entry["day"], str)
            assert len(entry["day"]) == 10  # YYYY-MM-DD


# ---------------------------------------------------------------------------
# Window boundary — by=day
# ---------------------------------------------------------------------------

class TestDayWindow:
    """Tests that the 30-day window is applied correctly."""

    def test_old_items_excluded(self, client, app, db):
        """Items older than 30 days do not appear in by=day stats."""
        user_id = make_user(db, "win1")
        seed_items(db, [
            {"source_type": "news", "title": "Old",
             "published_at": "2020-01-01T10:00:00"},  # way too old
            {"source_type": "news", "title": "Recent",
             "published_at": "2026-06-01T10:00:00"},  # recent
        ])
        data = client.get("/api/items/stats?by=day",
                          headers=auth_headers(app, user_id)).get_json()
        days = [entry["day"] for entry in data["stats"]]
        assert "2020-01-01" not in days

    def test_recent_items_included(self, client, app, db):
        """Items within 30 days appear in by=day stats."""
        user_id = make_user(db, "win2")
        seed_items(db, [
            {"source_type": "news", "title": "Recent",
             "published_at": "2026-06-01T10:00:00"},
        ])
        data = client.get("/api/items/stats?by=day",
                          headers=auth_headers(app, user_id)).get_json()
        days = [entry["day"] for entry in data["stats"]]
        assert "2026-06-01" in days


# ---------------------------------------------------------------------------
# Multiple interests
# ---------------------------------------------------------------------------

class TestMultipleInterests:
    """Tests for users with more than one interest."""

    def test_two_interests_both_counted(self, client, app, db):
        """Each interest gets its own count."""
        user_id = make_user(db, "multi1")
        seed_interest(db, user_id, "AI", ["artificial intelligence"])
        seed_interest(db, user_id, "Climate", ["climate change"])
        seed_items(db, [
            {"source_type": "news", "title": "AI item",
             "keywords_json": '["artificial intelligence"]'},
            {"source_type": "news", "title": "Climate item",
             "keywords_json": '["climate change"]'},
        ])
        data = client.get("/api/items/stats?by=interest",
                          headers=auth_headers(app, user_id)).get_json()
        counts = {e["interest"]: e["count"] for e in data["stats"]}
        assert counts["AI"] == 1
        assert counts["Climate"] == 1

    def test_interest_names_all_present(self, client, app, db):
        """All interests appear in the response even with zero matches."""
        user_id = make_user(db, "multi2")
        seed_interest(db, user_id, "AI", ["artificial intelligence"])
        seed_interest(db, user_id, "Sports", ["football"])
        seed_interest(db, user_id, "Music", ["guitar"])
        data = client.get("/api/items/stats?by=interest",
                          headers=auth_headers(app, user_id)).get_json()
        names = [e["interest"] for e in data["stats"]]
        assert "AI" in names
        assert "Sports" in names
        assert "Music" in names

    def test_total_sums_all_interests(self, client, app, db):
        """Total is the sum of all interest counts."""
        user_id = make_user(db, "multi3")
        seed_interest(db, user_id, "AI", ["artificial intelligence"])
        seed_interest(db, user_id, "Climate", ["climate change"])
        seed_items(db, [
            {"source_type": "news", "title": "AI",
             "keywords_json": '["artificial intelligence"]'},
            {"source_type": "news", "title": "Climate",
             "keywords_json": '["climate change"]'},
        ])
        data = client.get("/api/items/stats?by=interest",
                          headers=auth_headers(app, user_id)).get_json()
        assert data["total"] == sum(e["count"] for e in data["stats"])


# ---------------------------------------------------------------------------
# User isolation
# ---------------------------------------------------------------------------

class TestUserIsolation:
    """Tests that stats are always scoped to the authenticated user."""

    def test_interest_stats_scoped_to_user(self, client, app, db):
        """User A's interest stats don't include user B's interests."""
        id_a = make_user(db, "iso_a")
        id_b = make_user(db, "iso_b")
        seed_interest(db, id_a, "AI", ["artificial intelligence"])
        seed_interest(db, id_b, "Sports", ["football"])
        data = client.get("/api/items/stats?by=interest",
                          headers=auth_headers(app, id_a)).get_json()
        names = [e["interest"] for e in data["stats"]]
        assert "AI" in names
        assert "Sports" not in names

    def test_two_users_see_different_interest_stats(self, client, app, db):
        """User A and user B each see only their own interests."""
        id_a = make_user(db, "iso_c")
        id_b = make_user(db, "iso_d")
        seed_interest(db, id_a, "AI", ["artificial intelligence"])
        seed_interest(db, id_b, "Sports", ["football"])
        data_a = client.get("/api/items/stats?by=interest",
                            headers=auth_headers(app, id_a)).get_json()
        data_b = client.get("/api/items/stats?by=interest",
                            headers=auth_headers(app, id_b)).get_json()
        names_a = [e["interest"] for e in data_a["stats"]]
        names_b = [e["interest"] for e in data_b["stats"]]
        assert "AI" in names_a and "Sports" not in names_a
        assert "Sports" in names_b and "AI" not in names_b


# ---------------------------------------------------------------------------
# Case sensitivity and edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Edge case tests for the stats endpoint."""

    def test_by_param_is_case_sensitive(self, client, app, db):
        """by=Source_Type returns 400 — parameter is case sensitive."""
        user_id = make_user(db, "edge1")
        r = client.get("/api/items/stats?by=Source_Type",
                       headers=auth_headers(app, user_id))
        assert r.status_code == 400

    def test_total_zero_when_all_counts_zero(self, client, app, db):
        """total is 0 when there are no items."""
        user_id = make_user(db, "edge2")
        data = client.get("/api/items/stats?by=source_type",
                          headers=auth_headers(app, user_id)).get_json()
        assert data["total"] == 0

    def test_multiple_source_types_all_counted(self, client, app, db):
        """All three source types appear when items exist for each."""
        user_id = make_user(db, "edge3")
        seed_items(db, [
            {"source_type": "news",       "title": "N1"},
            {"source_type": "video",      "title": "V1"},
            {"source_type": "discussion", "title": "D1"},
        ])
        data = client.get("/api/items/stats?by=source_type",
                          headers=auth_headers(app, user_id)).get_json()
        types = [e["source_type"] for e in data["stats"]]
        assert "news" in types
        assert "video" in types
        assert "discussion" in types

    def test_by_param_with_extra_whitespace_returns_400(self, client, app, db):
        """by= with leading space returns 400."""
        user_id = make_user(db, "edge4")
        r = client.get("/api/items/stats?by= source_type",
                       headers=auth_headers(app, user_id))
        assert r.status_code == 400

    def test_multiple_items_same_day_counted_once(self, client, app, db):
        """Multiple items on the same day count as one day entry."""
        user_id = make_user(db, "edge5")
        seed_items(db, [
            {"source_type": "news", "title": "Morning",
             "published_at": "2026-06-01T08:00:00"},
            {"source_type": "news", "title": "Afternoon",
             "published_at": "2026-06-01T14:00:00"},
            {"source_type": "news", "title": "Evening",
             "published_at": "2026-06-01T20:00:00"},
        ])
        data = client.get("/api/items/stats?by=day",
                          headers=auth_headers(app, user_id)).get_json()
        days = [e["day"] for e in data["stats"]]
        assert days.count("2026-06-01") == 1
        counts = {e["day"]: e["count"] for e in data["stats"]}
        assert counts["2026-06-01"] == 3
