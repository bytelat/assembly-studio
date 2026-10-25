# Live generation evaluation — 2026-10-21

## What actually ran

Real DeepSeek Flash calls used EKET source geometry metadata and PDF page 8, plus
warning and inventory context pages. No new mesh geometry was generated. The API
model setting was corrected from an unsupported name to `deepseek-flash`; the key
was never printed or committed.

The first complete draft paired opposite side panels that remain approximately
0.316 m apart in the source geometry. It was rejected, preserved unchanged, and given
a separate review. A generic bounding-box contact check was then added; this is an
engine improvement, not a manually edited motion.

The second draft passed that geometric check but assumed a preassembled frame absent
from the selected first-step diagram. It was also rejected with a separate review.
A subsequent response failed format/source validation and was not played. Provider
final-answer auditing was added so future invalid or truncated responses can be examined
as well. Output budget was increased to leave room for structured JSON.

The latest saved candidate uses only two large panels, slides one into a source-model
corner contact, and passes format/source/contact checks. Its raw provider answer and
normalized plan are preserved, with no human instruction or track edits. A separate
review records it as **a partial candidate for visual review**, not verified guidance.

## Remaining limitations in the actual result

- Exact top/bottom and mirrored-side identity remains ambiguous in the diagram.
- Approach distance and direction are inferred for presentation.
- The downward seating press is described but not animated.
- Assembly working orientation is not reconstructed.
- Physical fit, connection engagement, handling, and collision-free travel have not
  been verified.

The successful outcome is a real manual/inventory-to-motion-JSON-to-player pipeline,
with partial output and visible uncertainties. It is not evidence of a reliable
general-purpose manual-to-3D tutorial system.

## Inspect it

On `/eket.html`, choose **Load saved AI test (no new API call)**, inspect its source
page, provenance, and uncertainties, then choose **Preview this unreviewed plan** and
**Play**. Camera orbit and scrubbing remain independent of the motion. The fixture
button is separate and explicitly hand-authored.

Evaluation envelopes are under ignored `data/animation-runs/`; reviews are separate
`.review.json` files. The saved-result route adds current checks and the sidecar review
without overwriting the original envelope. Later provider final-answer audits are in
ignored `data/provider-responses/`. Credentials and reasoning traces are not included.

The optional `ASSEMBLY_LIVE_QA=1` browser check played the actual saved candidate,
compared its start/end rendering, and confirmed that loading it made no generation
request. Mock-provider tests remain separate from this live-output playback check.
