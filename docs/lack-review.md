# LACK source review

## Scope and provenance

Research prototype using the official IKEA 3D Assembly Dataset, pinned to commit
`2c3f453a7ed7e3a056939ecca6a888ccfaf5695c`. Article `30449908`, LACK white 55 × 55 cm.
The matching supplied manual is `AA-207276-4`, one PDF page. These files are historical,
not a confirmation of current product availability or interchangeability.

Original GLB, PDF, license, and upstream README are retained unmodified under
`web/assets/lack`. `reference.json` records original URLs and SHA-256 checksums.
Copyright belongs to Inter IKEA Systems B.V. The dataset is CC BY-NC-SA 4.0:
this work is a noncommercial research prototype. Commercial reuse needs a separately
established rights basis. Animation and reference metadata are adaptations offered
under the same license; they are not manufacturer-authored instructions.

## Observations from actual files

The GLB contains one root and nine component nodes:

| Component | Nodes | Quantity | Evidence |
| --- | --- | --- | --- |
| Tabletop | 1 | 1 | `table top_00167769` |
| Legs | 5, 6, 7, 8 | 4 | `table leg_00167768_*`, shared mesh 4 |
| Double-ended connectors | 2, 3, 4, 9 | 4 | `115980_*`; manual also labels 115980, 4× |

`00167769` and `00167768` are model labels, not established spare-part ordering numbers.
Mesh-local bounds are included in the reference file; mesh axes differ from world
axes because each node has a quaternion rotation. Geometry units are meters.

Visual inspection of the rendered manual page shows:

1. Hardware 115980, quantity four.
2. A hand turning the connector into a tabletop corner.
3. A leg being turned onto the exposed connector.
4. A crossed-out hard-floor work setup and a protected-floor alternative.

The PDF text layer contains only copyright and the document identifier. Text-only
extraction cannot recover this assembly sequence or hardware number. This is an
appropriate visual-model evaluation case.

## Implemented animation

The tabletop is turned upside down as a complete scene transform, preserving original
component relationships. Node 9 and leg node 7 share x/z attachment coordinates within
floating-point precision. Those nodes demonstrate the first corner. The same illustrated sequence is repeated at all four corners, pairing nodes (9,7), (2,6), (4,5), and (3,8) by attachment axes. Corner numbering and order are presentation choices. All final transforms are
the original GLB transforms. Starting offsets, timing, and full-turn rotations are
illustrative, authored for this experiment; they are not measurements of screw travel.
The connector remains in place while the leg approaches. Completed corners remain visible; future corners are hidden until their stage. Playback can continue automatically through all eight connector/leg actions.

The viewer can also show the entire supplied model upright in its original assembled state.
That is an inspection mode, not a claim that this preview teaches the full assembly.

## What remains unverified

- Physical fit, handling, and tool clearance.
- Thread pitch, turn count, or tightening torque.
- Compatibility with other article numbers, countries, or manual revisions.
- Whether digital geometry reproduces all manufacturing details.
- Whether people can follow the tutorial successfully without assistance.

No DeepSeek call was needed for this source review. Its eventual extraction should be
compared to this inventory and sequence before generated instructions are accepted.

## Reproduce

Run `python scripts/inspect_lack.py` to regenerate the model inventory and checksums.
Run `uv run pytest` for source-integrity, quantity, connector-pairing, and API checks.
