// All offsets are relative to the original GLB node transforms, in meters.
// Parent-space -Y becomes up after the complete scene is turned upside down.
export function partPose(category, stage, progress, assembled = false) {
  const t = Math.max(0, Math.min(1, progress));
  const smooth = t * t * (3 - 2 * t);
  if (assembled || category === 'top') return { offsetY: 0, angleY: 0 };
  if (category === 'connector') {
    const fraction = stage === 'inventory' ? 0 : stage === 'connector' ? smooth : 1;
    return { offsetY: -.12 * (1 - fraction), angleY: -Math.PI * 4 * (1 - fraction) };
  }
  if (category === 'leg') {
    const fraction = stage === 'leg' ? smooth : 0;
    return { offsetY: -.18 * (1 - fraction), angleY: -Math.PI * 4 * (1 - fraction) };
  }
  throw new Error(`Unknown component category: ${category}`);
}

export function assemblyPartState(category, corner, activeCorner, stage, progress, assembled = false) {
  if (assembled || stage === 'review' || category === 'top') {
    return { visible: true, highlight: false, offsetY: 0, angleY: 0 };
  }
  if (stage === 'inventory') {
    return { visible: true, highlight: false, ...partPose(category, stage, 0) };
  }
  if (corner < activeCorner) {
    return { visible: true, highlight: false, offsetY: 0, angleY: 0 };
  }
  if (corner > activeCorner) return { visible: false, highlight: false, offsetY: 0, angleY: 0 };
  return {
    visible: category === 'connector' || stage === 'leg',
    highlight: category === stage,
    ...partPose(category, stage, progress),
  };
}
