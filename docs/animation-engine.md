# Manual-to-animation experiment

## What is reusable now

`app/animation_schema.py` defines a product-independent JSON motion format.
`web/motion-player.js` evaluates that data for arbitrary node IDs; `web/viewer.js`
applies offsets to existing source meshes. The generic player has no EKET panel
movement rules. LACK's older hand-programmed demonstration remains a separate path.

`app/animation_api.py` asks DeepSeek to propose exactly one step using a selected
manual page and source geometry metadata. The provider can abstain if it cannot
support a part mapping or movement. Real generation requires a configured API key;
mocked tests are not evidence of model quality.

## Source preparation versus generated movement

The EKET geometry already exists in IKEA's dataset. `scripts/enrich_animation_inventory.py`
records the model's original node labels, transforms, parent IDs, and bounding boxes.
It does not infer an assembly action. This context is supplied to the provider along
with manual images (the selected page plus warning/inventory context).

The selected page defaults to PDF page 8, which contains the first illustrated assembly
step. Page numbers mean PDF pages, not diagram step numbers. Page 7 is the hardware
inventory and page 2 contains warnings. Selecting another page does not automatically
incur a generation call.

## Motion format v1

- `product_id`, `source_document`, and both source SHA-256 hashes bind the plan to a
  specific model/manual pair.
- `coordinate_space` is `source_node_parent_meters`. Offsets are applied in the node's
  existing parent axes, not camera axes or mesh-local axes. Original scaling is retained.
- Each step supplies its instructions, source pages, visible node IDs, duration,
  warnings, uncertainties, and motion tracks.
- A track identifies one existing node and supplies starting/ending translation and XYZ
  Euler-degree rotation offsets. The offset rotation is pre-multiplied onto the original
  source quaternion. Progress is smoothly interpolated within the track's fractional
  start/end interval.
- This version only accepts tracks ending at zero offsets and rotations, meaning the
  part docks at its original assembled source transform. It cannot create shapes,
  resize parts, execute scripts, or reference external model URLs.
- Each node can have one track per step. Multiple tracks may move different nodes
  during the same step. Each step explicitly supplies its visible context; untracked
  visible nodes remain at original transforms. Intermediate assembly states and arbitrary
  keyframe sequences require a future format revision.

Fetch `/api/animation/schema` for the machine-readable schema. The complete normalized
hand-authored example is in `fixtures/eket-player-fixture.json`.

## Honest provenance and review

- **Generate one step with DeepSeek** calls the provider and labels the returned draft
  `origin: deepseek`, `review_status: unreviewed`. It is not played automatically.
- **Load hand-authored player fixture** loads an explicitly developer-authored movement
  for mechanical testing. It is not substituted for AI output when a key is absent or
  generation fails. Its page-9 reference is for comparison, not a claim that its path
  was recovered from the diagram.
- **Validate and preview edited JSON** labels the result `origin: imported_json` and
  records user import in `human_edits`; it does not retain an AI authorship claim.
- Download saves the plan together with its provenance, review status, and validation
  notice. The generator preserves provider final-answer text, completion status, and token usage under ignored `data/provider-responses` for diagnosis, without API keys, request headers, or reasoning traces. Complete evaluation envelopes are explicitly saved by `scripts/generate_step.py` under ignored `data/animation-runs`; the saved-result button reads those without a new provider call. Manual edits are not automatically persisted.

Structural checks reject unknown part IDs, wrong hashes/manual revisions, out-of-range
pages, non-finite/bounded motion values, duplicate tracks, hidden moving parts, and
non-docking endpoints. A generation response must cite the selected page and contain
exactly one step. The general import/player format supports multiple steps.

These checks do **not** prove diagram understanding, part identity, collision-free
movement, tool access, correct thread engagement, or physical assembly safety. Inferred
motions must remain visible as uncertainties. No self-reported confidence is treated as
verification. Geometry acquisition from a manual without existing CAD remains unsolved.

## APIs and verification

- `GET /api/animation/schema`: format definition.
- `GET /api/animation/manual-page?product_id=eket-70332124&page=8`: original page image.
- `GET /api/animation/fixture`: explicitly hand-authored offline test envelope.
- `POST /api/animation/validate`: validate raw JSON against its known source.
- `POST /api/animation/generate`: `{ "product_id": "eket-70332124", "source_page": 8 }`.

Python tests mock the provider and verify abstention, identity checks, error handling,
and provenance. JavaScript tests exercise arbitrary node IDs and all three coordinate
axes. Browser tests check actual fixture-driven geometry playback, pause, scrub, and
camera rotation. None of these tests make paid provider calls.

## First real evaluation

Set `DEEPSEEK_API_KEY` privately in the project `.env` file, restart, then generate one
page-8 step. Inspect the proposed part IDs and movement against the original image.
Keep the untouched provider result, list all uncertainties, and record every human
correction through the import path. Success must be judged on the actual output;
passing parser/player tests alone does not prove automatic animation quality.

## Live evaluation findings

The first real page-8 draft selected two opposite side panels that remain about 0.316 m apart; a separate review rejected it without editing its instructions. A generic large-component AABB proximity check was added and its contact candidates supplied to the provider. The second draft passed proximity but assumed a later multi-panel assembly state absent from the selected diagram; a separate manual-context review rejected it. This demonstrates that geometric proximity is necessary evidence, not proof of manual understanding. Later tests must be judged on their own preserved outputs.

Raw plans remain unchanged. Reviews use separate `.review.json` files and appear in the interface. A rejected result can be inspected diagnostically but must not be treated as assembly guidance. Provider/schema failures do not fall back to a fixture.

## Continuing a tentative draft

Generation accepts `printed_step` (an explicit printed step/action selector) and optional
`previous_plan`. Prior source identities are validated before a paid request; prior manual
pages and the unedited plan, including uncertainties, accompany the new request. The
provider still returns only one new action. V1 requires every previously visible node to
remain visible and stationary at its assembled transform; actions needing repositioning
must abstain or await a richer motion format. This constraint does not establish that
prior assembly is correct.

`POST /api/animation/compose` accepts `previous_plan` and `next_plan`, checks source
identity and continuity, and labels the result `composed_draft`. The UI retains both
source envelopes in downloads. Composition does not confer AI authorship or acceptance.
Provider response text is preserved before JSON parsing, including malformed responses.

## All-step manual navigator

The EKET page has an **Open all 11 steps** button above the viewer. It loads the
preserved manual navigator bundled in the HTML, opens step 1 directly, and exposes
Previous/Next plus a step selector. Each entry shows the corresponding original
manual page next to the cabinet. Static page PNGs are rendered from the supplied PDF;
they are original source evidence, not generated illustrations. Pages 12–13 and 18
remain linked for alternative support/mounting branches and separate accessory manuals.

`AnimationStep.kind` defaults to `motion` for backward compatibility. A motion step
must contain at least one track. `kind: manual_reference` requires zero tracks and
explicitly means an unanimated source-diagram reference. `printed_step` optionally
records the diagram number; it is distinct from its PDF page number. Diagram-only
entries disable Play/scrub while retaining navigation and stationary context. Their
source-node visibility is assistant-authored and tentative, not provider output or
proof that assembly was completed. No missing wall, screws or accessory legs are invented.

`PYTHONPATH=. .venv/bin/python scripts/build_eket_guide.py` reproducibly composes the
11-entry navigator from preserved candidates and assistant-authored summaries, renders
original page images, and saves `data/animation-runs/eket-complete-manual-guide.json`.
Pass `--candidate <preserved-run>` to retain additional candidate envelopes/reviews.
Rejected or geometry-flagged outputs are retained as provenance but excluded from
playback. `/api/animation/saved-guide` validates the complete navigator and continuity.
The first two existing actions remain unverified motion drafts; steps 3–11 are manual
references. This is complete manual coverage, not a complete animated assembly guide.

The October 22 printed-step-3 generation selected node 2 (thick bottom panel) for the
thin groove-inserted panel. A separate review rejects it. Its original output is
preserved as `20261022T073524153816Z.json`; no paid retries or later generation calls
were made. The unresolved mapping is not propagated as prior context for step 4.

## Motion format v2 and evidence-driven generation

V2 adds per-node keyframes (`fraction`, `offset_m`, `rotation_deg`) and whole-assembly
`assembly_keyframes` around a fixed `assembly_pivot_m` in the common source-parent
frame. Node poses are evaluated first, then the shared rigid transform. Local endpoint
poses and assembly orientation persist across later steps and direct navigation.
Already-visible parts can move again only from their preceding endpoint; discontinuous
poses, disappearing assembled parts, mixed transform formats and invalid times fail
validation. V1 plans remain supported unchanged.

Keyframe fractions lie within [0,1] and increase strictly. A delayed track holds its
first pose before its first keyframe; an early-finishing track holds its last pose.
Interpolation is smooth by default, or linear per node. Explicit legacy timing may
only repeat the keyframe boundaries. Generation uses a dedicated keyframe-only v2
schema that omits legacy from/to and start/end fields entirely; this avoids conflicting
timing from the provider. Group rotations interpolate XYZ Euler offsets; no general
rig/physics, drilling, mesh removal or missing hardware generation is claimed.

`GET /api/animation/fixture?version=2` loads the clearly hand-authored mechanical test
in `fixtures/eket-player-v2-fixture.json`: staged translation, partial endpoint,
continuation, shared rotation, then a static hold. The UI exposes this under **Load v2
engine test (hand-authored)**. This fixture is not a generated assembly result.

Source preparation now supplies measured shape spans and planar-thickness cues.
`web/assets/eket/manual-action-evidence.json` records separately assistant-reviewed
part identities, source hashes, page numbers and approach-side constraints. Evidence
is supplied in the generation prompt and validated against the returned moving IDs
and initial offsets. It is an input correction, not proof of independent model success.
The generator includes `input_evidence` in each result and preserves final-answer text.

A translation-only AABB screen samples 21 points and flags overlap exceeding final
seating overlap. This caught a step-4 proposal starting inside the frame despite its
correct final contact. Rotated paths and small hardware are outside this screening
scope; a pass never establishes collision freedom or correct fitting engagement.

The generator now requests explicit low reasoning effort and a 16,000-token output
allowance. The initial v2 request exhausted the earlier 12,000-token allowance without
producing a final answer; it was inspected before a single adjusted retry. Thinking
controls follow https://api-docs.deepseek.com/guides/thinking_mode/ . No paid POST is
automatically retried.

`scripts/revalidate_animation_response.py` can explicitly revalidate a complete
preserved final answer after a schema extension. It does not edit the final answer or
delete the original rejection. The step-6 draft was revalidated after adding delayed
boundary holds; its saved envelope and audit disclose that fact.

## Current saved motion coverage

The composed manual navigator now has motion drafts for printed steps **1,2,3,4,6,7,9**.
Step 9 includes only axial approach/seating, not the illustrated turning action. The
original step-1 seating press is also omitted. Steps **5,8,10,11** remain diagram-only;
working reorientation, drilling, wall adjustment and wall fixing are not established.
All drafts remain unverified and retain explicit uncertainties and separate reviews.

Rebuild from the local preserved candidates with:

```sh
PYTHONPATH=. .venv/bin/python scripts/build_eket_guide.py --candidate-manifest data/animation-runs/eket-guide-candidates.json
```

The builder rechecks source identity and geometry, excludes rejected/flagged drafts,
and preserves their envelopes as provenance. UI playback data omits duplicate raw
outputs and nested prior plans to reduce the page size. **Download plan & provenance**
retrieves the full preserved result, including source envelopes and reviews.

## Viewer delivery and inspection

`node scripts/bundle-viewer.cjs` (also `npm run build:viewer`) uses the installed webpack
5 toolchain (5.105.4 here) to rebuild `web/generated/viewer.bundle.js` and `.gz` from the
local, licensed Three.js files and generic player. Rebuild after editing viewer/player
sources. Generated files are retained for runtime use; no CDN or runtime bundler is
required. `/viewer.bundle.js` negotiates the precompressed representation and sends a
fixed Content-Length; it is approximately 144 KiB gzip instead of a multi-file module
graph. Third-party notices and the vendored Three.js license remain present.

The camera frames the currently moving source parts from their outside face, making
rear hardware visible. Orbit includes underside inspection; the cosmetic floor is
hidden for animation plans so it does not obscure those actions. Browser tests measure
actual mesh transforms for endpoint retention and shared rigid rotation and verify
that the normal viewer loads without fetching the source-module graph. Remote tunnel
performance still requires confirmation in the user's Chrome.

## Hardware completeness and inspection

`web/assets/eket/manual-hardware.json` is a separate source-bound assistant transcription
of PDF page 7: 139434 x4, 139435 x4, 141413 x2, 141414 x2, 152651 x2 and 152650 x2.
`app/hardware_inventory.py` audits these labels against the source reference and actual
plan visibility/tracks. The guide builder includes this audit in its envelope and writes
`web/assets/eket/hardware-audit.json`; matching counts do not establish complete physical
inventory or correct fitting engagement.

All 16 loose pieces have matching source nodes. Eight are animated in step 6, two in
step 7, two in step 9, and four washer/cap nodes appear only in manual-reference step 11.
The panel-joining details in early steps have no independently named hardware nodes;
their separate engagement is not animated. Wall screws, drill/tools and optional legs
are not modelled.

**Inspect the small parts** above the viewer exposes each of the 16 individual pieces,
plus source panel geometry for joint inspection. Choosing a part hides other meshes,
restores that part's source transform, and moves the camera closer. It does not scale,
create, install or animate a part. Neutral inspection shading and an inspection light
make dark source materials readable; assembly shading returns on exit. Playback is
paused/disabled during inspection, and returning restores the prior plan step and pose.
The inspector reports the part number, instance count, coverage and original manual link.

### Step-11 washer and cover motion

`web/assets/eket/manual-motion-drafts.json` records a separate, assistant-authored visualization bound to the original model/manual hashes. The guide builder composes it without modifying provider results, retaining its evidence and authorship in `authored_motion` and `coverage.authored_motion_steps`. Nodes 14/20 (152651 washers) seat sequentially before nodes 16/18 (152650 covers) approach from the open cabinet side, positive parent X. Distances/timing are illustrative; original source poses and orientations are the endpoints. Wall screws/attachment and cover turning/locking remain omitted and visibly disclosed. Embedded panel connectors have no separately named nodes and remain unresolved. The guide now has eight motion drafts; steps 5,8,10 remain diagram-only. The generic camera uses hardware approach direction transformed into world space, so internal rear fittings are viewed through the opening rather than through the back panel.

Hardware playback instructions now derive current part/instance from actual track start/end fractions and source-bound inventory metadata. Individual part buttons seek/reframe in assembly context, with optional close-up framing in the generic viewer. Timed envelope playback_cues disclose omitted operations between tracks; they are explanatory captions, not motion or proof of completed fastening.

Live hardware detail now renders a second viewport of the same scene, same source mesh and same current animation pose. No model reload, cloned geometry, isolated source transform or mesh scaling. It tracks the labelled active hardware node and keeps the main cabinet view. For concurrent tracks the detail cycles among active instances; explicit part replay takes priority. Timed omitted-operation cues and source inspection hide the detail. Live part close-ups checkbox can disable it. Near camera framing follows current mesh bounds from its approach side without changing assembly transforms or main orbit controls.

## Shared product interface

All normal product routes render `web/assembly.html` with the identical `web/assembly-player.js` controller. `app/product_catalog.py` normalizes existing guides and supplies model/source metadata, step counts, diagrams/phases, optional checkpoint tours, overview stages and presentation poses. UI behavior never branches on product identity. LACK legacy connector/leg demonstrations are adapted into the same validated v2 keyframe plan; eight connection actions preserve original node pairings and illustrative rotations. Inventory/final review use labelled source overviews. EKET raw provider provenance remains downloadable; its unanimated operations stay disclosed. DALFRED retained seat subassembly poses and diagram phases carry through unchanged.

Common controls are Play step, Play all steps, Pause, Previous/Next, step dropdown, scrubber, source-part inspection, assembled source view and reset. Counts/end conditions derive from plan length. Manual references keep 3D context visible and do not claim movement. All registered model endpoints support byte-range download and failed-chunk retry. The old upload/generation labs are retained at `/lack-lab.html` and `/eket-lab.html`; they do not define the normal product interface.
