"""Record component nodes from the unmodified EKET model; no assembly plan inferred."""
import hashlib
import json
from pathlib import Path

from inspect_lack import COMMIT, UPSTREAM, read_glb

assets = Path(__file__).resolve().parent.parent / "web/assets/eket"
gltf = read_glb(assets / "model.glb")
parts = []
for index, node in enumerate(gltf["nodes"]):
    if "mesh" not in node:
        continue
    parts.append({"node_index": index, "node_name": node["name"], "category": "panel" if "panel" in node["name"] else "hardware", "mesh_index": node["mesh"]})
files = {
    "model.glb": "Dataset/EKET_70332124_35x25x35/glTF_glb/EKET_70332124_35x25x35.glb",
    "manual.pdf": "Dataset/EKET_70332124_35x25x35/pdf_documentation/AA-1914763-5.pdf",
}
reference = {
    "product": "IKEA EKET small cabinet, white, 35 × 25 × 35 cm",
    "article_number": "70332124", "manual_document": "AA-1914763-5", "manual_pages": 20,
    "upstream_commit": COMMIT, "license": "CC BY-NC-SA 4.0", "copyright": "Inter IKEA Systems B.V.",
    "review_status": "Original supplied model inspection only; no assembly sequence generated or physically tested",
    "files": {name: {"url": UPSTREAM + path, "sha256": hashlib.sha256((assets / name).read_bytes()).hexdigest()} for name, path in files.items()},
    "parts": parts,
    "summary": {"panel_nodes": sum(p["category"] == "panel" for p in parts), "hardware_nodes": sum(p["category"] == "hardware" for p in parts)},
    "notice": "Counts describe nodes in this digital model, not an independently verified complete physical inventory. Node names are source labels, not verified spare-part ordering instructions.",
}
(assets / "reference.json").write_text(json.dumps(reference, indent=2) + "\n")
print(f"EKET: {len(parts)} component nodes; reference.json written.")
