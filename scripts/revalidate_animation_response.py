"""Revalidate a preserved final answer after an explicit schema update; never edit it."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from app.animation_api import RUNS_DIRECTORY, context, envelope, validate_source, validate_continuation, validate_action_evidence
from app.animation_schema import GenerationDecision, AnimationPlan
from app.geometry_checks import geometry_review


def revalidate(path, explanation):
    audit = json.loads(path.read_text())
    raw = json.loads(audit['response_text'])
    choice = raw['choices'][0]
    if choice.get('finish_reason') != 'stop':
        raise ValueError('Only complete preserved final answers can be revalidated')
    output = choice['message']['content']
    decision = GenerationDecision.model_validate_json(output)
    if not decision.can_propose:
        raise ValueError('The preserved provider result abstained')
    request = audit['request']
    source = context(request['product_id'])
    validate_source(decision.plan, source, [request['source_page']])
    if len(decision.plan.steps) != 1 or decision.plan.schema_version != request['motion_version']:
        raise ValueError('Wrong step count or schema version')
    if request.get('previous_plan'):
        validate_continuation(AnimationPlan.model_validate(request['previous_plan']), decision.plan)
    evidence = (source.get('action_evidence') or {}).get('actions', {}).get(request['printed_step'])
    validate_action_evidence(decision.plan, evidence)
    review = geometry_review(decision.plan, source['inventory'])
    result = envelope(decision.plan, 'deepseek', model=audit['model'], reason=decision.reason,
        provider_output=output, generation_request=request, input_evidence=evidence, geometry_review=review,
        schema_revalidation={'source_provider_audit':path.name,'explanation':explanation,'provider_final_answer_edited':False})
    if review['issues']:
        result['review_status'] = 'geometry_flagged'
    target = RUNS_DIRECTORY / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json')
    target.write_text(json.dumps(result,indent=2)+'\n')
    path.with_suffix('.revalidation.json').write_text(json.dumps({'status':'revalidated_after_schema_extension','saved_run_id':target.stem,'explanation':explanation,'provider_final_answer_edited':False},indent=2)+'\n')
    print(target)
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('audit',type=Path)
    parser.add_argument('--explanation',required=True)
    args = parser.parse_args()
    revalidate(args.audit,args.explanation)
