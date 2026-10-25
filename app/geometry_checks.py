"""Conservative furniture-scale AABB sanity checks, not a physics validator."""
import math


def gap(a, b):
    return math.sqrt(sum(max(a['min'][axis] - b['max'][axis], b['min'][axis] - a['max'][axis], 0) ** 2 for axis in range(3)))


def large_nodes(inventory):
    return {node['node_index']: node for node in inventory['nodes']
            if 'bounds_in_parent_m' in node and max(hi - lo for lo, hi in zip(node['bounds_in_parent_m']['min'], node['bounds_in_parent_m']['max'])) >= .1}


def contact_candidates(inventory):
    nodes = list(large_nodes(inventory).values())
    return [{'nodes': [a['node_index'], b['node_index']], 'bounds_gap_m': round(gap(a['bounds_in_parent_m'], b['bounds_in_parent_m']), 6)}
            for i, a in enumerate(nodes) for b in nodes[i + 1:]
            if a.get('parent_node') == b.get('parent_node') and gap(a['bounds_in_parent_m'], b['bounds_in_parent_m']) <= .02]


def geometry_review(plan, inventory):
    nodes = large_nodes(inventory)
    issues = []
    checks = []
    endpoint_poses = {}
    for step_index, step in enumerate(plan.steps):
        for track in step.tracks:
            endpoint_poses[track.node_index] = ((*track.keyframes[-1].offset_m, *track.keyframes[-1].rotation_deg) if track.keyframes else (*track.to_offset_m, *track.to_rotation_deg))
        non_source_endpoint = any(any(abs(value) > 1e-7 for value in endpoint_poses.get(index, ())) for index in step.visible_node_ids)
        for track in step.tracks:
            node = nodes.get(track.node_index)
            if node is None:
                continue
            if non_source_endpoint:
                checks.append({'step': step_index + 1, 'moving_node': track.node_index, 'status': 'not_checked', 'reason': 'A visible component ends away from its source transform; source AABB docking checks do not apply.'})
                continue
            others = [nodes[index] for index in step.visible_node_ids if index != track.node_index and index in nodes and nodes[index].get('parent_node') == node.get('parent_node')]
            if not others:
                issues.append(f'Step {step_index + 1}, moving node {track.node_index}: no other visible large component is available to check an attachment.')
                continue
            nearest = min(others, key=lambda other: gap(node['bounds_in_parent_m'], other['bounds_in_parent_m']))
            distance = gap(node['bounds_in_parent_m'], nearest['bounds_in_parent_m'])
            checks.append({'step': step_index + 1, 'moving_node': track.node_index, 'nearest_visible_large_node': nearest['node_index'], 'final_bounds_gap_m': round(distance, 6)})
            if distance > .02:
                issues.append(f'Step {step_index + 1}, moving node {track.node_index}: its nearest visible large component (node {nearest["node_index"]}) remains {distance:.3f} m away at the end. No apparent connection.')
    path_review = path_overlap_review(plan, inventory)
    return {'issues': issues + path_review['issues'], 'checks': checks, 'path_review': path_review,
            'scope': 'AABB proximity only, for components at least 0.1 m wide sharing a parent frame, using a 0.02 m threshold. This does not establish mating features, collision-free paths, or correctness.'}


def measured_features(inventory):
    """Source-derived dimensions; classifications describe shape, not assembly role."""
    features = []
    for node in inventory['nodes']:
        bounds = node.get('bounds_in_parent_m')
        if not bounds:
            continue
        spans = [hi-lo for lo, hi in zip(bounds['min'], bounds['max'])]
        order = sorted(range(3), key=lambda axis: spans[axis])
        features.append({'node_index': node['node_index'], 'source_label': node.get('name', ''),
            'parent_axis_spans_m': [round(value, 6) for value in spans],
            'smallest_span_m': round(spans[order[0]], 6),
            'smallest_span_axis': 'XYZ'[order[0]],
            'panel_like_shape': spans[order[1]] >= .1 and spans[order[0]] < .04})
    return features


def _track_pose(track, fraction):
    if track.keyframes:
        frames = track.keyframes
        right = next((frame for frame in frames if frame.fraction >= fraction), frames[-1])
        index = frames.index(right)
        left = frames[max(0, index-1)]
        width = right.fraction-left.fraction
        t = max(0, min(1, (fraction-left.fraction)/width)) if width else 0
        if track.interpolation == 'smooth':
            t = t*t*(3-2*t)
        return (tuple(a+(b-a)*t for a,b in zip(left.offset_m,right.offset_m)),
                tuple(a+(b-a)*t for a,b in zip(left.rotation_deg,right.rotation_deg)))
    t = max(0,min(1,(fraction-track.start_fraction)/(track.end_fraction-track.start_fraction)))
    if track.interpolation == 'smooth':
        t = t*t*(3-2*t)
    return (tuple(a+(b-a)*t for a,b in zip(track.from_offset_m,track.to_offset_m)),
            tuple(a+(b-a)*t for a,b in zip(track.from_rotation_deg,track.to_rotation_deg)))


def path_overlap_review(plan, inventory):
    """Flag excess sampled AABB overlap; this cannot establish collision freedom."""
    nodes = large_nodes(inventory)
    retained = {}
    issues, checks = [], []
    zero = ((0,0,0),(0,0,0))
    def overlap(a, ap, b, bp):
        spans = [max(0, min(a['max'][axis]+ap[axis], b['max'][axis]+bp[axis]) - max(a['min'][axis]+ap[axis], b['min'][axis]+bp[axis])) for axis in range(3)]
        return math.prod(spans)
    for step_index, step in enumerate(plan.steps):
        tracks = {track.node_index:track for track in step.tracks}
        def pose(node, t):
            return _track_pose(tracks[node], t) if node in tracks else retained.get(node, zero)
        for moving in tracks:
            if moving not in nodes:
                continue
            for other in step.visible_node_ids:
                if other == moving or other not in nodes or nodes[moving].get('parent_node') != nodes[other].get('parent_node'):
                    continue
                samples = [(pose(moving,i/20),pose(other,i/20)) for i in range(21)]
                if any(any(abs(v)>1e-7 for v in (*a[1],*b[1])) for a,b in samples):
                    checks.append({'step':step_index+1,'moving_node':moving,'other_node':other,'path_status':'not_checked_rotation'})
                    continue
                a, b = nodes[moving]['bounds_in_parent_m'], nodes[other]['bounds_in_parent_m']
                final = overlap(a,samples[-1][0][0],b,samples[-1][1][0])
                maximum = max(overlap(a,ap[0],b,bp[0]) for ap,bp in samples)
                flagged = maximum > max(final*1.2, final+1e-6)
                checks.append({'step':step_index+1,'moving_node':moving,'other_node':other,'path_status':'excess_overlap_flag' if flagged else 'no_excess_sampled_overlap',
                               'max_overlap_m3':round(maximum,9),'final_overlap_m3':round(final,9)})
                if flagged:
                    issues.append(f'Step {step_index+1}, moving node {moving}: sampled bounds overlap with node {other} exceeds final seating overlap. Review the approach path; AABB approximation is not proof of collision.')
        retained.update({index:_track_pose(track,1) for index,track in tracks.items()})
    return {'issues':issues,'checks':checks,'scope':'21 translation-only AABB samples compared with final overlap; rotations are skipped. May flag false positives and miss collisions or groove/tool interference.'}
