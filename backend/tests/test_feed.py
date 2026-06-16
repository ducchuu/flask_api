import pytest
from unittest.mock import patch

from backend.tests.conftest import auth_headers, make_user


@patch('backend.routes.feed.generate_feed')
def test_get_feed_returns_json(mock_generate, app, client, db):
    """
    checks if the feed endpoint respects RESTful rules and returns JSON
    """
    mock_generate.return_value = [{"id": "story1", "items": []}]
    headers = auth_headers(app, make_user(db))

    response = client.get('/api/items', headers=headers)

    assert response.status_code == 200
    assert response.is_json
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 1


@patch('backend.routes.feed.generate_feed')
def test_get_feed_handles_filters(mock_generate, app, client, db):
    """
    checks parsing of the query params and that they are passed to the pipeline
    """
    mock_generate.return_value = []
    user_id = make_user(db)
    headers = auth_headers(app, user_id)

    response = client.get(
        '/api/items?source=video&sort=recency&query=python&days=7',
        headers=headers,
    )

    assert response.status_code == 200
    mock_generate.assert_called_once_with(
        user_id=user_id,
        source_filter="video",
        sort_by="recency",
        search_query="python",
        freshness_days=7,
        # the user's tuned scoring prefs, unset for a freshly made user
        weights_json=None,
        source_prefs_json=None,
    )


@patch('backend.routes.feed.generate_feed')
def test_get_feed_rejects_unknown_sort(mock_generate, app, client, db):
    """
    an unknown sort value should fall back to relevance, not be passed through
    """
    mock_generate.return_value = []
    headers = auth_headers(app, make_user(db))

    response = client.get('/api/items?sort=banana', headers=headers)

    assert response.status_code == 200
    assert mock_generate.call_args.kwargs["sort_by"] == "relevance"


@patch('backend.routes.feed.generate_feed')
def test_get_feed_ignores_bad_days(mock_generate, app, client, db):
    """
    a zero or negative freshness window should be ignored (treated as None)
    """
    mock_generate.return_value = []
    headers = auth_headers(app, make_user(db))

    response = client.get('/api/items?days=-5', headers=headers)

    assert response.status_code == 200
    assert mock_generate.call_args.kwargs["freshness_days"] is None


def test_get_feed_requires_authentication(client):
    """
    no bearer token means no access
    """
    assert client.get('/api/items').status_code == 401


@patch('backend.routes.feed.generate_feed')
def test_get_feed_returns_500_on_internal_error(mock_generate, app, client, db):
    """
    checking exception and 500 eror
    """
    mock_generate.side_effect = Exception("Simulated database or network crash")
    headers = auth_headers(app, make_user(db))

    response = client.get('/api/items', headers=headers)

    assert response.status_code == 500
    assert response.is_json
    data = response.get_json()
    assert "error" in data
    assert data["details"] == "Simulated database or network crash"
