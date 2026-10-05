def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "StyleSphere"
    assert "version" in data


def test_health_db_check(client):
    response = client.get("/health/db")
    assert response.status_code == 200
    data = response.json()
    assert "database" in data
    assert data["database"] == "Neon PostgreSQL"

