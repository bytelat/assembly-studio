import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partPose, assemblyPartState } from '../web/assembly-motion.js';

test('full model inspection restores all original node transforms', () => {
  for (const category of ['top', 'leg', 'connector']) {
    assert.deepEqual(partPose(category, 'inventory', .5, true), { offsetY: 0, angleY: 0 });
  }
});

test('connector remains inserted throughout leg animation', () => {
  for (const t of [0, .25, .5, 1]) {
    assert.deepEqual(partPose('connector', 'leg', t), { offsetY: -0, angleY: -0 });
  }
});

test('connector and leg animation end at exact source transforms', () => {
  for (const category of ['connector', 'leg']) {
    assert.equal(Math.abs(partPose(category, category, 1).offsetY), 0);
    assert.equal(Math.abs(partPose(category, category, 1).angleY), 0);
    assert.ok(partPose(category, category, 0).offsetY < 0);
  }
});

test('tabletop never moves and animation clamps progress', () => {
  assert.deepEqual(partPose('top', 'leg', .5), { offsetY: 0, angleY: 0 });
  assert.deepEqual(partPose('leg', 'leg', 2), partPose('leg', 'leg', 1));
  assert.deepEqual(partPose('leg', 'leg', -1), partPose('leg', 'leg', 0));
});

test('completed legs remain fixed while the next corner animates', () => {
  for (let active = 1; active < 4; active++) {
    for (let prior = 0; prior < active; prior++) {
      assert.deepEqual(assemblyPartState('leg', prior, active, 'connector', .5), { visible: true, highlight: false, offsetY: 0, angleY: 0 });
    }
    assert.equal(assemblyPartState('leg', active, active, 'connector', .5).visible, false);
    assert.equal(assemblyPartState('leg', active, active, 'leg', .5).highlight, true);
    if (active < 3) assert.equal(assemblyPartState('leg', active + 1, active, 'leg', .5).visible, false);
  }
});

test('final review shows all four connectors and legs at the source transforms', () => {
  for (let corner = 0; corner < 4; corner++) {
    for (const category of ['leg', 'connector']) {
      assert.deepEqual(assemblyPartState(category, corner, null, 'review', 0), { visible: true, highlight: false, offsetY: 0, angleY: 0 });
    }
  }
});
