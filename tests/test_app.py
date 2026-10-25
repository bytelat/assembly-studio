import json

import httpx
import pymupdf
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.models import ManualAnalysis

client = TestClient(app)


def test_frontend_revalidates_and_viewer_diagnostics_are_available():
    assert client.get('/').headers['cache-control'] == 'no-store'
    assert client.get('/app.js').headers['cache-control'] == 'no-store'
    assert client.post('/api/viewer-diagnostics', json={'stage': 'webgl', 'message': 'Test context unavailable'}).status_code == 204
    assert client.get('/api/viewer-diagnostics').json()[-1]['stage'] == 'webgl'
    assert client.post('/api/viewer-diagnostics', json={'stage': 'invalid', 'message': 'x'}).status_code == 422


def draft():
    return {"product_name": "Sample", "parts": [{"id": "A", "name": "Panel", "quantity": 1, "source_page": 1}], "steps": [{"number": 1, "instruction": "Place panel", "part_ids": ["A"], "source_page": 1}]}


def pdf(pages=1):
    with pymupdf.open() as doc:
        for _ in range(pages):
            doc.new_page().insert_text((50, 50), "Sample assembly manual")
        return doc.tobytes()


def test_demo_and_static_interface():
    assert client.get("/").status_code == 200
    data = client.get("/api/demo").json()
    assert len(data["steps"]) == 10
    assert "not physically tested" in data["status"]
    assert data["model_url"] == "/assets/lack/model.glb"
    assert data["reference"]["manual_document"] == "AA-207276-4"


@pytest.mark.parametrize("mutation", [
    lambda d: d["steps"][0].update(part_ids=["missing"]),
    lambda d: d["steps"][0].update(number=2),
    lambda d: d["parts"].append(d["parts"][0].copy()),
    lambda d: d["parts"][0].update(quantity=0),
])
def test_invalid_assembly_data_rejected(mutation):
    data = draft()
    mutation(data)
    with pytest.raises(ValidationError):
        ManualAnalysis.model_validate(data)


def test_no_key_is_actionable(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    result = client.post("/api/analyze", files={"file": ("manual.pdf", pdf(), "application/pdf")})
    assert result.status_code == 503
    assert "DEEPSEEK_API_KEY" in result.json()["detail"]


@pytest.mark.parametrize("content,status", [(b"not a PDF", 422), (b"%PDF-" + b"a" * (12 * 1024 * 1024), 413)])
def test_bad_upload_rejected(monkeypatch, content, status):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-not-real")
    assert client.post("/api/analyze", files={"file": ("manual.pdf", content)}).status_code == status


def test_page_limit_is_explicit(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-not-real")
    result = client.post("/api/analyze", files={"file": ("manual.pdf", pdf(13))})
    assert result.status_code == 422
    assert "silently skipped" in result.json()["detail"]


@pytest.mark.parametrize("upstream_status,invalid_page,expected", [(200, False, 200), (200, True, 502), (401, False, 502), (402, False, 502), (429, False, 502)])
def test_provider_contract(monkeypatch, upstream_status, invalid_page, expected):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-not-real")
    data = draft()
    if invalid_page:
        data["steps"][0]["source_page"] = 99

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, *, headers, json):
            assert url == "https://api.deepseek.com/chat/completions"
            assert headers["Authorization"] == "Bearer test-not-real"
            assert any(item["type"] == "image_url" for item in json["messages"][0]["content"])
            return httpx.Response(upstream_status, request=httpx.Request("POST", url), json={"choices": [{"message": {"content": __import__('json').dumps(data)}}]})

    monkeypatch.setattr("app.main.httpx.AsyncClient", FakeClient)
    response = client.post("/api/analyze", files={"file": ("manual.pdf", pdf())})
    assert response.status_code == expected
    assert "test-not-real" not in response.text
    if expected == 200:
        assert response.json()["status"] == "unreviewed"
        assert response.json()["page_count"] == 1
