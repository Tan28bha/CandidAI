from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    """
    Test that the general health check endpoint responds with 200 and 'healthy'
    """
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
