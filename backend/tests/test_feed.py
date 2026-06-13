import pytest
from unittest.mock import patch

@patch('backend.routes.feed.generate_feed')
def test_get_feed_returns_json(mock_generate, client):
    """
    checks if the feed endpoint respects RESTful rules and returns JSON
    """
    mock_generate.return_value = [{"id": "story1", "items": []}]

    response = client.get('/api/items')
    
    assert response.status_code == 200
    assert response.is_json
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 1

@patch('backend.routes.feed.generate_feed')
def test_get_feed_handles_filters(mock_generate, client):
    """
    checks parsing of endpoints
    """
    mock_generate.return_value = []
    
    response = client.get('/api/items?source=video&sort=recency&query=python')
    
    assert response.status_code == 200
    mock_generate.assert_called_once_with(
        user_id=1, # for now just hardcoded in feed.py, later retrievingf from authentication
        source_filter="video",
        sort_by="recency",
        search_query="python"
    )


@patch('backend.routes.feed.generate_feed')
def test_get_feed_returns_500_on_internal_error(mock_generate, client):
    """
    checking exception and 500 eror
    """
    mock_generate.side_effect = Exception("Simulated database or network crash")
    
    response = client.get('/api/items')
    
    assert response.status_code == 500
    assert response.is_json
    data = response.get_json()
    assert "error" in data
    assert data["details"] == "Simulated database or network crash"