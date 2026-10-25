from app.animation_api import context, saved_guide, validate_continuation, validate_source
from app.animation_schema import AnimationPlan
from app.geometry_checks import _track_pose


def test_step_11_moves_all_four_supplied_parts_in_manual_order():
    guide = saved_guide('eket-70332124')
    plan = AnimationPlan.model_validate(guide['plan'])
    source = context('eket-70332124')
    validate_source(plan, source)
    validate_continuation(plan)
    step = plan.steps[10]
    assert step.kind == 'motion' and step.source_pages == [19]
    tracks = {track.node_index: track for track in step.tracks}
    assert set(tracks) == {14, 16, 18, 20}
    # Washers have docked before either cover moves; covers stay out of their way.
    for index in (14, 20):
        assert _track_pose(tracks[index], .5)[0] == (0, 0, 0)
    for index in (16, 18):
        assert _track_pose(tracks[index], .5)[0][0] > .1
    for track in tracks.values():
        assert _track_pose(track, 0)[0][0] > 0
        assert _track_pose(track, 1) == ((0, 0, 0), (0, 0, 0))
    assert not set(tracks) & set(plan.steps[9].visible_node_ids)
    assert guide['authored_motion']['origin'] == 'assistant_authored_manual_motion'
    assert guide['coverage']['authored_motion_steps'] == [11]
    assert not guide['coverage']['complete_animation']
    families = guide['hardware_audit']['families']
    assert all(item['animated_in_steps'] == [11] for item in families if item['manual_step'] == 11)
    assert 'wall screws' in guide['coverage']['unanimated_operations']['11']
    assert 'not AI-generated' in ' '.join(step.warnings)
