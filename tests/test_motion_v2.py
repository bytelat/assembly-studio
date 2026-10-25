import copy

import pytest

from app.animation_api import context, fixture, validate_continuation, validate_source
from app.animation_schema import AnimationPlan
from app.geometry_checks import geometry_review


def frame(fraction, offset=(0, 0, 0), rotation=(0, 0, 0)):
    return dict(fraction=fraction, offset_m=offset, rotation_deg=rotation)


def example():
    data = fixture()['plan']
    data['schema_version'] = 2
    data['steps'] = data['steps'][:1]
    step = data['steps'][0]
    node = step['tracks'][0]['node_index']
    step['tracks'] = [{'node_index': node, 'keyframes': [frame(0, (.1, 0, 0)), frame(.5, (.02, 0, 0)), frame(1, (.02, -.01, 0))]}]
    return data, node


def test_v2_retains_partial_endpoint_then_continues_without_jump():
    data, node = example()
    second = copy.deepcopy(data['steps'][0])
    second['tracks'] = [{'node_index': node, 'keyframes': [frame(0, (.02, -.01, 0)), frame(1)]}]
    data['steps'].append(second)
    plan = AnimationPlan.model_validate(data)
    validate_source(plan, context(plan.product_id))
    validate_continuation(plan)
    assert geometry_review(plan, context(plan.product_id)['inventory'])['checks'][0]['status'] == 'not_checked'
    data['steps'][1]['tracks'][0]['keyframes'][0]['offset_m'] = (.01,0,0)
    with pytest.raises(ValueError, match='jumps'):
        AnimationPlan.model_validate(data)


@pytest.mark.parametrize('mutation', [
    lambda data: data.update(schema_version=1),
    lambda data: data['steps'][0]['tracks'][0]['keyframes'][0].update(fraction=.75),
    lambda data: data['steps'][0]['tracks'][0]['keyframes'][1].update(fraction=0),
    lambda data: data['steps'][0]['tracks'][0]['keyframes'][1].update(offset_m=(float('nan'),0,0)),
    lambda data: data['steps'][0]['tracks'][0].update(from_offset_m=(.1,0,0)),
])
def test_v2_rejects_wrong_version_invalid_times_and_mixed_formats(mutation):
    data, _ = example()
    mutation(data)
    with pytest.raises(ValueError):
        AnimationPlan.model_validate(data)


def test_group_rotation_persists_and_cannot_teleport_between_steps():
    data, _ = example()
    step = data['steps'][0]
    step['tracks'] = []
    step['assembly_keyframes'] = [frame(0), frame(1, rotation=(0,0,90))]
    second = copy.deepcopy(step)
    second['assembly_keyframes'] = [frame(0, rotation=(0,0,90)), frame(1)]
    data['steps'].append(second)
    AnimationPlan.model_validate(data)
    second['assembly_keyframes'][0]['rotation_deg'] = (0,0,45)
    with pytest.raises(ValueError, match='Assembly transform jumps'):
        AnimationPlan.model_validate(data)


def test_thin_panel_evidence_is_source_bound_and_measured():
    source = context('eket-70332124')
    features = {entry['node_index']: entry for entry in source['inventory']['measured_shape_features']}
    assert features[4]['smallest_span_m'] == pytest.approx(.0025)
    assert features[2]['smallest_span_m'] > .017
    assert source['action_evidence']['actions']['3']['required_moving_node_ids'] == [4]


def test_interior_panel_approach_is_flagged_and_outside_approach_is_clear():
    from app.animation_api import validate_action_evidence
    data, _ = example()
    step = data['steps'][0]
    step['visible_node_ids'] = [1,2,3,4,21]
    step['tracks'] = [{'node_index':2, 'keyframes':[frame(0,(0,.12,0)),frame(1)]}]
    plan = AnimationPlan.model_validate(data)
    source = context(plan.product_id)
    assert geometry_review(plan,source['inventory'])['issues']
    with pytest.raises(ValueError,match='exterior'):
        validate_action_evidence(plan,source['action_evidence']['actions']['4'])
    step['tracks'][0]['keyframes'][0]['offset_m'] = (0,-.12,0)
    plan = AnimationPlan.model_validate(data)
    assert not geometry_review(plan,source['inventory'])['issues']
    validate_action_evidence(plan,source['action_evidence']['actions']['4'])


def test_delayed_keyframes_have_unambiguous_redundant_timing():
    data, _ = example()
    track = data['steps'][0]['tracks'][0]
    track['keyframes'][0]['fraction'] = .2
    track['start_fraction'] = .2
    AnimationPlan.model_validate(data)
    track['start_fraction'] = .1
    with pytest.raises(ValueError,match='timing'):
        AnimationPlan.model_validate(data)
