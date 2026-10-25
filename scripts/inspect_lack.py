"""Rebuild the inventory from pinned IKEA GLB; uses only the Python standard library."""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "web/assets/lack"
COMMIT = "2c3f453a7ed7e3a056939ecca6a888ccfaf5695c"
UPSTREAM = f"https://raw.githubusercontent.com/IKEA/IKEA3DAssemblyDataset/{COMMIT}/"
FILES = {
    "model.glb": "Dataset/LACK_30449908_55x55/glTF_glb/LACK_30449908_55x55.glb",
    "manual.pdf": "Dataset/LACK_30449908_55x55/pdf_documentation/AA-207276-4.pdf",
    "LICENSE.md": "LICENSE.md",
    "UPSTREAM-README.md": "README.md",
}


def read_glb(path):
    data = path.read_bytes()
    magic, version, size = struct.unpack_from("<4sII", data)
    if (magic, version, size) != (b"glTF", 2, len(data)):
        raise ValueError("Invalid GLB header")
    length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise ValueError("Missing GLB JSON chunk")
    return json.loads(data[20:20 + length])


def inventory(gltf):
    parts = []
    for node_id, node in enumerate(gltf["nodes"]):
        if "mesh" not in node:
            continue
        name = node["name"]
        category = "top" if name.startswith("table top_") else "leg" if name.startswith("table leg_") else "connector" if name.startswith("115980_") else None
        if category is None:
            raise ValueError(f"Unknown component: {name}")
        mesh = gltf["meshes"][node["mesh"]]
        bounds = [gltf["accessors"][p["attributes"]["POSITION"]] for p in mesh["primitives"]]
        minimum = [min(b["min"][axis] for b in bounds) for axis in range(3)]
        maximum = [max(b["max"][axis] for b in bounds) for axis in range(3)]
        parts.append({
            "id": f"node-{node_id}", "node_index": node_id, "node_name": name,
            "category": category, "mesh_index": node["mesh"],
            "mesh_local_dimensions_m": [round(hi - lo, 7) for lo, hi in zip(minimum, maximum)],
            "translation": node.get("translation", [0, 0, 0]),
            "rotation": node.get("rotation", [0, 0, 0, 1]),
            "scale": node.get("scale", [1, 1, 1]),
            "source_page": 1 if category == "connector" else None,
            "evidence": "GLB node and manual hardware illustration" if category == "connector" else "GLB node; manual illustrates component without a labeled parts inventory",
        })
    if {kind: sum(p["category"] == kind for p in parts) for kind in ("top", "leg", "connector")} != {"top": 1, "leg": 4, "connector": 4}:
        raise ValueError("Unexpected component quantities")
    return parts


def main():
    gltf = read_glb(ASSETS / "model.glb")
    result = {
        "product": "IKEA LACK side table, white, 55 × 55 cm",
        "article_number": "30449908", "manual_document": "AA-207276-4",
        "upstream_commit": COMMIT, "units": "meters", "license": "CC BY-NC-SA 4.0",
        "copyright": "Inter IKEA Systems B.V.",
        "review_status": "Checked against supplied model and manual; not physically tested",
        "files": {name: {"url": UPSTREAM + path, "sha256": hashlib.sha256((ASSETS / name).read_bytes()).hexdigest()} for name, path in FILES.items()},
        "parts": inventory(gltf),
        "summary": [
            {"id": "top", "name": "Tabletop", "quantity": 1, "identifier": "00167769 (model label only)"},
            {"id": "leg", "name": "Leg", "quantity": 4, "identifier": "00167768 (model label only)"},
            {"id": "connector", "name": "Double-ended connector", "quantity": 4, "identifier": "115980 (manual hardware number)"},
        ],
        "animation": {"top_node": 1, "connector_node": 9, "leg_node": 7,
                      "sequence": "Insert connector into underside of tabletop, then attach leg at that corner.",
                      "connections": [{"connector_node": 9, "leg_node": 7}, {"connector_node": 2, "leg_node": 6}, {"connector_node": 4, "leg_node": 5}, {"connector_node": 3, "leg_node": 8}],
                      "source_page": 1, "motion_status": "Illustrative paths and rotations; no inferred thread pitch, torque, or turn count"},
        "uncertainties": [
            "Only the historical dataset article/manual pairing has been checked; current and regional variants may differ.",
            "Thread pitch, tightening torque, and required turn count are not specified in the supplied manual.",
            "Mesh bounds describe the supplied digital geometry, not independent manufacturing measurements.",
            "No physical assembly or tool-clearance test has been performed.",
            "The same illustrated connection is repeated at four corners; corner order and motion are authored, not separately specified by the manual.",
        ],
    }
    (ASSETS / "reference.json").write_text(json.dumps(result, indent=2) + "\n")
    print("Inspected 9 component nodes: 1 tabletop, 4 legs, 4 connectors. Saved reference.json.")


if __name__ == "__main__":
    main()
