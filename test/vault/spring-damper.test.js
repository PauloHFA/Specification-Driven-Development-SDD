/**
 * @file test/vault/spring-damper.test.js
 * @description Comprehensive automated tests for Hooke's law spring-damper physics simulation.
 * Covers Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases).
 * Zero external dependencies, pure node:test.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SpringSimulation } from '../../src/vault/physics/spring-damper.js';
import { Vector3 } from '../../src/vault/math/vector3.js';
import { assertVector3Close } from './test-helpers.js';

describe('F3: Elastic Physics & Spring-Damper — Tier 1 Feature Coverage', () => {
  test('T1.1: Coulomb electrostatic repulsion pushes close unlinked nodes apart @spec:AC-002', () => {
    // Two nodes placed very close at x=-2 and x=+2 (initial distance = 4)
    const graph = {
      nodes: [
        { id: 'A', position: { x: -2, y: 0, z: 0 } },
        { id: 'B', position: { x: 2, y: 0, z: 0 } }
      ],
      edges: [] // No connecting edge
    };

    const sim = new SpringSimulation(graph, { kRepulsion: 5000, kCenter: 0 });
    const pos0 = sim.getNodePositions();
    const d0 = pos0.get('A').distanceTo(pos0.get('B'));
    assert.equal(d0, 4);

    // Run 10 steps
    for (let i = 0; i < 10; i++) {
      sim.step(0.02);
    }

    const pos1 = sim.getNodePositions();
    const d1 = pos1.get('A').distanceTo(pos1.get('B'));
    assert.ok(
      d1 > d0,
      `Repulsion must increase distance between close nodes: d1 (${d1.toFixed(2)}) > d0 (${d0})`
    );
  });

  test('T1.2: Hooke\'s law spring attraction pulls over-stretched connected nodes together', () => {
    // Two connected nodes placed far apart (initial distance = 300, restLength = 50)
    const graph = {
      nodes: [
        { id: 'A', position: { x: -150, y: 0, z: 0 } },
        { id: 'B', position: { x: 150, y: 0, z: 0 } }
      ],
      edges: [
        { id: 'e_AB', source: 'A', target: 'B', restLength: 50, stiffness: 0.5 }
      ]
    };

    const sim = new SpringSimulation(graph, { kRepulsion: 100, kCenter: 0 });
    const pos0 = sim.getNodePositions();
    const d0 = pos0.get('A').distanceTo(pos0.get('B'));
    assert.equal(d0, 300);

    for (let i = 0; i < 15; i++) {
      sim.step(0.02);
    }

    const pos1 = sim.getNodePositions();
    const d1 = pos1.get('A').distanceTo(pos1.get('B'));
    assert.ok(
      d1 < d0,
      `Spring attraction must pull overstretched nodes together: d1 (${d1.toFixed(2)}) < d0 (${d0})`
    );
  });

  test('T1.3: Symplectic Euler integration updates positions from velocities accurately', () => {
    // Node with initial velocity moving along X
    const graph = {
      nodes: [
        { id: 'A', position: { x: 0, y: 0, z: 0 }, velocity: { x: 50, y: 0, z: 0 } }
      ],
      edges: []
    };

    const sim = new SpringSimulation(graph, { kCenter: 0, velocityDamping: 0 });
    sim.step(0.02);

    const pos = sim.getNodePosition('A');
    // Position should have advanced along +X
    assert.ok(pos.x > 0, `Node must advance along velocity direction: pos.x = ${pos.x}`);
    assert.equal(pos.y, 0);
    assert.equal(pos.z, 0);
  });

  test('T1.4: Viscous velocity damping gradually bleeds kinetic energy', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: 0, y: 0, z: 0 }, velocity: { x: 100, y: 0, z: 0 } }
      ],
      edges: []
    };

    const sim = new SpringSimulation(graph, { kCenter: 0, velocityDamping: 0.3 });
    // Run 1 step to record initial kinetic energy from velocity
    sim.step(0.02);
    const e0 = sim.getSimulationEnergy().kinetic;

    for (let i = 0; i < 30; i++) {
      sim.step(0.02);
    }

    const e1 = sim.getSimulationEnergy().kinetic;
    assert.ok(
      e1 < e0,
      `Damping must reduce kinetic energy: e1 (${e1.toFixed(4)}) < e0 (${e0.toFixed(4)})`
    );
  });

  test('T1.5: Simulation energy settling and automatic rest/sleep transition', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: -30, y: 0, z: 0 } },
        { id: 'B', position: { x: 30, y: 0, z: 0 } }
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', restLength: 60 }
      ]
    };

    const sim = new SpringSimulation(graph, {
      sleepEnergyThreshold: 0.05,
      sleepTicksRequired: 10,
      velocityDamping: 0.2
    });

    assert.equal(sim.isResting(), false);

    // Run until simulation settles into sleep
    let settled = false;
    for (let step = 0; step < 500; step++) {
      const res = sim.step(0.02);
      if (res.isResting) {
        settled = true;
        break;
      }
    }

    assert.equal(settled, true, 'Simulation must settle into rest/sleep state');
    assert.equal(sim.isResting(), true);
  });
});

describe('F3: Elastic Physics & Spring-Damper — Tier 2 Boundary & Corner Cases', () => {
  test('T2.1: Coincident nodes (identical positions [0,0,0]) separate without NaN', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: 0, y: 0, z: 0 } },
        { id: 'B', position: { x: 0, y: 0, z: 0 } }
      ],
      edges: []
    };

    const sim = new SpringSimulation(graph);
    // Anti-singularity perturbation must separate coincident nodes without producing NaN or Infinity
    sim.step(0.02);

    const posA = sim.getNodePosition('A');
    const posB = sim.getNodePosition('B');

    assert.ok(Number.isFinite(posA.x) && !Number.isNaN(posA.x), 'Node A pos.x must be finite');
    assert.ok(Number.isFinite(posB.x) && !Number.isNaN(posB.x), 'Node B pos.x must be finite');

    const dist = posA.distanceTo(posB);
    assert.ok(dist > 0, `Coincident nodes must be perturbed apart: dist = ${dist}`);
  });

  test('T2.2: Single isolated node experiences centering gravity without crashing', () => {
    const graph = {
      nodes: [{ id: 'Solitary', position: { x: 100, y: 50, z: -80 } }],
      edges: []
    };

    const sim = new SpringSimulation(graph, { kCenter: 0.05 });
    const initialDist = sim.getNodePosition('Solitary').length();

    for (let i = 0; i < 20; i++) {
      sim.step(0.02);
    }

    const currentDist = sim.getNodePosition('Solitary').length();
    assert.ok(
      currentDist < initialDist,
      `Centering gravity must pull solitary node toward origin: ${currentDist.toFixed(2)} < ${initialDist.toFixed(2)}`
    );
  });

  test('T2.3: Zero stiffness (kSpring=0) disables spring attraction', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: -50, y: 0, z: 0 } },
        { id: 'B', position: { x: 50, y: 0, z: 0 } }
      ],
      edges: [
        // Connected edge with 0 stiffness
        { id: 'e_AB', source: 'A', target: 'B', stiffness: 0 }
      ]
    };

    const sim = new SpringSimulation(graph, { kCenter: 0, kRepulsion: 2000 });
    const d0 = sim.getNodePosition('A').distanceTo(sim.getNodePosition('B'));

    for (let i = 0; i < 10; i++) {
      sim.step(0.02);
    }

    const d1 = sim.getNodePosition('A').distanceTo(sim.getNodePosition('B'));
    // With 0 spring stiffness, repulsion dominates and distance increases
    assert.ok(d1 > d0, `With zero stiffness, repulsion must push nodes apart: ${d1} > ${d0}`);
  });

  test('T2.4: Extreme dt (large step 100s or negative) clamped safely', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: -10, y: 0, z: 0 } },
        { id: 'B', position: { x: 10, y: 0, z: 0 } }
      ],
      edges: []
    };

    const sim = new SpringSimulation(graph);

    // Negative dt handled safely
    const negRes = sim.step(-5.0);
    assert.equal(negRes.stepsRun, 0);

    // Extreme huge dt (e.g. 100s) clamped to max fixedDt without explosion
    const hugeRes = sim.step(100.0);
    const posA = sim.getNodePosition('A');
    assert.ok(Number.isFinite(posA.x) && !Number.isNaN(posA.x), 'Position must remain finite after huge dt');
    assert.ok(Math.abs(posA.x) < 1000, `Position should not explode to infinity: pos.x = ${posA.x}`);
  });

  test('T2.5: Pinned node locks position while unpinned node moves', () => {
    const graph = {
      nodes: [
        { id: 'PinnedNode', position: { x: 0, y: 0, z: 0 }, pinned: true },
        { id: 'FreeNode', position: { x: 10, y: 0, z: 0 }, pinned: false }
      ],
      edges: []
    };

    const sim = new SpringSimulation(graph, { kRepulsion: 5000 });
    const initialPinnedPos = sim.getNodePosition('PinnedNode').clone();

    for (let i = 0; i < 20; i++) {
      sim.step(0.02);
    }

    const finalPinnedPos = sim.getNodePosition('PinnedNode');
    const finalFreePos = sim.getNodePosition('FreeNode');

    // Pinned node position must remain strictly invariant
    assertVector3Close(finalPinnedPos, initialPinnedPos, 1e-6, 'Pinned node position must not change');
    // Free node must have moved
    assert.ok(finalFreePos.x > 10, `Free node must have moved away: ${finalFreePos.x} > 10`);

    // Dynamically unpin node
    sim.pinNode('PinnedNode', false);
    sim.step(0.02);
    // Now both nodes are free to move
  });

  test('T2.6: Empty graph simulation does not throw and settles immediately', () => {
    const sim = new SpringSimulation({}, {});
    const res = sim.step(0.02);
    assert.equal(res.isResting, true);
    assert.equal(res.kinetic, 0);
    assert.equal(sim.isResting(), true);
    assert.equal(sim.getNodePositions().size, 0);
  });
});
