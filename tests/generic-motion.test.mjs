import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeMotion } from '../web/motion-player.js';

function plan(node = 487) {
  return { steps: [{ visible_node_ids: [node, 3], tracks: [{ node_index: node, from_offset_m: [.3, -.2, .1], to_offset_m: [0, 0, 0], from_rotation_deg: [90, 0, 180], to_rotation_deg: [0, 0, 0], start_fraction: .25, end_fraction: .75 }] }] };
}
test('arbitrary node IDs and three-axis motions work without furniture-specific code', () => {
  for (const id of [4, 487, 1290]) {
    const result = nodeMotion(plan(id), 0, id, .5);
    assert.deepEqual(result.offset, [.15, -.1, .05]);
    assert.deepEqual(result.rotationDeg, [45, 0, 90]);
    assert.equal(result.visible, true);
  }
});
test('track timing, static context, and hidden future parts are respected', () => {
  assert.deepEqual(nodeMotion(plan(), 0, 487, 0).offset, [.3, -.2, .1]);
  assert.deepEqual(nodeMotion(plan(), 0, 487, 1).offset, [0, 0, 0]);
  assert.deepEqual(nodeMotion(plan(), 0, 3, .5).offset, [0, 0, 0]);
  assert.equal(nodeMotion(plan(), 0, 999, .5).visible, false);
});
test('different steps supply their own visibility and motion', () => {
  const data = plan();
  data.steps.push({ visible_node_ids: [99], tracks: [{ ...data.steps[0].tracks[0], node_index: 99 }] });
  assert.equal(nodeMotion(data, 1, 3, 0).visible, false);
  assert.equal(nodeMotion(data, 1, 99, .5).visible, true);
});

test('manual-reference steps keep assembled parts stationary without invented movement', () => {
  const data = { steps: [{ kind: 'manual_reference', visible_node_ids: [1, 3, 4], tracks: [] }] };
  for (const progress of [0, .5, 1]) {
    assert.deepEqual(nodeMotion(data, 0, 4, progress), { visible: true, highlight: false, offset: [0, 0, 0], rotationDeg: [0, 0, 0] });
    assert.equal(nodeMotion(data, 0, 99, progress).visible, false);
  }
});

test('v2 keyframes support slide then seat and retain partial poses on direct navigation', () => {
  const frame = (fraction, offset_m) => ({ fraction, offset_m, rotation_deg: [0,0,0] });
  const data = { schema_version: 2, steps: [
    { visible_node_ids: [9], tracks: [{ node_index: 9, interpolation: 'linear', keyframes: [frame(0,[.1,0,0]),frame(.5,[.02,0,0]),frame(1,[.02,-.01,0])] }] },
    { kind: 'manual_reference', visible_node_ids: [9], tracks: [] },
    { visible_node_ids: [9], tracks: [{ node_index: 9, interpolation: 'linear', keyframes: [frame(0,[.02,-.01,0]),frame(1,[0,0,0])] }] },
  ] };
  assert.deepEqual(nodeMotion(data,0,9,.5).offset,[.02,0,0]);
  assert.deepEqual(nodeMotion(data,0,9,.75).offset,[.02,-.005,0]);
  assert.deepEqual(nodeMotion(data,1,9,0).offset,[.02,-.01,0]);
  assert.deepEqual(nodeMotion(data,2,9,0).offset,[.02,-.01,0]);
  assert.deepEqual(nodeMotion(data,2,9,1).offset,[0,0,0]);
});

test('assembly rotation is deterministic when jumping forward and backward', async () => {
  const { assemblyMotion } = await import('../web/motion-player.js');
  const data = { schema_version: 2, steps: [
    { assembly_keyframes: [{fraction:0,offset_m:[0,0,0],rotation_deg:[0,0,0]},{fraction:1,offset_m:[0,0,0],rotation_deg:[0,0,90]}] },
    { assembly_keyframes: [] },
  ] };
  assert.deepEqual(assemblyMotion(data,1,0).rotationDeg,[0,0,90]);
  assert.deepEqual(assemblyMotion(data,0,0).rotationDeg,[0,0,0]);
  assert.deepEqual(assemblyMotion(data,0,.5).rotationDeg,[0,0,45]);
});

test('delayed and early-finishing keyframes hold their boundary poses', () => {
  const data = {schema_version:2,steps:[{visible_node_ids:[3],tracks:[{node_index:3,keyframes:[
    {fraction:.2,offset_m:[.1,0,0],rotation_deg:[0,0,0]},
    {fraction:.8,offset_m:[0,0,0],rotation_deg:[0,0,0]},
  ]}]}]};
  assert.deepEqual(nodeMotion(data,0,3,0).offset,[.1,0,0]);
  assert.deepEqual(nodeMotion(data,0,3,.1).offset,[.1,0,0]);
  assert.deepEqual(nodeMotion(data,0,3,.9).offset,[0,0,0]);
  assert.deepEqual(nodeMotion(data,0,3,1).offset,[0,0,0]);
});
