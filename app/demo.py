"""Source-reviewed LACK experiment. Motion is illustrative, not CAD kinematics."""
import json
from pathlib import Path

REFERENCE = json.loads((Path(__file__).resolve().parent.parent / "web/assets/lack/reference.json").read_text())

# Pair by shared source-model attachment axes; numbering is our presentation order.
CONNECTIONS = REFERENCE["animation"]["connections"]

STEPS = [{"title": "Identify the parts", "instruction": "Lay out one tabletop, four legs, and four connectors (115980). This guide repeats the connection shown on page 1 for each of the four corners, with the tabletop upside down on a protected surface.", "focus": "inventory", "corner": None, "part": "1 top · 4 legs · 4 connectors", "hint": "Play starts the assembly. Keep Continue automatically checked to play through all four legs."}]
for corner, connection in enumerate(CONNECTIONS):
    number = corner + 1
    STEPS.extend([
        {"title": f"Insert connector {number}", "instruction": f"At corner {number}, turn a double-ended connector into the underside of the tabletop, as illustrated on page 1. Previously positioned parts remain visible.", "focus": "connector", "corner": corner, "part": "1 connector · 115980", "hint": "Amber highlights the active part. Motion is illustrative; no turn count or torque is specified."},
        {"title": f"Attach leg {number}", "instruction": f"Turn leg {number} onto the exposed connector at corner {number}. The illustration shows the connection sequence; this animation brings the original model parts to their assembled positions.", "focus": "leg", "corner": corner, "part": f"Leg {number} of 4 · connector already positioned", "hint": "Pause to inspect this connection. Continue automatically moves to the next stage when playback finishes."},
    ])
STEPS.append({"title": "Review the assembled model", "instruction": "All four modeled connections are now in place. Inspect the upright model and compare your work with the original manual. This view does not demonstrate physically turning the table upright or verify that fasteners are tight.", "focus": "review", "corner": None, "part": "1 tabletop · 4 legs · 4 connectors", "hint": "The motion is illustrative and has not been physically tested. Follow the original manual for your exact product."})

DEMO = {
    "id": "lack-30449908-aa2072764-four-legs-v2",
    "name": REFERENCE["product"],
    "status": REFERENCE["review_status"],
    "model_url": "/assets/lack/model.glb",
    "manual_url": "/assets/lack/manual.pdf",
    "reference_url": "/assets/lack/reference.json",
    "parts": REFERENCE["summary"],
    "reference": REFERENCE,
    "connections": CONNECTIONS,
    "steps": STEPS,
}
