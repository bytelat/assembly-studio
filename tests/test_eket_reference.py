import hashlib
import json
from pathlib import Path

import pymupdf
from fastapi.testclient import TestClient

from app.main import app
from scripts.inspect_lack import read_glb

ASSETS = Path(__file__).resolve().parent.parent / 'web/assets/eket'


def test_eket_reference_matches_original_model_and_manual():
    reference = json.loads((ASSETS / 'reference.json').read_text())
    gltf = read_glb(ASSETS / 'model.glb')
    actual = {i: node['name'] for i, node in enumerate(gltf['nodes']) if 'mesh' in node}
    assert {p['node_index']: p['node_name'] for p in reference['parts']} == actual
    assert len(actual) == 21
    assert reference['summary'] == {'panel_nodes': 5, 'hardware_nodes': 16}
    for filename, source in reference['files'].items():
        assert hashlib.sha256((ASSETS / filename).read_bytes()).hexdigest() == source['sha256']
    with pymupdf.open(ASSETS / 'manual.pdf') as doc:
        assert len(doc) == reference['manual_pages'] == 20
        assert any('AA-1914763-5' in page.get_text() for page in doc)


def test_eket_page_and_assets_available():
    client = TestClient(app)
    for path in ['/eket.html', '/eket.js', '/assets/eket/model.glb', '/assets/eket/manual.pdf', '/assets/eket/reference.json']:
        assert client.get(path).status_code == 200


def test_remote_download_is_compressed_without_changing_model():
    response = TestClient(app).get('/assets/eket/model.glb', headers={'Accept-Encoding': 'gzip'})
    assert response.status_code == 200
    assert response.headers['content-encoding'] == 'gzip'
    assert 'accept-encoding' in response.headers['vary'].lower()
    assert response.content == (ASSETS / 'model.glb').read_bytes()


def test_metadata_is_uncompressed_and_uncached_for_remote_tunnels():
    response = TestClient(app).get('/assets/eket/reference.json', headers={'Accept-Encoding': 'gzip'})
    assert 'content-encoding' not in response.headers
    assert response.headers['cache-control'] == 'no-store'
    assert response.json()['article_number'] == '70332124'
