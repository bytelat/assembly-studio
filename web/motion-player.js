// Product-independent evaluator. Geometry and motion data are supplied separately.
export function nodeMotion(plan, stepIndex, nodeIndex, progress) {
  const step = plan.steps[stepIndex];
  if (!step) throw new Error('Animation step is outside this plan');
  const track = step.tracks.find(item => item.node_index === nodeIndex);
  const visible = step.visible_node_ids.includes(nodeIndex);
  if (!track) {
    if (plan.schema_version === 2) {
      for (let index = stepIndex - 1; index >= 0; index--) {
        const previous = plan.steps[index].tracks.find(item => item.node_index === nodeIndex);
        if (previous) {
          const pose = previous.keyframes?.length ? sampleKeyframes(previous.keyframes, 1, previous.interpolation) : { offset: previous.to_offset_m, rotationDeg: previous.to_rotation_deg };
          return { visible, highlight: false, ...pose };
        }
      }
    }
    return { visible, highlight: false, offset: [0, 0, 0], rotationDeg: [0, 0, 0] };
  }
  if (track.keyframes?.length) return { visible, highlight: progress < 1, ...sampleKeyframes(track.keyframes, progress, track.interpolation) };
  const fraction = Math.max(0, Math.min(1, (progress - track.start_fraction) / (track.end_fraction - track.start_fraction)));
  const smooth = track.interpolation === 'linear' ? fraction : fraction * fraction * (3 - 2 * fraction);
  const interpolate = (start, end) => start.map((value, axis) => value + (end[axis] - value) * smooth);
  return {
    visible, highlight: fraction < 1,
    offset: interpolate(track.from_offset_m, track.to_offset_m),
    rotationDeg: interpolate(track.from_rotation_deg, track.to_rotation_deg),
  };
}

function sampleKeyframes(frames, progress, interpolation = 'smooth') {
  const t = Math.max(0, Math.min(1, progress));
  let index = frames.findIndex(frame => frame.fraction >= t);
  if (index < 0) index = frames.length - 1;
  const right = frames[index], left = frames[Math.max(0, index - 1)];
  if (right.fraction === t) return { offset: [...right.offset_m], rotationDeg: [...right.rotation_deg] };
  const span = right.fraction - left.fraction;
  let alpha = span ? Math.max(0, Math.min(1, (t - left.fraction) / span)) : 0;
  if (interpolation === 'smooth') alpha = alpha * alpha * (3 - 2 * alpha);
  const mix = (a, b) => a.map((v, axis) => v + (b[axis] - v) * alpha);
  return { offset: mix(left.offset_m, right.offset_m), rotationDeg: mix(left.rotation_deg, right.rotation_deg) };
}

export function assemblyMotion(plan, stepIndex, progress) {
  if (!plan.steps[stepIndex]) throw new Error('Animation step is outside this plan');
  for (let index = stepIndex; index >= 0; index--) {
    const frames = plan.steps[index].assembly_keyframes;
    if (frames?.length) return sampleKeyframes(frames, index === stepIndex ? progress : 1);
  }
  return { offset: [0, 0, 0], rotationDeg: [0, 0, 0] };
}
