import hashlib
import json
from pathlib import Path

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.main import app
from scripts.inspect_lack import ASSETS, inventory, read_glb

REFERENCE = json.loads((ASSETS / "reference.json").read_text())


def test_original_source_files_are_unchanged():
    for filename, source in REFERENCE["files"].items():
        assert hashlib.sha256((ASSETS / filename).read_bytes()).hexdigest() == source["sha256"]
        assert REFERENCE["upstream_commit"] in source["url"]


def test_reference_inventory_matches_actual_glb():
    actual = inventory(read_glb(ASSETS / "model.glb"))
    assert actual == REFERENCE["parts"]
    assert len(actual) == 9
    assert sum(p["category"] == "connector" for p in actual) == 4
    assert len({p["mesh_index"] for p in actual if p["category"] == "leg"}) == 1


def test_selected_connector_and_leg_share_attachment_axis():
    parts = {p["node_index"]: p for p in REFERENCE["parts"]}
    connector = parts[REFERENCE["animation"]["connector_node"]]
    leg = parts[REFERENCE["animation"]["leg_node"]]
    assert connector["category"] == "connector"
    assert leg["category"] == "leg"
    for axis in (0, 2):
        assert connector["translation"][axis] == pytest.approx(leg["translation"][axis], abs=1e-6)


def test_four_connections_cover_every_leg_and_connector_once():
    parts = {p["node_index"]: p for p in REFERENCE["parts"]}
    connections = REFERENCE["animation"]["connections"]
    assert {c["leg_node"] for c in connections} == {p["node_index"] for p in parts.values() if p["category"] == "leg"}
    assert {c["connector_node"] for c in connections} == {p["node_index"] for p in parts.values() if p["category"] == "connector"}
    assert len(connections) == 4
    for connection in connections:
        for axis in (0, 2):
            assert parts[connection["leg_node"]]["translation"][axis] == pytest.approx(parts[connection["connector_node"]]["translation"][axis], abs=1e-6)


def test_manual_revision_and_page_count():
    with pymupdf.open(ASSETS / "manual.pdf") as doc:
        assert len(doc) == 1
        assert REFERENCE["manual_document"] in doc[0].get_text()


@pytest.mark.parametrize("filename", ["model.glb", "manual.pdf", "reference.json", "manual-page-1.png", "LICENSE.md"])
def test_source_assets_are_served(filename):
    response = TestClient(app).get(f"/assets/lack/{filename}")
    assert response.status_code == 200
    assert response.content == (ASSETS / filename).read_bytes()
