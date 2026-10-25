# Assembly Studio

A local, GPU-free research prototype for source-backed furniture assembly guidance.

## Run

From `/home/gigi/git/assembly-guide`:

```bash
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open http://localhost:8000. For VS Code Remote, forward port 8000 in the Ports panel and open the forwarded address. The service has no authentication and is intended for local development. If `uv` is not on PATH, use `/home/gigi/.local/bin/uv` on this machine.

The LACK viewer works without a GPU server, API key, or external CDN. Three.js and the original model are served locally. The user's browser needs WebGL; software rendering may be slower. The three product pages share one player; source geometry and motion data remain product-specific.

## Shared player

LACK (`/`), EKET (`/eket.html`) and DALFRED (`/dalfred.html`) use **one template and controller**: `web/assembly.html` and `web/assembly-player.js`. Select a product, choose a step, then use **Play step**, **Play all steps**, **Pause**, Previous/Next, the scrubber, Assembled model, Reset view, and the source-part selector. Play all continues from the selected step and stops at the final step. Manual-reference operations retain the 3D context and disclose missing motion. Live part close-ups use the original moving meshes.

`app/product_catalog.py` adapts existing guides to the shared schema. LACK now uses the same JSON keyframe engine as EKET and DALFRED. New registered products can use `/assembly/{slug}` and `/models/{slug}.glb` without a new frontend. Step counts, diagrams/phases, checkpoint tours, source poses and presentation rotations are data. All models use bounded byte-range downloads with failed-chunk retry.

The older upload and generation experiments remain at `/lack-lab.html` and `/eket-lab.html`, linked under **About this guide and source parts → Advanced generation and experiments**. Their specialized controls are separate from the normal player.

## Source-backed LACK preview

- Official IKEA LACK model, article **30449908**, paired with manual **AA-207276-4**.
- Original geometry includes **1 tabletop, 4 legs, and 4 connectors (115980)**.
- Ten preview stages: identify parts, insert a connector and attach a leg at each of four corners, then review the assembled model.
- Play/pause, scrub, orbit, zoom, connection close-up, and reset camera.
- Choose **Assembled model** to view all nine parts at their original transforms.
- Source manual, page image, inventory, and attribution are available below the viewer.

The sequence was checked by inspecting the source model and manual. **It has not been physically tested.** Motion paths and rotations are illustrative; turn count, thread pitch, and torque are not established. **Play all steps** continues through the four connections to the upright review; **Play step** stops after one selected stage. **Pause** stops either mode. Previously attached parts remain visible. The final view does not demonstrate physically turning the table over or establish fastener tightness.

Read [the source review](docs/lack-review.md) and [machine-readable inventory](web/assets/lack/reference.json). Run `python scripts/inspect_lack.py` to regenerate the inventory from the GLB. Source URLs are pinned to a commit and original files have SHA-256 checksums.

### Attribution and permitted use

Original geometry © Inter IKEA Systems B.V., from the [IKEA 3D Assembly Dataset](https://github.com/IKEA/IKEA3DAssemblyDataset), licensed **CC BY-NC-SA 4.0**. Original license and README are retained under `web/assets/lack`. Animation and reference metadata are adaptations under the same license. The source manual retains its original copyright notice; the page image is a rendering of that manual. This is a **noncommercial research prototype**; do not assume commercial permission. The dataset is historical and regional/product revision differences must be checked.

Three.js is MIT licensed; its license is included in `web/vendor/three/LICENSE`. The application does not claim IKEA endorsement.

## Configure DeepSeek

Copy `.env.example` to `.env`, set `DEEPSEEK_API_KEY` privately in your editor, and restart the server. The key stays on the server and is not returned to the browser. Do not commit or paste the key into chat. The endpoint is fixed to `https://api.deepseek.com/chat/completions`; the default image-capable model is `deepseek-flash`. Model access and API balance must be checked on your account.

The **Bring your manual** tab at `/lack-lab.html` sends rendered PDF page images to DeepSeek only when you click Analyze. This consumes provider API balance. It accepts valid unlocked PDFs up to 12 MB and 12 pages. No pages are silently omitted. Uploads and drafts are held in memory by this application; provider-side retention follows the provider's policies. Download JSON to retain a draft.

Pydantic checks references, positive quantities, consecutive step numbers, and source page bounds. It does not establish assembly correctness. Draft results never change or publish the 3D animation automatically.

To evaluate the model, upload `web/assets/lack/manual.pdf` and compare its output with the reference inventory and source review. The manual's text layer contains almost no assembly information; diagrams must be interpreted. The older PDF-analysis route is separate from the motion-generation experiment; real motion-generation evaluation calls have now been made and preserved as described below.

## Checks and frontend dependencies

The vendored browser runtime is committed as source assets, so Node is not needed just to run the app. To refresh it or run browser checks:

```bash
npm ci
npm run vendor
npx playwright install chromium
uv run pytest
node --test tests/motion.test.mjs
npm run test:browser
```

On the current Ubuntu 26.04 host, Playwright 1.56.1 needs its Ubuntu 24.04 fallback build:

```bash
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright install chromium
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npm run test:browser
```

On minimal Linux hosts, Chromium also needs its system shared libraries (Playwright’s `install-deps chromium` command lists/installs them with administrator access). For this session, missing libraries were extracted without system installation to `/tmp/assembly-browser-libs/extracted`; the checks used `LD_LIBRARY_PATH=/tmp/assembly-browser-libs/extracted/usr/lib/x86_64-linux-gnu` in addition to the platform override. This temporary directory is not needed to run the app in your own browser.

Browser tests start a temporary backend on port 8011 and check actual model loading, playback, scrubbing, source inventory, completion persistence, and phone layout. Screenshots are written to ignored `test-results/`. Python tests use a mocked DeepSeek provider and do not incur API charges.

## Next milestone

Review the generated partial EKET motion against the source diagram, improve visual part mapping and seating-action coverage, and arrange physical assembly testing before accepting it as guidance. Automatic geometry reconstruction, broad catalog matching, accounts, a database, a task queue, and LangGraph orchestration remain outside this prototype.

## Viewer troubleshooting

The loading message identifies rendering startup, model download, and material decoding. Downloads allow up to two minutes with visible received-byte progress; decoding has a 30-second limit. The server gzip-compresses large responses for remote tunnels without changing the source files. If antialiased WebGL startup fails, the viewer retries a lower-power configuration. If 3D remains unavailable, it shows the manual and keeps the manual-analysis screen usable. Refresh after frontend updates; development HTML, JavaScript, and CSS use no-store caching.

The private development server keeps the last ten viewer failure reports in memory at `/api/viewer-diagnostics` (stage and a URL-redacted browser error message). It does not store documents or API keys in those reports. Reports clear when the server restarts.

## Second dataset product: EKET

Use **EKET cabinet** in the product links, or open `/eket.html` on the same forwarded address. This loads the original cabinet (article 70332124, 35 × 25 × 35 cm), with rotate, zoom, reset, source component labels, and the original 20-page manual AA-1914763-5.

The source file has 21 component nodes: 5 panels and 16 hardware components. These are model-node counts, not an independently verified physical inventory. An explicitly hand-authored fixture and an AI-generated partial motion candidate are available through the experiment; no complete EKET tutorial has been verified, and all geometry still comes from the source model. The GLB/PDF are pinned to the same upstream dataset commit as LACK, with hashes and URLs in `web/assets/eket/reference.json`. `python scripts/inspect_eket.py` regenerates that metadata. The same noncommercial dataset license applies.

Note: the current DeepSeek upload experiment accepts at most 12 pages, so the full 20-page EKET manual cannot be submitted through that experiment yet. Model inspection and reading the manual are available without an API key.

## Reusable motion engine experiment

The advanced EKET page at `/eket-lab.html` includes **One manual step → motion data → interactive playback**. Read [the engine specification and limits](docs/animation-engine.md) before interpreting this as automatic reconstruction.

- Generate one step with DeepSeek: uses a selected manual page plus source geometry metadata; requires your API key. The provider may abstain. Drafts are labeled unreviewed and need an explicit Preview action.
- Load hand-authored player fixture: an offline, explicitly developer-authored JSON movement that tests the generic player. This is never presented as AI-generated.
- Edit/import motion JSON: validated against the selected source files, relabeled as imported, with edits disclosed.
- Playback supports pause, scrub, step selection, and independent 360° camera orbit. It consumes validated data and existing parts, not product-specific motion code.

The selected-page generation route reads only the needed PDF pages, so it can work with EKET's 20-page manual without uploading the entire PDF through the older 12-page experiment. No new 3D geometry is generated. Structure/source validation does not establish physical correctness.

Additional checks:

```bash
node --test tests/generic-motion.test.mjs tests/motion.test.mjs
uv run pytest tests/test_animation_api.py
```

The first live AI test exposed incorrect part pairing; a second exposed incorrect assembly context despite geometric proximity. Both outputs and separate rejection reviews were preserved locally. Read the engine notes for the distinction between source/schema validation, geometric sanity checks, and actual manual correctness. **Load saved AI test** makes no new API call. Provider final-answer audits are kept under ignored `data/provider-responses`; credentials and reasoning traces are not saved there.

Small JSON responses are deliberately uncompressed and uncached for the remote-tunnel preview. The EKET app reads metadata with a 15-second limit and retries one failed GET with a fresh URL. Empty/truncated replies become specific errors; generation POSTs are never automatically retried because they can incur charges. The advanced model path supports compression. The shared player uses bounded byte ranges with exact lengths and retries only failed chunks.

### Current EKET v2 preview

Open EKET, choose a step, then use the same **Play step / Play all steps / Pause**
controls as every other product. Steps 1–4, 6, 7, 9 and 11 have unverified motion
drafts. Steps 5, 8 and 10 retain static 3D context beside the original diagrams.
Step 9 turning and original step-1 seating remain incomplete.

The v2 engine supports staged keyframes, delayed tracks, retained intermediate poses
and rigid whole-assembly transforms. The explicitly hand-authored **Load v2 engine
test** fixture checks these mechanics; it is not generated assembly guidance.

After editing `web/viewer.js`, `web/motion-player.js` or their dependencies, rebuild
with `npm run build:viewer` (requires webpack 5; 5.105.4 was already installed here).
The generated bundle and precompressed asset are kept under `web/generated/`, allowing
runtime operation without webpack or CDN access. The EKET viewer uses one fixed-length
bundle response to reduce module-loading stalls through forwarded connections.

DALFRED bar stool is available at `/dalfred.html`, linked from the product selector. It uses the original pinned IKEA 60155602 geometry and manual AA-399492-11, with nine manual steps and eight explicitly authored partial motion drafts. See `web/assets/dalfred/reference.json` for original sources/hashes. Rebuild its local guide with `PYTHONPATH=. .venv/bin/python scripts/build_dalfred_guide.py`. Tightening, hammering, working orientation and seat-height adjustment remain incomplete; this is not verified assembly guidance.
