"""Compose manual navigation with preserved AI drafts and disclosed authored motions."""
import argparse
import copy
import json
from pathlib import Path

import pymupdf

from app.animation_api import context, envelope, validate_continuation, validate_source
from app.animation_schema import AnimationPlan
from app.geometry_checks import geometry_review
from app.hardware_inventory import hardware_audit

ROOT = Path(__file__).resolve().parent.parent
RUNS = ROOT / 'data/animation-runs'
from app.eket_manual_steps import MANUAL_STEPS


def build(extra_runs=()):
    source = context('eket-70332124')
    authored = json.loads((source['directory'] / 'manual-motion-drafts.json').read_text())
    for asset, key in [('model.glb', 'model_sha256'), ('manual.pdf', 'manual_sha256')]:
        if authored[key] != source['reference']['files'][asset]['sha256']:
            raise ValueError('Authored motion belongs to different source assets')
    authored_steps = {step['printed_step']: step for step in authored['steps']}
    originals = [RUNS / '20261021T143206162427Z.json', RUNS / '20261022T071448684552Z.json', *extra_runs]
    candidates = {}
    source_results = []
    for path in originals:
        result = json.loads(path.read_text())
        review_path = path.with_suffix('.review.json')
        if review_path.exists():
            result['separate_review'] = json.loads(review_path.read_text())
        result['saved_run_id'] = path.stem
        source_results.append(result)
        if result.get('plan'):
            parsed = AnimationPlan.model_validate(result['plan'])
            validate_source(parsed, source)
            current_review = geometry_review(parsed, source['inventory'])
            result['current_geometry_review'] = current_review
            number = int(result.get('generation_request', {}).get('printed_step', len(source_results)))
            if current_review['issues'] or result.get('geometry_review', {}).get('issues') or result.get('separate_review', {}).get('decision') == 'not_accepted':
                continue
            candidates[number] = result['plan']['steps'][0]
    steps = []
    visible = set()
    for number, page, title, instruction, added in MANUAL_STEPS:
        visible.update(added)
        if number in candidates or number in authored_steps:
            step = copy.deepcopy(authored_steps.get(number, candidates.get(number)))
            # Annotations are disclosed below; original provider envelopes stay unchanged.
            step['printed_step'] = number
            step['kind'] = 'motion'
            visible.update(step['visible_node_ids'])
            if set(step['visible_node_ids']) != visible:
                raise ValueError(f'Candidate {number} does not preserve the expected visible assembly context')
        else:
            step = dict(kind='manual_reference', printed_step=number, title=title,
                instruction=instruction, source_pages=[page], duration_seconds=4,
                visible_node_ids=sorted(visible), tracks=[], warnings=[],
                uncertainties=['Assistant-authored diagram summary; no AI animation has been accepted for this action. The static 3D view uses tentative source-node mappings and does not demonstrate this operation.'])
            if number == 11:
                step['warnings'] = ['The manual warns about tip-over. Follow the original wall-fixing warning and all applicable source instructions.']
        steps.append(step)
    identity = {key: value for key, value in source_results[0]['plan'].items() if key != 'steps'}
    identity['schema_version'] = max(result.get('plan', {}).get('schema_version', 1) for result in source_results if result.get('plan'))
    plan = AnimationPlan.model_validate({**identity, 'steps': steps})
    validate_source(plan, source)
    validate_continuation(plan)
    hardware = hardware_audit(source['reference'], json.loads((source['directory'] / 'manual-hardware.json').read_text()), plan)
    result = envelope(plan, 'composed_manual_guide', source_results=source_results, hardware_audit=hardware,
        manual_document=source['reference']['manual_document'],
        coverage={'printed_steps': 11, 'animated_drafts': sum(step.kind == 'motion' for step in plan.steps),
                  'manual_reference_steps': [step.printed_step for step in plan.steps if step.kind == 'manual_reference'],
                  'additional_context_pages': [2, 7, 12, 13, 18], 'complete_animation': False,
                  'unanimated_operations': {'1':'The separate seating press is not animated.', '5':'Cabinet turning and seating remain diagram-only until working orientation is resolved.',
                    '8':'Drilling and removed material are not animated.', '9':'The printed turning action is not animated; this draft shows axial approach only.',
                    '10':'Wall-contact adjustment is not animated.', '11':'Wall attachment, missing wall screws and cover turning/locking are not animated.'},
                  'authored_motion_steps': sorted(authored_steps)},
        authored_motion=authored, playback_cues=authored.get('playback_cues', {}),
        human_edits=['Assistant-authored manual summaries and tentative static visibility for unanimated steps. Step 11 washer/cover approach motions are assistant-authored from original page 19 and source geometry, with illustrative distances and timing; wall fastening and cover locking are omitted. Existing provider motions copied with printed-step and kind annotations; original envelopes and separate reviews retained. This composition is not a verified assembly guide.'])
    result['separate_review'] = {'decision': 'partial_candidate_for_visual_review', 'reasons': [
        'All 11 numbered steps are navigable, but manual-only entries are not animations.',
        'Existing panel identity, working orientation, seating and path uncertainties remain unresolved.',
        'Support and mounting branches require the original pages 12, 13 and 18 and separate accessory instructions. No wall, optional legs or missing fasteners were invented.']}
    RUNS.mkdir(parents=True, exist_ok=True)
    output = RUNS / 'eket-complete-manual-guide.json'
    output.write_text(json.dumps(result, indent=2) + '\n')
    (source['directory'] / 'hardware-audit.json').write_text(json.dumps(hardware, indent=2)+'\n')
    # Original pages are served as static files to avoid repeated API rendering requests.
    with pymupdf.open(source['directory'] / 'manual.pdf') as doc:
        for page in range(7, 20):
            doc[page - 1].get_pixmap(matrix=pymupdf.Matrix(1.3, 1.3), alpha=False).save(source['directory'] / f'manual-page-{page}.png')
    print(f'Prepared 11 manual steps; {result["coverage"]["animated_drafts"]} motion drafts. Saved {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate', action='append', type=Path, default=[])
    parser.add_argument('--candidate-manifest', type=Path)
    args = parser.parse_args()
    candidates = args.candidate
    if args.candidate_manifest:
        candidates += [RUNS / name for name in json.loads(args.candidate_manifest.read_text())]
    build(candidates)
