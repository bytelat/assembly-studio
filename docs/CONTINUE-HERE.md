# New-session handoff — October 22, 2026

The user resumed today and authorized continuing, then requested this handoff for a new session. Today's resumed work only read this note, the animation API/schema, and the Sites skill. No code changes, provider calls, server restarts, or tests were performed during that resumed work. This handoff update is the only subsequent file change.

## Workspace and authorization

- Project: `/home/gigi/git/assembly-guide`, local Git branch `main`. Existing work is uncommitted; no remote or commits were created. Inspect status before editing and preserve all existing work.
- Goal: a reusable engine that turns furniture manuals and available source geometry into accurate step-by-step animation with pause and 360° orbit. The user has no GPU; DeepSeek provides remote inference.
- Continue implementation autonomously within this scope. Do not publish the app or send messages externally. Do not expose credentials or invent missing part geometry.
- The browser is Chrome on the user's remote computer, reached through a private VS Code forwarded port. A localhost URL on the server is not directly reachable from that computer.

## Where we stopped

The user asked how to advance to the next step. EKET currently has **one partial AI-generated step**, derived from PDF page 8. Its Next button is disabled because there is no second step in that plan. The proposed next action is to select PDF page 9 and generate/review the next action. Page 9 contains printed steps 2 and 3: distinguish them explicitly rather than pretending one PDF page equals one assembly step.

## Next work

1. Verify the app is running from `/home/gigi/git/assembly-guide` on loopback port 8000; VS Code forwards that port to the user's Chrome browser.
2. Inspect the saved page-8 candidate and its uncertainties before using it as prior assembly context.
3. Generate and review the next EKET action from PDF page 9. Preserve the unedited provider result and record any reviews/corrections separately. Do not automatically accept geometric contact as proof of manual correctness.
4. Work toward a multi-step plan with functioning Previous/Next navigation, maintaining already assembled parts. The player format supports multiple steps, but the generation endpoint currently enforces a one-step experiment; do not claim a complete guide exists.
5. Extend generation with an explicit action/printed-step selector and validated previous-plan context before requesting page 9. Include prior visible assembled parts and source evidence. Validate continuity, preserve provider output before parsing, and label composition or human edits honestly. Avoid repeated paid calls without inspecting failures.

## What actually exists

- LACK: a manually programmed demonstration using original IKEA geometry; not evidence of automatic generation.
- EKET: original IKEA geometry plus a generic JSON-driven motion player and DeepSeek one-step generation integration.
- Latest preserved AI candidate: `data/animation-runs/20261021T143206162427Z.json`, with separate `.review.json`. It uses a two-panel slide, but exact panel mapping and seating motion remain unresolved. It is a partial, unverified candidate, not validated assembly guidance.
- Earlier rejected outputs/reviews are preserved under `data/animation-runs/`. Do not silently replace them or label fixtures as AI output.
- Hand-authored mechanical fixture: `fixtures/eket-player-fixture.json`, explicitly labeled in UI.
- DeepSeek key is configured privately in `.env`, ignored by Git. Never print it. Supported configured model is `deepseek-flash`; a previous model-name typo was corrected.

## Implementation map and limits

- `app/animation_api.py`: `/api/animation/generate`, `/saved-result`, `/validate`, `/fixture`, `/manual-page`, `/schema`. Generate currently accepts only `product_id` and `source_page`, requires exactly one step, and has no prior assembly context. Saved-result loads the latest saved envelope, not a sequence.
- `app/animation_schema.py`: strict Pydantic schema. Tracks use offsets in source-node parent meters and optional Euler rotation offsets. Every track ends at the original assembled transform (zero translation/rotation offsets); one track per moving node. No arbitrary intermediate keyframes.
- `web/motion-player.js`: generic motion evaluation. `web/viewer.js`: Three.js rendering and orbit. `web/eket.js` and `web/eket.html`: experiment UI and multi-step playback controls, currently fed one-step proposals.
- `app/geometry_checks.py`: AABB contact heuristics only; passing does not establish correct assembly, collision freedom, or manual fidelity.
- EKET manual: `web/assets/eket/manual.pdf`, AA-1914763-5, 20 pages. Page 7 inventory; PDF page 8 printed step 1; PDF page 9 printed steps 2 and 3. Source CAD has 21 component nodes: five panels and sixteen hardware nodes. This is not a verified physical inventory.
- Latest candidate moves top node 1 from `[0,0,0.05]` to zero with side node 3 visible. The described downward seating press is absent from animation. Exact panel identity, direction, and working orientation remain uncertain.
- Raw provider responses: ignored `data/provider-responses/`; saved envelopes and separate review sidecars: ignored `data/animation-runs/`. Preserve originals. JSON edits must be relabeled; composed drafts must disclose composition and retain review limitations.
- Original assets: https://github.com/IKEA/IKEA3DAssemblyDataset at commit `2c3f453a7ed7e3a056939ecca6a888ccfaf5695c`, CC BY-NC-SA 4.0. Keep attribution and noncommercial restrictions visible in project documentation.

## Running and testing

- Check whether the server still exists before starting another. Last known server yesterday was PID 97694 on `127.0.0.1:8000`; that PID is historical, not verified today. Do not kill it without checking its command.
- Start from the project directory: `/home/gigi/.local/bin/uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`.
- Backend: `/home/gigi/.local/bin/uv run pytest -q`. Node motion checks: `node --test tests/generic-motion.test.mjs tests/motion.test.mjs`.
- Browser tests use a temporary backend on port 8011. Existing environment required `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 LD_LIBRARY_PATH=/tmp/assembly-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run test:browser`. Verify the temporary libraries still exist. `ASSEMBLY_LIVE_QA=1` enables saved real-result playback tests; these do not request new generation.
- Server binding, browser execution, and some tests required sandbox escalation in this environment. On sandbox/network failures, request escalation through the command tool rather than silently changing exposure or bypassing restrictions.
- Do not print `.env`, HTTP authorization headers, or raw environment variables. `/api/health` safely reports key presence and model name.

## User interface

Open EKET cabinet, then scroll to the manual-to-animation experiment. Choose **Load saved AI test (no new API call)**, **Preview this unreviewed plan**, then **Play** beside the viewer. Camera drag allows orbit; scrub/pause are available. Generating another step uses API balance; loading the saved result does not.

## Remote-loading fixes

The user's tunnel sometimes returned empty/truncated JSON. Small JSON responses are now uncompressed and `no-store`. EKET GET metadata requests have a 15-second timeout and one safe retry with cache-busting. Paid generation POSTs are never automatically retried. Large models retain gzip compression and visible progress with a two-minute download limit. Browser failures are reported to `/api/viewer-diagnostics` (in-memory, clears on restart).

## Verification

48 backend tests passed before the final metadata change; the subsequent targeted run passed 19 checks. Browser checks covered actual saved AI output playback, fixture playback, provenance changes after editing, metadata recovery, and no automatic retry of generation POSTs. Browser test setup and host-library details are in README.md. No new provider calls were made while fixing the most recent loading problem.

See `docs/animation-engine.md`, `docs/live-evaluation.md`, and README.md for specifications and limits.

## Continued implementation — October 22

- Added generation `printed_step` selector and optional source-validated `previous_plan`.
  Prior manual pages and full tentative plan accompany the request. V1 continuation
  rejects hiding or moving already visible assembled nodes.
- Provider response text is now saved before JSON parsing. Original candidates remain
  unchanged. `/compose` explicitly labels concatenation `composed_draft`; UI downloads
  retain source envelopes. UI supports selecting a printed action and continuing a loaded draft.
- Made one live request for PDF page 9, printed step 2, using the untouched page-8 plan.
  Result: `data/animation-runs/20261022T071448684552Z.json`; separate review alongside it.
  Node 21 moves from +0.1 m Y to zero; nodes 1 and 3 remain stationary. It passes
  continuity and AABB proximity but panel mapping, working orientation, and insertion
  direction remain unresolved. Not accepted as assembly guidance. No step-3 call made.
- `data/animation-runs/eket-diagnostic-sequence.json` composes those two untouched
  actions with source envelopes and reviews. `/saved-sequence` and the new
  **Load two-step diagnostic draft (no API call)** button expose it for Previous/Next
  playback. This is a diagnostic composition, not an independently generated guide.
- Local server restarted on loopback 8000 with updated code. Use existing VS Code forwarding.
- Backend checks passed 51 tests after continuation changes; both Node motion suites
  passed. Browser verification continues below/in session report.
- Next accuracy work: resolve physical panel mapping and diagram-to-model working
  orientation from source evidence before accepting the candidates or generating step 3.

Final verification: 12 existing browser tests passed (one opt-in test skipped); the new opt-in preserved two-step navigation test passed separately. Final targeted animation API checks: 22 passed. Both Node suites passed. No additional provider requests.

## Remote UI recovery follow-up

User screenshot confirmed `/api/animation/saved-sequence` times out through the
forwarded connection even while local checks succeed. `/eket.html` now embeds the
validated preserved sequence as escaped inert JSON; the sequence button reads it
without a separate API request, retaining source envelopes and reviews. Fallback
API loading remains available when no saved sequence exists. Direct page-render
verification confirmed two steps, provenance and separate reviews; JS syntax passed.
The user's remote Chrome still needs confirmation after refresh.

Earlier follow-up added Loading/Loaded/Retry button states, entry-script and 3D-module
load timeouts, and excluded JavaScript from gzip streaming. A browser-test invocation
was declined by the user; do not describe those recovery changes as browser-verified.
Server restarted with latest changes on loopback 8000.

## All steps requested — October 22 continuation

User asked for all steps. Inspected original manual pages 8–19: there are 11 numbered
steps with optional support/mounting context on pages 12, 13 and 18. Added a complete
manual navigator with a prominent **Open all 11 steps** button above the viewer,
a selector and Previous/Next. Opening it previews directly, without requiring the
old lab Load/Preview sequence. It reads bundled HTML data; source metadata is also
bundled to avoid tunnel metadata requests. Each selected step shows the original PDF
page via a locally rendered static PNG. Manual navigation works even if WebGL fails.

New explicit schema fields: `kind` defaults to `motion`, or `manual_reference` for
zero-track entries; `printed_step` distinguishes diagram numbering from PDF pages.
Play/scrub are disabled for manual-only entries. No invented motion or missing wall/
leg geometry. Complete manual coverage is not complete animation: 2 existing motion
drafts, 9 diagram-only steps. Assistant-authored summaries/static visibility and
printed-step annotations are disclosed separately from untouched source envelopes.

Made one paid request for page 9 printed step 3. Preserved
`data/animation-runs/20261022T073524153816Z.json` and separate rejection review.
The provider selected thick bottom node 2 for the thin groove-inserted panel, despite
thin back node 4 being present. Do not propagate this proposal as prior step-4 context.
No retries or further paid calls. Mapping/orientation accuracy remains the next engine
problem before more animation can be accepted.

`PYTHONPATH=. .venv/bin/python scripts/build_eket_guide.py --candidate data/animation-runs/20261022T073524153816Z.json`
builds `data/animation-runs/eket-complete-manual-guide.json` (all 11 steps, original
source envelopes including rejected output/reviews) and static original page PNGs.
`/api/animation/saved-guide` validates it; `/eket.html` bundles it alongside the old
2-step diagnostic sequence. All artifacts stay local; no publication or commits.
Backend: 53 tests passed. Both Node motion suites passed, including static manual
references. New Chrome navigation test covers 11 steps, direct open, no saved-guide
API call, diagram-only playback disabled, Previous/Next and mobile overflow.

Final all-step verification: 6 targeted Chrome tests passed (one optional old diagnostic
live-data test skipped), including new 11-step navigation and entry-script recovery.
Backend 53 passed and both Node suites passed. Restarted final server on loopback 8000;
HTTP-readback confirmed all 11 entries embedded with exactly 2 motion drafts and 9
manual-reference entries. User should refresh, click **Open all 11 steps** above the
viewer, then use Next or the step selector. Fully animated coverage remains incomplete.

## Basic GUI blank/incomplete recovery

User reported blank browser / basic GUI not fully loading. Server logs showed repeated
entry/CSS/module requests but no model download. Changed the dynamic `/eket.html`
response to inline its CSS and small EKET entry module, and moved saved-result JSON
after the visible UI rather than into the document head. Controls can render before
large inert payloads and operate independently of external entry/CSS downloads.
Three.js dependencies still load separately; do not claim the user's remote 3D issue
is fully resolved until they confirm. Changed the initial page-8 image to its static PNG.

Added `/eket-steps?step=1` through `step=11`: a small, server-rendered manual navigator
with inline styling, original diagram links/images, step links and Previous/Next.
It needs no JavaScript, WebGL or API fetch. A prominent **Open all steps without 3D →**
link appears above the normal viewer. User can also replace `/eket.html` with
`/eket-steps` in their existing forwarded address. This is source-diagram navigation,
not a replacement claim of animated completion.

Assistant-authored diagram summaries moved to shared `app/eket_manual_steps.py`;
build script and lightweight view use the same definitions. Backend: 54 passed.
Chrome: 4 targeted tests passed including controls with external entry/CSS downloads
blocked, manual navigation with JavaScript disabled, normal 11-step navigation and
missing-entry fallback. Server restarted on loopback 8000 with latest code.

## V2 engine implementation and new motion drafts — October 22

User explicitly authorized improving the existing engine and asked to continue.
No new engine/video model/provider was installed or selected; DeepSeek Flash remains.
All work stays local/uncommitted. Preserve the original assets, keys and provider outputs.

Implemented schema_version 2 in the generic Pydantic format and JS player:
- Per-node keyframes, multi-stage motion, delayed/early timelines with boundary holds.
- Partial local endpoints persist across steps; already-visible nodes can move again
  only from matching endpoints. Forward/backward direct navigation is deterministic.
- Shared assembly keyframes rotate/translate all visible parts rigidly around a fixed
  source-parent pivot; all nodes must share a known parent. Whole-cabinet rotation is
  tested mechanically but not inferred for manual step 5.
- V1 remains supported; a dedicated v2 GENERATION schema exposes keyframes only and
  excludes conflicting legacy timing/transform fields.
- New explicit hand-authored fixture `/api/animation/fixture?version=2`; UI button is
  **Load v2 engine test (hand-authored)**. Do not confuse this with AI generation.

Measured shape features and source-bound assistant evidence:
`web/assets/eket/manual-action-evidence.json` supplies reviewed identity/approach
constraints for steps 3,4,6,7,9. They are separate INPUT evidence, not independent AI
success. A 21-sample translation-only AABB screen now flags excess overlap compared
with final seating. It rejects the wrong interior approach in step 4. Rotations and
small hardware are NOT checked; no collision-free or physically verified claim.

Provider results (all originals and separate reviews retained):
- `20261022T082339039793Z.json`: corrected step 3, node 4 thin back panel; two in-plane
  approach stages from negative parent Y. Partial, unverified candidate.
- `20261022T082559910325Z.json`: REJECTED step 4, bottom panel starts inside frame and
  crosses back panel. Do not propagate.
- `20261022T083042794680Z.json`: step 4 retry approaches outside negative parent Y;
  passes sampled screen, still partial/unverified.
- Provider audit `20261022T082125324960Z.json`: first v2 attempt exhausted 12K output
  budget entirely before final answer. Inspected before retry; new requests use explicit
  low reasoning effort and max_tokens 16000. No automatic paid retries.
- Provider audit `20261022T083721282532Z.json`: step 6 initially rejected because old
  schema disallowed delayed tracks. After implementing/testing boundary holds, the
  UNEDITED final answer was explicitly revalidated via
  `scripts/revalidate_animation_response.py`. Saved envelope
  `20261022T084434510332Z.json` discloses schema_revalidation; original rejection and
  new revalidation audit both exist. It moves eight source-labelled 139434/139435 nodes.
- Provider audit `20261022T084706551131Z.json`: REJECTED step 7 due conflicting legacy
  timing. Its output was not repaired or played. Generation schema was simplified.
- `20261022T084918168835Z.json`: clean-schema step 7, nodes 5 and 10 (141413) approach
  their upper-rear positions. Partial, unverified.
- `20261022T085221575394Z.json`: step 9, nodes 12 and 19 (141414) approach rear fittings.
  Explicitly does NOT animate turning or prescribe turns/torque. Partial, unverified.

`data/animation-runs/eket-guide-candidates.json` is the explicit candidate manifest.
Rebuild: `PYTHONPATH=. .venv/bin/python scripts/build_eket_guide.py --candidate-manifest data/animation-runs/eket-guide-candidates.json`.
The full navigator now has 7 motion drafts (1,2,3,4,6,7,9) and diagram-only steps
5,8,10,11. Explicit omissions include step-1 seating and step-9 turning. Do NOT claim
all steps are fully animated. Remaining accuracy work includes working orientation,
turning/engagement, drilling/removal, actual wall contacts/fixings and missing geometry.

Viewer and remote delivery:
- Webpack 5.105.4 was already installed locally. `scripts/bundle-viewer.cjs` / npm
  `build:viewer` builds the generic runtime into `web/generated/viewer.bundle.js` and
  `.gz` (~144 KiB gzip). Rebuild after viewer/motion-player edits. MIT notices retained.
- `/viewer.bundle.js` serves the precompressed asset with fixed Content-Length.
  EKET uses this single module instead of the separate Three.js import graph.
- Camera automatically frames moving parts from outside so rear hardware is visible.
  Orbit includes underside views; cosmetic floor is hidden for active animation plans.
- Page embeds only playback envelope fields, not duplicate raw outputs/prior-plan trees.
  Download uses the full preserved API result, retaining all raw final-answer envelopes
  and reviews. Basic shell remains inline; lightweight `/eket-steps` remains available.

Latest completed checks: 67 backend tests passed, 13 Node checks passed. Full Chrome
suite: 18 passed, 2 optional historical live tests skipped. It includes v2 mesh-pose /
rigid-distance tests, backward navigation, single-bundle loading, no-JS manual view,
normal playback and failure recovery. A final opt-in saved-v2-result playback test is
being run next, with no paid generation calls. Source root /home/gigi/git/assembly-guide.
Current local server was session 82589, PID 166550 on loopback 8000, before final
compact-page code restart. Check commands before stopping historical PIDs.

## Final v2 continuation result

The guide currently includes 7 unverified motion drafts (printed steps 1,2,3,4,6,7,9).
Manual-reference steps remain 5,8,10,11; step-1 seating and step-9 turning are explicitly
listed as omitted operations in the coverage metadata and active-step notice.

Final UI correction: playback controls moved directly below the canvas, outside the
long instruction panel; desktop instructions scroll separately. Camera framing uses
the full visible assembly while choosing the moving parts' outside face, preventing
cropped panels and hidden rear hardware. Floor hidden during draft playback.
Final bundle: 603091 bytes plain / 147156 bytes gzip. Rebuild with npm run build:viewer
when editing viewer.js or motion-player.js. Controls/basic shell remain inline.

Completed checks:
- 67 backend tests passed; 13 Node checks passed.
- Full browser run: 18 passed, 2 optional historical saved-result tests skipped.
- After final framing/layout changes: all-step navigation and fixture playback passed.
- Opt-in preserved v2 guide QA passed: actual step 3/4/6/7/9 before/after images differ,
  manual-only steps disable Play, no generation POSTs. Two accompanying renderer /
  bundled-loading checks also passed (3 total). This combined screenshot test uses a
  90-second budget because five software-WebGL captures exceed the normal 30 seconds;
  initial runs timed out, not provider calls. Reused screenshot buffers avoid duplicate
  captures. PNG artifacts in test-results/eket-v2-step-{3,4,6,7,9}.png.
- Source-panel screenshots inspected: whole body fits, rear fittings are visible.

The full preserved result is ~311 KB; the compact served page is ~97 KB before
compression. Full provenance remains downloadable from the saved-guide endpoint.
No new generation was performed by browser tests. All raw final answers, rejected
attempts, input evidence and separate review/revalidation sidecars remain local.
Next unresolved accuracy work: establish initial working orientation and meaningful
cabinet turn/seating for step 5; obtain source support for drilling/material removal,
wall-contact adjustment and actual wall fixing. Do not fake these with fixture motion
or call seven partial drafts a complete animated guide.

Final live server: session 62269, PID 171789, loopback 8000. HTTP-readback confirmed
7 motion drafts, manual steps [5,8,10,11], compact embedded playback data, controls
beside canvas, and a gzip bundle matching the generated source with fixed byte length.
User's latest requests were on the lightweight `/eket-steps` page; to see animations
use its **Back to 3D experiment** link to `/eket.html`, then **Open all 11 steps**.
Refreshing `/eket-steps` alone will still show diagrams rather than animations.

## User reports missing small parts — hardware audit/inspector

Compared original manual pages 7,8,19 with source labels/meshes. Page 7 has 16 loose
pieces across 6 numbers: 139434 x4,139435 x4,141413 x2,141414 x2,152651 x2,152650 x2.
All have matching named source nodes. Existing guide animates 8 at step 6,2 at step 7,
2 at step 9; 4 washer/cap nodes only appear in the diagram-only step 11. Do not imply
that all 16 are animated or that all panel-joint features are independently represented.
Early panel-join features have no separate named hardware nodes; independent engagement
remains unresolved. Tools, wall screws and optional supports remain unmodelled.

Added source-bound manual-hardware.json and generic app/hardware_inventory.py; the guide
builder includes/writes a hardware audit with source quantities, first visibility and
animated-step coverage. Original provider results and source geometry were not edited.
Rebuilt the guide with the existing manifest; motion coverage stays 7 drafts.

Added **Inspect the small parts** above the normal EKET viewer. Dropdown lists all 16
instances individually, plus panels for inspecting unlabelled joint features. Selection
isolates the original mesh at its source transform and zooms the camera; no geometry is
created/scaled/installed. Playback pauses/disables. **Return to assembly** restores the
same step/progress/rigid pose. Coverage table and original manual links distinguish late
unanimated washers/caps. Neutral inspection-only shading/backlight makes dark source
materials legible and is removed on exit; original assembly materials stay unchanged.
Viewer is rebuilt into its gzip bundle after changes.

Checks completed so far: 69 backend tests passed; 4 Chrome checks passed (all 16 selector
entries and 6 family rows, unanimated-cap labels, no generation calls, isolating a future
washer without advancing assembly, exact rigid-pose restoration, all-step navigation,
and single-bundle loading). A screenshot showed an overly dark cap; neutral inspection
shading was then added and its final visual check is pending below. No paid AI calls.

Final hardware-inspector verification: 69 backend tests passed; four initial targeted browser checks and two final inspection/restoration checks passed. Neutral inspection shading visually checked in test-results/eket-hardware-cap.png. Updated live app restarted on loopback port 8000, exec session 56575, PID 179753; served HTML verified to embed six hardware families / 16 matching source pieces and mark both washer/cap families unanimated. No paid generation calls or source-geometry changes. Panel-joint engagement and step-11 installation remain incomplete.

## User requested adding the missing small-part animations

Added separate source-bound `web/assets/eket/manual-motion-drafts.json`: assistant-authored step 11 moves both 152651 washers (14,20) before both 152650 covers (16,18). Positive parent-X approach comes through the opening; source transforms/orientations are the endpoints. Distances/timing are illustrative. Explicit pause represents OMITTED wall fastening, not a completed fixing. Cover turning/locking is also omitted. No geometry or provider result was changed, no paid calls made. Embedded panel connectors still have no separate movable nodes; independent engagement remains unresolved.

Builder validates authored asset hashes, preserves authored evidence in the downloadable envelope, and discloses authorship in the active step warnings and human_edits. Rebuilt guide has EIGHT motion drafts (1,2,3,4,6,7,9,11), three diagram-only steps (5,8,10). All 16 loose source hardware pieces now have motion tracks in their relevant steps; this does not establish full installation or physical correctness. Inspector coverage updates accordingly. Generic hardware camera now uses world-space approach direction to view internal fittings from the opening. Viewer bundle rebuilt: 604336 bytes plain / 147531 gzip.

Verification: 70 backend tests passed, both Node motion suites passed, all four Chrome hardware tests passed. Actual renderer checks delayed washer/cover staging, source endpoints, stationary prior assembly, backward/direct restoration and front-facing camera. UI check proves step 11 is playable and displays omitted-fixing/authorship warnings. Screenshot `test-results/eket-step-11-caps.png` inspected, covers visible at upper interior back corners. Initial renderer test failed because its saved-guide API URL lacked required product_id; corrected URL passes, no runtime bug or provider retry. Live port 8000 remains session 56575 / PID 179753; server reads guide/JS/bundle dynamically, so no restart required. HTTP readback confirmed new step11 tracks and eight-motion coverage. User should refresh 3D experiment, Open all 11 steps, choose step11 and Play.

## Small-part instructions during playback

User could not see hardware as instructions in the animation. Added a persistent small-part instruction card immediately below the canvas and above playback controls for steps6/7/9/11. It names the current source part/instance, displays manual-based action text, and marks individual replay buttons as current/completed based on actual track timing. Buttons seek to that track start and frame a close-up of the moving part with assembly still visible (not isolated inspection). Close-up/current and whole-cabinet controls are available; Play continues from the selected action. Step11 explicitly shows a wall-fastening-not-shown cue during the existing .48–.65 pause. Labels/instructions live in manual-hardware.json, cue metadata in manual-motion-drafts.json, and are embedded through the existing guide/audit path. No provider output or geometry changed; no paid calls.

Viewer focusPlanStep accepts optional node IDs to frame only those bounds while retaining all assembly visibility, original transforms, and approach-side camera. Rebuilt bundle 604404 plain /147563 gzip. All five hardware Chrome checks passed, including timing-sensitive instructions, click-to-replay, original omissions, pose restoration, and mobile overflow. Three targeted backend checks passed. JS syntax checks passed. Close-up screenshot test-results/eket-cover-assembly-closeup.png visually inspected. Existing live server session56575/PID179753 reads updated files dynamically; HTTP readback confirmed instruction markup, all six family action texts and the omitted-fastening cue. User should refresh /eket.html, Open all11steps, select a hardware step (6/7/9/11); instruction card is directly under the canvas.

## LACK loading recovery

User reports LACK does not load. Live diagnostics showed `stage:module`, failed dynamically imported module. LACK still imported separate viewer.js/Three module graph and fetched /api/demo before initialization. Switched web/app.js to fixed-length /viewer.bundle.js with a 20s module-load timeout and explicit Retry/manual fallback. Added dynamic / and /index.html routes: inline CSS and app entry, embed escaped DEMO JSON (no /api/demo bootstrap request). API fallback GETs now timeout at15s. Existing model-download/decode progress remains. No geometry or animation data changed. Backend targeted checks15 passed. Browser/live verification follows below.

LACK final verification:15 backend tests passed; browser viewer suite15 passed,2 optional saved-AI tests skipped. Covers actual LACK model/play/pause/scrub, all four legs, mobile, failure fallback, blocked legacy module/entry/metadata/CSS requests, single bundle download and retry. Live server restarted session65235/PID227446 on loopback8000. HTTP readback verified inline entry/CSS, embedded10-stage DEMO, bundled-viewer import. User should refresh existing forwarded page then select LACK; remote confirmation still needed.

## Visible LACK navigation and EKET continuous playback

Moved LACK Previous/Next from the bottom of the long sidebar into a toolbar above the model; added direct10-stage dropdown synchronized with all navigation. Added desktop/mobile browser regression coverage, but its invocation was rejected by the user, so it was NOT run. Do not retry that rejected test invocation without a new reason/request. app.js syntax passed. Files are served dynamically by existing server65235/PID227446; no restart needed.

User then asked how to play all EKET steps like LACK. Added Play all steps / Pause all steps directly beneath the EKET canvas. Continues from selected position, advances through motion tracks and holds manual-reference diagrams for10 seconds with explicit visible no-animation status. Stops at final step; replay after completion starts at step1. Selecting/stepping/scrubbing/inspecting a part or source model stops continuous playback. Single-step Play remains available. No new geometry/provider calls. JS syntax passed; browser checks were not run because previous browser invocation was declined. User should refresh EKET, Open all11steps, choose first step if needed, then Play all steps.

User still sees only Play. Live /eket.html confirmed plan-play-all already present, so browser version/page remains uncertain. Added prominent top-level Play all11steps beside Open all11steps; waits for viewer readiness, loads complete embedded guide from step1 and invokes continuous playback, then scrolls to canvas. loadDraft now returns success/failure so a failed load cannot start a previous plan. Syntax and live HTML readback passed; no browser tests run after earlier user rejection. Existing live server serves current files dynamically. Ask user hard refresh Ctrl+Shift+R and use top Play all11steps.

## Actual moving hardware shown in live close-up

User asked to use the inspector parts clearly in animation. Added automatic, labelled LIVE CLOSE-UP inset for hardware steps. Generic viewer renders the SAME scene/original animated node through a secondary camera/scissored viewport; no copied parts, pose reset, geometry scaling or extra model download. Main cabinet view stays visible. The detail follows the current moving part and its approach side; concurrently moving fittings cycle for visibility, while clicking an individual action selects that instance. Same instruction label and current marker below the canvas. Omitted wall-fastening cue and source-inspection mode hide inset. Live part close-ups checkbox toggles it. No change to geometry, provider outputs or motion timing; remaining physical operation gaps unchanged. Bundle rebuilt605507 plain/147855 gzip. JS syntax and Node motion suites passed. New Chrome test passed initially and screenshot visually checked: cabinet plus large moving cap with source number. Final instruction/control regression result follows. Live port8000 session65235/PID227446 serves new files dynamically; readback confirmed detail label, toggle and animation-state binding. No paid calls.

Final live-hardware checks: both targeted Chrome tests passed (instructions, replay, closeup toggle, one canvas/one model download, cue hiding and part labels). Screenshot in test-results/eket-live-hardware-detail.png. Existing geometry/animation semantics retained.

## Match hardware appearance to source-part inspector

User wants animation hardware to look like the source-parts list/inspector. In generic viewer, hardware meshes during plan playback now use the SAME neutral gray MeshStandardMaterial as source inspection (instead of emissive gold). Matching inspection backlight enabled while hardware is present. Applies to main view and live inset through same scene/mesh materials, including completed tracks. Original cloned materials are retained per mesh and restored outside plan playback. Panel materials, source geometry, poses and timing unchanged. LACK standalone demo has no plan and keeps original materials. Rebuilt bundle605739 plain/147931 gzip; syntax passed. Visual/browser check follows.

Matching-appearance verification: both targeted Chrome tests passed; screenshot visually inspected showing gray hardware with shaded edges, no gold disks. Source inspector restoration still exact. Existing live server dynamically serves rebuilt bundle. User then asked how parts became3D; explained original IKEA source meshes supplied geometry, PDF used for matching and instructions, no PDF-to-3D reconstruction performed.

## DALFRED added — October 22

User requested adding DALFRED (spelled DALFRAID). Downloaded original DALFRED60155602 model (12,800,892 bytes) and matching AA-399492-11 manual (8PDFpages) from pinned IKEA dataset commit2c3f453a7ed7e3a056939ecca6a888ccfaf5695c. All assets local under web/assets/dalfred with source hashes, original license and README. No AI/model-service calls, new packages, publication or commits.

Inspected original inventory and all assembly pages3–8. Manual has9 numbered steps, source33 mesh nodes (11structural and22numbered hardware). New scripts/build_dalfred_guide.py records source labels/hashes and generates guide/reference/PNGpages reproducibly. Run PYTHONPATH=. .venv/bin/python scripts/build_dalfred_guide.py. Four assistant-authored PARTIAL approach drafts at printedsteps3,5,6,8. Steps1,2,4,7,9 are diagram-only. Initial leg pairing/static positions tentative; source working orientation retained. Separate seat subassembly displayed at final source positions, not a simulated workbench arrangement. Threading, tightening, hammering, tools, exact sleeve engagement and seat-height adjustment remain omitted. No fabricated geometry or provider authorship claims. Source-node track endpoints are original transforms; no collision-free/verified physical claim.

New /dalfred.html dynamic route embeds escaped guideJSON, CSS and generic web/product.js; uses existing shared viewer.bundle.js. Product linked from LACK and EKET selector. UI has prominent top Previous/Next and9-step dropdown, Playstep/Playall9steps,10second diagram holds, manual image/fullPDF, assembled source view, all33source-part inspector and mobile layout. In DALFRED the main camera stays three-quarter upright; live detail inset disabled after screenshot showed rear camera occlusion. User can inspect individual original source meshes. Generic engine and EKET playback not changed.

Validation:17backend tests passed (DALFRED hashes/schema/node coverage/routes plus existing app checks). New actual-Chrome test passed before and after final camera change, verifying model load,9step navigation,33parts, motion vsdiagram playback, inspector return, automaticplay toggle, mobile nooverflow, no paidgeneration, no pageerrors. Final screenshot test-results/dalfred-footrest.png visually inspected: complete upright legframe/footrest fits beside original step3diagram.

Live server restarted session62511/PID236856, loopback8000. HTTP readback confirms /dalfred.html embeds33parts,9steps,4partialdrafts. User should refresh and click DALFRED barstool in product selector. Source model starts automatically with step1diagram, Playalldisplays motiondrafts and diagramholds; not completeanimation. No publication.

## DALFRED first-step mismatch corrected

User reported first step looks wrong. Cause: first step was manual-only but main view showed selected source nodes in final upright positions, inconsistent with manual joining work orientation. Acknowledged this was an incomplete placeholder, not real first-step animation. Generic product UI now shows an enlarged original numbered-step crop in the MAIN view for every manual-only step (1,2,4,7,9); hides misleading partial source assembly. Source assembled/part inspection remains an explicit separate option; motion steps restore canvas and correct resize. Does NOT claim first-step 3D animation implemented. Build script creates source-PDF crops step1..9 and records their URLs in guide.step_diagrams; first page split415 avoids including next step label. No altered source geometry or provider calls. Chrome navigation/diagram/source-toggle/motion/mobile test passed; two DALFRED backend checks passed. JS syntax passed. Existing live server62511/PID236856 serves updated HTML/JSON/JS dynamically, no restart necessary. User should refresh DALFRED to see correct first-step diagram.

## DALFRED first joining animation implemented

User rejected replacing animation with PDF. Implemented actual staged SOURCE MESH motion for steps1AND2. Step1: fixed sourceleg3, discs1/2 approach from+parentZ, opposingleg5 approaches, then matching105251 bolts11/18(-Z) and12/14(+Z) seat in two groups. Step2 legs4/6 approach from-X/+X followed by their matchingbolts13/17 and15/16. Endpoints zero; previousparts remain stationary/visible, v2continuity validates. Added presentation_rotations metadata for first2steps:[90,0,0] side-on workingview in sharedviewer optional snapshot.presentationRotationDeg; not a physical turntrack. Latersteps originalsourceview, orientationchange remains unanimated and disclosed. No newgeometry/providercalls, no torque/turncount or physicallyverified claim.

DALFRED has SIX partialmotion drafts1,2,3,5,6,8; diagram-only4,7,9. Updated intro/README/guidecoverage. Added optional neutralParts presentation in sharedviewer to use same neutralinspectionmaterial for DALFREDstructure duringplan playback, restoring originalblack outsideplan. This makes smalljointfeatures readable; sourcegeometry untouched. Current-part caption now follows activeSTRUCTURE aswellashardware so it names movingdisc/leg rather than futurebolt. FirststepPlayenabled andcanvasvisible; originaldiagram stilladjacent.

Verification:13backend checks passed(DALFREDsource/schema/staging+v2continuity), actualChromeDALFREDnavigation/playback test passed beforeandafterneutralshading. Firststep before/aftercanvas images differ; diagramhidden, sourceinspectionrestore/mobile pass. Final screenshot test-results/dalfred-step-1-animated.png visuallyinspected. Bundle605873plain/147983gzip. Existingserver62511/PID236856 servesupdateddata/entry/bundle dynamically. UserrefreshDALFRED,selectstep1,Playstep(orPlayall). Tightening,tools,threadengagementstillomitted.

## DALFRED steps7 and9 now animated

User reports steps7/9 showingPDF. Added real source-mesh axial spindle insertion at7 and grouped seat-to-frame approach at9. Reworked step5 staging: seat33/mount8/screws23..27 end+.35mY aboveframe; v2 preserves that through6. Spindle7 inserts from+.23to+.35Y at7; plug32 seatsfrom+.30to+.35Y at8. Step9movesall9seatassemblynodes[7,8,23..27,32,33]withIDENTICALkeyframes+.35Ytozero, preserving rigid offsets. This avoids teleporting previously assembled parts to an exploded start. Initial stagingdistance/directions illustrative, no hammer/tool/torque/turncountinvented. Threadedturning,locking,heightadjustmentremainomitted. Six→EIGHTpartialmotions(1,2,3,5,6,7,8,9);4stilldiagramonly(tightening).

Added generic viewer.frameAssembly to frame allcurrentlyvisiblebounds from fixedthree-quarterdirection, keeping raised seat/frame onscreen instead of cropped. DALFRED usesit forstepchanges/reset; existingEKET/LACKunchanged. Bundle606239plain/148056gzip. Guide/HTML/READMEcountsupdated.

14backendchecks passed including rigidseatgroup poseequality acrossfiveprogressvalues andv2continuity;2ChromeDALFREDtests passed including actual before/after3Dimagesfor7/9,PDFhidden,Playenabled,direct/backwardnavigation,allstepnavigation,mobile. Screenshots test-results/dalfred-step-{7,9}-animated.png inspected. Existingliveapp62511/PID236856 dynamicallyserveslatestfiles; no restartneeded. UserrefreshDALFRED andPlay7or9. No providercalls/newgeometry.

## DALFRED step4 visibility and continuous walkthrough

User reports blank/broken from4onward. Root UI still hidcanvas at manual-reference step4(tightening), replacingitwithPDFandcreatinghidden-to-visibletransitions. Added explicit guide.inspection_steps[4] nodeids19..22 (theinstalled100212ringbolts) and sourced tightening instructions. Product UI treats this as a PLAYABLE3Dcheckpointtour: assembledframe remains visible, liveinset/caption advances through4bolts; no fabricatedboltturn/torque. Sourceplanstep4 remains manual_reference withnoactualtracks, accuratelyseparatingcamera/checkpointwalkthroughfromphysicalmotion. Continuousplayback usesits8secondcheckpointdurationratherthan10secondPDFhold. All9steps nowstay3D;8partialmotions+1inspectiontour. Currentstep4mode/omissions clearlylabels3Dbolt-checkwalkthrough.

FiveDALFREDbackendchecks passed,JSsyntaxpassed. ExistingChrome source/navigationand7/9motionchecks pass. Added continuousUIregression from4through9 using2secondtestdurations; verifieseachselectedstep,visiblecanvaswithnonzerodimensions,PDFhidden,correctstopatfinal. Fullresult/screenshots follow. No sourcegeometry/providerchanges. Existinglive62511/PID236856 servesnewguide/JS/CSS dynamically.

Continuous regression initially failed under slow softwareWebGL: product.tick clamped each elapsedframe to.1seconds, stretching playback farbeyond itsduration on lowfpsmachines. Replaced clamp with actual nonnegativeelapsedtime; resetpreviousclock onvisibilitychange toavoid a hidden-tabjump. Continuous4→9test then passedin22sec(testdurations2sec), alltransitionskeepvisiblecanvasandstopcorrectly. Visualcheck found a legblockingboltcloseup; guideinspectionmetadata now supplies fourinboardparent-spaceviewdirections for19..22, sharedviewerdetailcamera usesoptional snapshot.detailDirection. Bundle606295plain/148069gzip; no geometrychanges. Final angle/regressionresult follows.

Final4→9continuousChromecheckpassedafterinboardanglefix; inspected screenshotshowshexsocketboltheadratherthanblockingleg. Fivebackendchecks passed, earlier2DALFREDChromechecks passed andfinalcontinuouscheckpassed. LiveHTTPreadbackconfirmedinspectionmetadataandwall-clocktimingfix. Existinglive62511/PID236856, dynamicfiles(no restart). UserrefreshCtrlShiftR→step4→Playall9steps. Step4is3Dbolt-checktour,NOTphysicaltighteningsimulation.

## DALFRED loading timeout and step9 PDFphase

User reported timeoutloading, confirmedDALFREDbutdidnotprovideexacterrorstage. Liveappresponded/diagnostics[] (productpreviouslydidnotreporterrors). Added bounded1MiBdownloadchunks via /models/dalfred.glb Rangeendpoint (exact206Content-Range+Content-Length, no streaminggzip). Eachchunk30stimeout,oneSAFEREADretryonlyfailedchunk,total5minbudget, strictbytecount/rangematching; no automaticpaidcalls. Genericviewer usesitonlywhendemo.chunk_bytes/model_bytes supplied (DALFRED12,800,892bytes); existingLACK/EKETpathsunchanged. Productbundleloadtimeout60s;productfailurediagnosticsnowreportstage/redactedmessageandmakeerrorvisible. Rebuiltbundle607267plain/148401gzip. SixDALFREDbackendchecks passed, newChromeinjects failureonsecondchunk→modelstillloads,firstchunkrequestedonce,failedchunktwice,14totalrequests,canvasvisible. Liveapp restarted session9031/PID244151 onloopback8000; live16byterangereadverifiedglTFsignature. Generatedunusedmodel.glb.gzexists(7,285,800bytes), currentchunkpathusesoriginaluncompressedbytes. Nogeometrychanges.

Whileloadingworkactive,useraskedwrongPDFphaseat9. Added sourcePDFcrop step-9-join.png(top0..415) andstep-9-adjust.png(bottom415..pageheight); guide.manual_phases9mapsprogress<.9tojoining,>=.9toheightadjustmentwithvisibleNOTANIMATEDlabel. Sidebarproduct-image/diagramlink/altandnewproduct-phasecaptionfollowphase; allotherstepsnowshowtheirnumberedstepcropsinsteadofwholepages. OriginalfullPDFlinkretained. NewChromephasetestpassed(start/mid/end/backwardscrub),croppreviewinspected. JSsyntaxpassed. No paidcalls. UserhardrefreshDALFREDtoreceivelatestloaderandphaseUI;remotetimeoutresolutionstillneedsuserconfirmation.

## ONE GENERIC PLAYER FOR ALL PRODUCTS — latest architecture

User explicitly requestedsameGUIandgenericimplementation. Allnormalroutes / (also/index.html),/eket.html,/dalfred.html now renderONE web/assembly.html template andidenticalinline web/assembly-player.js controller. No UI behaviorbranches onproductidentity. Commoncontrols topstepselector+Previous/Next; belowcanvasPlaystep,Playallsteps,Pause,Assembledmodel,Resetview,scrubber,sourcepartselector,livepartcloseupcheckbox. Counts/endconditions derivefromplan.steps.length. No separateOpenall11steps/auto-advancecheckbox/product-specificPlayallbuttons. Manual-onlysteps retainvisible3Dcontextwithclearno-motionnoticeandoriginaldiagramadjacent. Data-drivenPDFphases/checkpointtours/presentationposes retained. Same wall-clocktimingandchunk-downloadsupportforall3models.

New app/product_catalog.py normalizesdata. LACKoriginalDEMOconnections convertto validatedv2JSONwith8connector/legtracks, sameoriginalsourcepairings/illustrativerotations,10stages; sourceoverview atinventory/finalreview, joiningstagesupside-downviaoptionalpresentationrotation. EKETfullsavedguideand16hardwarekept, fullproviderprovenanceAPIlinkretained, missingmotionsdisclosed. DALFRED9steps/stagedseatgroup/step9diagramphases/step4checkpointsretained. Guide-deriveddetail_node_ids anddetail_directions drive genericliveinsets;sameoriginalmesh,notduplicateassets. Sourceoverviewrestoresoriginalmaterials;plansuseinspectiongray.

Backendshared /assembly/{registeredslug} and/models/{registeredslug}.glb supportfutureguidefileswithoutnewUI. PRODUCTSregistrycontainsmetadata+links;historicalLACK/EKETinputformatsusebackendadapters. Unknownslug404,noarbitraryfilepath. Originallargeassetresponsesstillgzip; boundedrangebinaryapplication/octet-streamexcludedfromgzipwithexact206Content-Length.

Oldexperimentsretainedunder/lack-lab.html(uploadandlegacyLACK)and/eket-lab.html(generation/fixtures/editing). NormalplayerlinksAdvancedunderAboutsourcepanel. Olderbrowserregressiontestsretargetedtolabroutes;newshared-player.spec.jsteststheactualdefaultpagesforall3objects. DALFREDtestsmigratedtosharedcontrols(explicitPause,Playallstepsuniformlabel). Old/dalfred-lab.htmlavailablebutnotinproductnav.

Validationsofar:82backendchecks passed;newcatalogregressionregistersafourthsyntheticguidewith3stepsandusesgenericroutewithoutfrontendchange(7catalogcheckspassed). Backendtestassertsall3pageshaveidenticalcontrollertextandcontrolstructure. Initial8Chromeshared/DALFREDchecks passed. Fullbrowser37testregressionrunning, throughshared3productsandlegacyloadingchecksallpassingsofar. Sourcehistory/geometry/provideroutputsunchanged,nopaidcalls/nodepackages/publication/commits. Sharedscreenshotsvisuallychecked.

LIVEsharedinterfacealreadyloaded:serverrestarted session57746/PID248960 onloopback8000. HTTP-readbackall3pagesverifiedidenticalassembly-entryscripts, sharedPause/Playallcontrols,stepcounts10/11/9. Userhardrefreshexistingproductpage;selectstep1andPlayallstepsworksidenticallyforall. Finalfullcheckresultfollowsbelow.

Sharedplayer finalverification:fullbrowserrun34passed,3optionalpreserved-live-resulttestsskipped(37total);alldefaultproductcontrols,completion/inspection/mobile/DALFREDphases/chunkretryandadvancedlabregressionspass. BothNodemotionsuitespassed. Finalbackend83passed (includingfourthregisteredguidefixture). Normalroutesliveverifiedidenticalcontrollerandcontrols;server57746/PID248960. README/enginearchitectureupdated. No remainingworkinthisGUI-unificationtask. Underlyingmanual/physicalmotionaccuracygapsremainexplicitlydisclosed;thischangeunifiesUI/dataflow,notverificationofallassemblies.

## Shared model download resilience follow-up

Userreportsstuckdownload. Livediagnosticsconfirmeddownloadchunk30secondtimeoutafterretry. Reducedallcatalogchunks1MiB→256KiB;modelURLnowcontainsoriginalsha256forcacheversioning. Sharedvieweraddsuniqueperrange/perattemptqueryURLtoavoidforwardingproxyreusingstalledURL;readsresponsebodystreamswithpartialbyteprogressratherthanwaitingwholechunk. SavesvalidatedchunksinCacheStorage(200syntheticresponsesbecause206cannotbecached)whenavailable;reloadretryskipcompletedchunksandresume. Browserprivacy/quotaerrorsfallbacktonetwork,notloadfailure. StilloneSAFEREADretryperfailedchunk,total5minbudget,noautomaticpaidcalls. GenericGLBgeometryunchanged. Finalbundle608220plain/148739gzip.

13targetedbackendchecks passed;twoChrometests passed:injectedfailureonDALFREDsecondchunk→onlythatchunkretried(50requestsfor49chunks+retry);injectedbothattemptfailuresonLACKsecondchunk→Retryloadingreloadusescachedfirstchunkonceandcompletes. JSsyntaxpassed. Useraskedwhatdownloads:explainedsource3Dmodelsfromlocalservertobrowser(LACK3.2MB/EKET15.1MB/DALFRED12.8MB),notnewsoftware. Thenaskedwhybrowserneedsit:browserrendersinteractive3Dlocally;server-renderalternativewouldstreamframeswithserverrenderingandinteractionlatency.

Liveupdatedserver:session94650/PID251746,loopback8000. HTTPreadbackconfirmed256KiBchunksandsha-versionedmodelURL. Userrefreshfornewloader;remotecompletionnotyetconfirmed.

## EKET range-transfer failure replaced with small HTTP200 data

Userstillstuckdownloading,confirmedEKET. Serverlogsconfirm206rangesreachserverbutresponsesstallintunnel. New /model-data/{product}/{offset} endpoint returnsnormal200JSONcontainingexact64KiBbase64originalbytes,offset,total;eachresponse<90KB,noRangeheaders/206needed. Newgeneric web/model-download.js usedbysharedviewerwhendemo.chunk_urlprovided:4parallelworkers,15srequestdeadline,onefailed-partretry,5minoverallbudget,strictmetadata/lengthvalidation,per-partprogress,persistentrawchunkCacheStorage. Cacheopen/match/putbounded1.5s,disabledifhangs(earliercacheawaitscouldhangoutsidefetchtimeouts). SHA-versionedcachekeysretained. Sharedcatalogchunk_bytes65536andchunk_urlmetadata;mainnormalplayerpassestothesharedrenderer. Legacyrangeendpoint/pathretained. Originalgeometrybyteidentical,nopaidcalls.

10catalog/backendtests passed;Chromefailed-chunkretryandreload-resumetests passed withnormaldataresponses. FreshEKETsharedplayerChromecheckpassed(wholemodeldownload/decode,play/pause/parts/finalstep/mobile);liveHTTP200EKETfirstchunkverifiedGLBsignature/size. Serverrestarted session11374/PID253423,loopback8000. This supersedespreviousserverids. Remotecompletionnotyetconfirmedbyuser.

## Close-up moved below main animation

Useraskedcloseupnotcoveranimation. Sharedtemplateadds labelled part-detail-region belowmainviewport. Sharedrendereroptional detail_layout=below reserves240pxdesktop/210pxmobile underunchanged510px/360pxmainanimation;onecanvas/twodisjointviewports,samemovingmeshes,noextramodelrequest/WebGLcontext. Maincameraaspectusesmainheightalone. Headerandborderidentifyseparatecloseuppanel. TurningoffLivepartcloseupscollapsespanel;sourceinspection/manualcuesalsohideit. Appliesallsamegenericnormalproductpages;legacyexperimentalinsetsunchanged.

Rebuiltbundle610379plain/149410gzip. Syntaxchecks passed. Chromecloseupdesktop/mobilelayouttestpassed(nonoverlap,mainheightpreserved,togglecollapse,nohorizontaloverflow). Screenshot test-results/eket-closeup-below.png visuallyinspected. Filesreadlivebycurrentserver11374/PID253423,nonewrestartneeded. Userrefreshpage;closeupnowbelowmodel,mainanimationunobscured.

## DALFRED PDF/animation synchronization

User reported the PDF and animation passing through different steps. Inspected original pages 4–7: page 6's old crop boundary (400 PDF points) cut through printed step 6, leaving the step 6 heading/start in the step 5 image. Changed page 6 split to 330 and page 5 split to 455 (before step 4 geometry); rebuilt original-image crops and guide with scripts/build_dalfred_guide.py. Step 9 now retains its joining crop throughout; the separate unanimated height-adjustment diagram is accessible in the full original manual rather than switching automatically during playback.

Shared controller now loads and decodes each matching diagram before revealing it, hides the prior diagram during transfer, and holds the animation clock until ready. URL guards prevent stale asynchronous loads replacing a newer selection. Bounded 20-second image timeout/failure stops playback and offers original-manual guidance; selecting the step again retries. Applies to all registered products with no product-specific controller branches. No model changes, provider calls or geometry claims.

Verification: six DALFRED Chrome tests passed, including all nine decoded matching diagrams, delayed step-2 image holding playback at zero with old image hidden, continuous playback, step-9 forward/back scrub, source inspection and chunk retry. Sixteen DALFRED/catalog backend checks passed outside sandbox (sandbox TestClient hung). Live server remains session11374/PID253423 port8000; frontend/guide files read dynamically, no restart required. Refresh browser for update. Physical orientations/hammering/thread engagement/torque remain unverified or absent as previously disclosed.

## DALFRED playback regression after diagram synchronization

User reported DALFRED stopped and did not show the whole animation. The previous synchronization implementation made the animation clock depend on successful PDF image loading/decoding and explicitly stopped playback on an image error/20-second timeout. This was an unnecessary dependency for the tunnel connection. Removed image readiness from playback and removed image-failure stop(). Missing/slow diagrams remain hidden (no stale previous-step image); their matching label/loading/error message and original-manual link remain available while the animation continues. Failed images are not retried every animation frame. Geometry, step timing and nine-step plan unchanged. Live server8000 health confirmed; shared controller is embedded dynamically, so refresh loads this correction without restart.

Verification for this regression: all seven DALFRED Chrome checks passed (1.8min), including delayed diagrams allowing progress and a failed step-2 PDF with continuous playback through all nine steps to finished. JS syntax passed. Live /dalfred.html readback confirmed corrected controller. No backend or bundle changes required.

## Floating close-up without control movement

User requested upper-left floating window because below-view detail changed controls' positions. Shared player now uses detail_layout=floating. Shared viewer renders the same live source meshes into the panel's actual inset bounds, keeping the main camera/full viewport unchanged. Fixed-height viewer (510desktop/360mobile) never expands for close-ups. Upper-left bordered/shadowed panel is 240x180 desktop (limited40% width), smaller on mobile. Existing checkbox hides it. Mode/article heading now has its own fixed row above canvas to avoid overlap. All registered normal products share layout; legacy experimental insets unaffected.

Bundle rebuilt610577bytes/149496gzip. Desktop/mobile Chrome layout check passed: upper-left placement, panel under halfwidth, controls' document positions and viewer height identical when toggled, no horizontaloverflow. Desktop screenshot test-results/eket-closeup-floating-1280.png visually checked (correct live detail in upper-left). Frontend files read dynamically by existing server, no restart needed. No new downloads/models/provider calls.
