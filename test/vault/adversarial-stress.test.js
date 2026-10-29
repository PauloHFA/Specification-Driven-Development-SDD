/**
 * @file test/vault/adversarial-stress.test.js
 * @description Adversarial stress tests and empirical boundary harnesses for Milestone 1.
 * Evaluates:
 * 1. Physics Symplectic Euler energy conservation & numeric drift runaway (1,000+ steps)
 * 2. Rest / sleep state transitions (Ek < 10^-3) and perturbation wakeups
 * 3. 50 coincident nodes stability at [0,0,0] without NaN or Infinity
 * 4. Standing wave Dirichlet invariants across 1,000 random timestamps
 * 5. Camera transition interruption and polar singularity limits (phi -> 0, PI)
 *
 * Zero external dependencies. Pure node:test.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from '../../src/vault/math/vector3.js';
import { SpringSimulation } from '../../src/vault/physics/spring-damper.js';
import { generateVibratingEdgePolyline } from '../../src/vault/physics/edge-vibrator.js';
import { CameraController } from '../../src/vault/math/camera-kinematics.js';
import { assertVector3Close, assertIsUnitVector } from './test-helpers.js';

// =========================================================================
// SUITE 1: PHYSICS SYMPLECTIC EULER ENERGY CONSERVATION & NUMERIC DRIFT
// =========================================================================
describe('Adversarial Challenge 1: Physics Energy Conservation & Symplectic Euler Stability', () => {
  test('1.1: 1,000 steps on 30-node complex network: energy remains bounded and velocities clamped', () => {
    // Construct 30 nodes with high initial displacements and high velocities
    const nodes = [];
    for (let i = 0; i < 30; i++) {
      nodes.push({
        id: `N_${i}`,
        x: ((i * 37) % 200) - 100,
        y: ((i * 73) % 200) - 100,
        z: ((i * 101) % 200) - 100,
        vx: ((i * 17) % 300) - 150,
        vy: ((i * 43) % 300) - 150,
        vz: ((i * 89) % 300) - 150,
        mass: 1.0 + (i % 3) * 0.5
      });
    }

    // Connect nodes with a ring plus cross-links
    const edges = [];
    for (let i = 0; i < 30; i++) {
      edges.push({
        id: `e_${i}_next`,
        source: `N_${i}`,
        target: `N_${(i + 1) % 30}`,
        restLength: 60,
        stiffness: 0.25
      });
      if (i % 2 === 0) {
        edges.push({
          id: `e_${i}_cross`,
          source: `N_${i}`,
          target: `N_${(i + 7) % 30}`,
          restLength: 90,
          stiffness: 0.15
        });
      }
    }

    const sim = new SpringSimulation({ nodes, edges }, {
      maxVelocity: 400.0,
      fixedDt: 0.02
    });

    const maxObservedKinetic = 1e8; // Conservative sanity upper bound
    let peakKinetic = 0;

    for (let step = 0; step < 1000; step++) {
      const res = sim.step(0.02);

      assert.ok(
        Number.isFinite(res.kinetic) && !Number.isNaN(res.kinetic),
        `Kinetic energy at step ${step} must be finite, got ${res.kinetic}`
      );
      assert.ok(
        Number.isFinite(res.potential) && !Number.isNaN(res.potential),
        `Potential energy at step ${step} must be finite, got ${res.potential}`
      );

      if (res.kinetic > peakKinetic) peakKinetic = res.kinetic;
      assert.ok(
        res.kinetic < maxObservedKinetic,
        `Kinetic energy explosion detected at step ${step}: ${res.kinetic}`
      );

      // Verify node velocities strictly respect governor clamp
      for (const node of sim.nodeList) {
        assert.ok(Number.isFinite(node.x) && !Number.isNaN(node.x), `Node ${node.id} x is not finite at step ${step}`);
        assert.ok(Number.isFinite(node.y) && !Number.isNaN(node.y), `Node ${node.id} y is not finite at step ${step}`);
        assert.ok(Number.isFinite(node.z) && !Number.isNaN(node.z), `Node ${node.id} z is not finite at step ${step}`);

        const speed = Math.hypot(node.vx, node.vy, node.vz);
        assert.ok(
          speed <= 400.001,
          `Node ${node.id} velocity (${speed.toFixed(3)}) exceeded maxVelocity clamp 400.0 at step ${step}`
        );
      }
    }
  });

  test('1.2: Undamped Hamiltonian oscillator: 10,000 steps of Symplectic Euler preserves bounded energy', () => {
    // Pure Hookean spring with zero damping, zero drag, zero repulsion, zero gravity
    const graph = {
      nodes: [
        { id: 'M1', position: { x: -60, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, mass: 1.0 },
        { id: 'M2', position: { x: 60, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, mass: 1.0 }
      ],
      edges: [
        { id: 'e1', source: 'M1', target: 'M2', restLength: 60, stiffness: 4.0, damping: 0 }
      ]
    };

    // Initial separation = 120, deltaL = 120 - 60 = 60
    // E_potential = 0.5 * 4.0 * (60)^2 = 7200.0 J
    const sim = new SpringSimulation(graph, {
      kRepulsion: 0,
      kCenter: 0,
      velocityDamping: 0,
      dampingRatio: 0,
      sleepEnergyThreshold: -1.0 // Disable sleep
    });

    const initialEnergy = sim.getSimulationEnergy().total;
    assert.ok(Math.abs(initialEnergy - 7200) < 1e-4, `Initial total energy should be 7200 J, got ${initialEnergy}`);

    let minTotal = initialEnergy;
    let maxTotal = initialEnergy;

    // Simulate 10,000 steps
    for (let s = 0; s < 10000; s++) {
      sim.step(0.01);
      const e = sim.getSimulationEnergy().total;
      if (e < minTotal) minTotal = e;
      if (e > maxTotal) maxTotal = e;
    }

    const maxDeviationRatio = Math.max(Math.abs(maxTotal - initialEnergy), Math.abs(minTotal - initialEnergy)) / initialEnergy;

    // Symplectic Euler preserves a shadow Hamiltonian with O(dt) bounded oscillations:
    // Deviation must stay strictly below 5% even after 10,000 steps (forward Euler would diverge exponentially > 10^10)
    assert.ok(
      maxDeviationRatio < 0.05,
      `Symplectic Euler energy deviation after 10,000 steps (${(maxDeviationRatio * 100).toFixed(2)}%) must be < 5.0% without numeric runaway`
    );
  });

  test('1.3: Variable and extreme delta time steps maintain numerical stability', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: -20, y: 0, z: 0 } },
        { id: 'B', position: { x: 20, y: 0, z: 0 } }
      ],
      edges: [{ id: 'e1', source: 'A', target: 'B', restLength: 40 }]
    };

    const sim = new SpringSimulation(graph);

    const testDts = [0.0001, 0.005, 0.02, 0.05, 10.0, -0.5, 0];
    for (const dt of testDts) {
      const res = sim.step(dt);
      assert.ok(Number.isFinite(res.kinetic) && !Number.isNaN(res.kinetic));
      assert.ok(Number.isFinite(res.potential) && !Number.isNaN(res.potential));
      const posA = sim.getNodePosition('A');
      const posB = sim.getNodePosition('B');
      assert.ok(Number.isFinite(posA.x) && Number.isFinite(posB.x));
    }
  });
});

// =========================================================================
// SUITE 2: REST / SLEEP STATE VERIFICATION
// =========================================================================
describe('Adversarial Challenge 2: Kinetic Rest/Sleep State Verification', () => {
  test('2.1: System settles strictly to Ek < 10^-3 and enters sleep state', () => {
    // 2-node damped spring-damper system
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
      sleepEnergyThreshold: 0.001, // Ek < 10^-3
      sleepTicksRequired: 30,      // exactly 30 consecutive ticks
      velocityDamping: 0.2
    });

    assert.equal(sim.isResting(), false);

    let settled = false;
    let stepCount = 0;
    const maxSteps = 1000;

    for (let s = 0; s < maxSteps; s++) {
      const res = sim.step(0.02);
      stepCount++;
      if (res.isResting) {
        settled = true;
        // Verify Ek is strictly below threshold when rest is engaged
        assert.ok(
          res.kinetic < 0.001,
          `At rest transition, kinetic energy must be < 10^-3, got ${res.kinetic}`
        );
        break;
      }
    }

    assert.equal(settled, true, `System must settle into sleep within ${maxSteps} steps (settled at ${stepCount})`);
    assert.equal(sim.isResting(), true);
  });

  test('2.2: Sleep state invariant: zero physics iterations, kinetic energy = 0, positions frozen', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: -30, y: 0, z: 0 } },
        { id: 'B', position: { x: 30, y: 0, z: 0 } }
      ],
      edges: [{ id: 'e1', source: 'A', target: 'B', restLength: 60 }]
    };

    const sim = new SpringSimulation(graph, {
      sleepEnergyThreshold: 0.001,
      sleepTicksRequired: 15,
      velocityDamping: 0.5
    });

    // Run until asleep
    for (let s = 0; s < 1000; s++) {
      if (sim.step(0.02).isResting) break;
    }
    assert.equal(sim.isResting(), true);

    const snapshotA = sim.getNodePosition('A').clone();
    const snapshotB = sim.getNodePosition('B').clone();

    // Execute 50 subsequent steps while asleep
    for (let s = 0; s < 50; s++) {
      const res = sim.step(0.02);
      assert.equal(res.isResting, true);
      assert.equal(res.kinetic, 0, 'Kinetic energy in resting state must be zero');
      assert.equal(res.stepsRun, 0, 'Physics step calculations must be bypassed (stepsRun === 0) during sleep');

      assertVector3Close(sim.getNodePosition('A'), snapshotA, 1e-12, 'Node A position must remain strictly frozen');
      assertVector3Close(sim.getNodePosition('B'), snapshotB, 1e-12, 'Node B position must remain strictly frozen');
    }
  });

  test('2.3: Perturbation immediately wakes sleeping simulation and re-settles', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: -30, y: 0, z: 0 } },
        { id: 'B', position: { x: 30, y: 0, z: 0 } }
      ],
      edges: [{ id: 'e1', source: 'A', target: 'B', restLength: 60 }]
    };

    const sim = new SpringSimulation(graph, {
      sleepEnergyThreshold: 0.001,
      sleepTicksRequired: 10,
      velocityDamping: 0.5
    });

    for (let s = 0; s < 1000; s++) {
      if (sim.step(0.02).isResting) break;
    }
    assert.equal(sim.isResting(), true);

    // Perturbation 1: symmetric displacement waking simulation
    sim.setNodePosition('A', { x: -45, y: 0, z: 0 });
    sim.setNodePosition('B', { x: 45, y: 0, z: 0 });
    assert.equal(sim.isResting(), false, 'setNodePosition must wake the simulation');
    const step1 = sim.step(0.02);
    assert.equal(step1.stepsRun, 1);
    assert.ok(step1.kinetic > 0);

    // Run until re-settling
    let reSettled1 = false;
    for (let s = 0; s < 1500; s++) {
      if (sim.step(0.02).isResting) {
        reSettled1 = true;
        break;
      }
    }
    assert.equal(reSettled1, true, 'Simulation must re-settle after node displacement');

    // Perturbation 2: pin / unpin node
    sim.pinNode('A', true);
    assert.equal(sim.isResting(), false, 'pinNode must wake the simulation');
    sim.pinNode('A', false);

    // Re-settle
    let reSettled2 = false;
    for (let s = 0; s < 1000; s++) {
      if (sim.step(0.02).isResting) {
        reSettled2 = true;
        break;
      }
    }
    assert.equal(reSettled2, true, 'Simulation must re-settle after unpinning');

    // Perturbation 3: explicit wake()
    sim.wake();
    assert.equal(sim.isResting(), false, 'wake() must activate simulation state');
  });

  test('2.4: Sleep tick accumulator resets if kinetic energy exceeds threshold', () => {
    const graph = {
      nodes: [
        { id: 'A', position: { x: 0, y: 0, z: 0 } }
      ],
      edges: []
    };

    const sim = new SpringSimulation(graph, {
      sleepEnergyThreshold: 0.001,
      sleepTicksRequired: 10
    });

    // Advance 5 ticks
    for (let i = 0; i < 5; i++) sim.step(0.02);
    assert.equal(sim.sleepTicks, 5);

    // Inject velocity into node A
    const internalA = sim.nodes.get('A');
    internalA.vx = 50.0;

    // Step: kinetic energy will spike above threshold
    sim.step(0.02);
    assert.equal(sim.sleepTicks, 0, 'Sleep ticks counter must reset to 0 when kinetic energy spikes');
    assert.equal(sim.isResting(), false);
  });
});

// =========================================================================
// SUITE 3: 50 COINCIDENT NODES STABILITY STRESS
// =========================================================================
describe('Adversarial Challenge 3: 50 Coincident Nodes Stability at [0,0,0]', () => {
  test('3.1: 50 nodes placed at identical coordinates [0,0,0] separate without NaN or Infinity', () => {
    const nodeCount = 50;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({ id: `Coincident_${i}`, x: 0, y: 0, z: 0 });
    }

    const sim = new SpringSimulation({ nodes, edges: [] }, {
      kRepulsion: 3000.0,
      kCenter: 0.01,
      velocityDamping: 0.2
    });

    // Initial check: all nodes at [0,0,0]
    for (const pos of sim.getNodePositions().values()) {
      assert.equal(pos.x, 0);
      assert.equal(pos.y, 0);
      assert.equal(pos.z, 0);
    }

    // Run 1,000 steps of simulation
    for (let step = 0; step < 1000; step++) {
      const res = sim.step(0.02);

      assert.ok(
        Number.isFinite(res.kinetic) && !Number.isNaN(res.kinetic),
        `Kinetic energy at step ${step} is not finite: ${res.kinetic}`
      );
      assert.ok(
        Number.isFinite(res.potential) && !Number.isNaN(res.potential),
        `Potential energy at step ${step} is not finite: ${res.potential}`
      );

      // Verify every node position is finite and non-NaN
      for (const node of sim.nodeList) {
        assert.ok(
          Number.isFinite(node.x) && !Number.isNaN(node.x),
          `Node ${node.id} pos.x NaN/Inf at step ${step}: ${node.x}`
        );
        assert.ok(
          Number.isFinite(node.y) && !Number.isNaN(node.y),
          `Node ${node.id} pos.y NaN/Inf at step ${step}: ${node.y}`
        );
        assert.ok(
          Number.isFinite(node.z) && !Number.isNaN(node.z),
          `Node ${node.id} pos.z NaN/Inf at step ${step}: ${node.z}`
        );
      }
    }
  });

  test('3.2: 50 coincident nodes achieve pairwise separation d(i,j) > 0 immediately and expand stably', () => {
    const nodeCount = 50;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({ id: `N_${i}`, x: 0, y: 0, z: 0 });
    }

    const sim = new SpringSimulation({ nodes, edges: [] });

    // Step 1: Anti-singularity perturbation must separate all 50 nodes
    sim.step(0.02);
    const posListStep1 = Array.from(sim.getNodePositions().values());

    let minDistStep1 = Infinity;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const d = posListStep1[i].distanceTo(posListStep1[j]);
        if (d < minDistStep1) minDistStep1 = d;
      }
    }

    assert.ok(
      minDistStep1 > 0,
      `Step 1: All 50 nodes must be separated immediately: minDist = ${minDistStep1}`
    );

    // Advance to step 500: repulsive forces must have created a well-spaced 3D cloud
    for (let s = 1; s < 500; s++) {
      sim.step(0.02);
    }

    const posListStep500 = Array.from(sim.getNodePositions().values());
    let minDistStep500 = Infinity;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const d = posListStep500[i].distanceTo(posListStep500[j]);
        if (d < minDistStep500) minDistStep500 = d;
      }
    }

    assert.ok(
      minDistStep500 > 10.0,
      `Step 500: Cloud must be well dispersed, minimum pairwise distance was ${minDistStep500.toFixed(2)}`
    );
  });

  test('3.3: 50 coincident nodes with heterogeneous masses and ring-and-star edges', () => {
    const nodeCount = 50;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `M_${i}`,
        x: 0,
        y: 0,
        z: 0,
        mass: 0.2 + (i * 0.1) // masses from 0.2 to 5.1
      });
    }

    const edges = [];
    for (let i = 0; i < nodeCount; i++) {
      edges.push({
        id: `e_${i}`,
        source: `M_${i}`,
        target: `M_${(i + 1) % nodeCount}`,
        restLength: 40
      });
      if (i > 0 && i % 5 === 0) {
        edges.push({
          id: `e_star_${i}`,
          source: 'M_0',
          target: `M_${i}`,
          restLength: 70
        });
      }
    }

    const sim = new SpringSimulation({ nodes, edges });

    for (let s = 0; s < 500; s++) {
      const res = sim.step(0.02);
      assert.ok(Number.isFinite(res.kinetic) && !Number.isNaN(res.kinetic));
    }

    for (const node of sim.nodeList) {
      assert.ok(Number.isFinite(node.x) && !Number.isNaN(node.x));
      assert.ok(Number.isFinite(node.vx) && !Number.isNaN(node.vx));
    }
  });

  test('3.4: 50 coincident nodes placed at large offset non-zero coordinate [-5000, 2500, -7500]', () => {
    const offset = [-5000, 2500, -7500];
    const nodes = [];
    for (let i = 0; i < 50; i++) {
      nodes.push({ id: `Offset_${i}`, x: offset[0], y: offset[1], z: offset[2] });
    }

    const sim = new SpringSimulation({ nodes, edges: [] }, { kCenter: 0.001 });
    sim.step(0.02);

    for (const node of sim.nodeList) {
      assert.ok(Number.isFinite(node.x) && !Number.isNaN(node.x));
      assert.ok(Number.isFinite(node.y) && !Number.isNaN(node.y));
      assert.ok(Number.isFinite(node.z) && !Number.isNaN(node.z));
    }
  });
});

// =========================================================================
// SUITE 4: STANDING WAVE DIRICHLET INVARIANTS ACROSS 1,000 TIMESTAMPS
// =========================================================================
describe('Adversarial Challenge 4: Standing Wave Dirichlet Invariants Stress', () => {
  test('4.1: Dirichlet fixed-endpoint invariance d(0,t)=0 and d(1,t)=0 strictly holds for 1,000 random timestamps', () => {
    const p1 = new Vector3(-123.456, 78.901, -34.567);
    const p2 = new Vector3(89.012, -45.678, 123.789);

    const segments = 16;
    let maxDist0 = 0;
    let maxDist1 = 0;

    // Deterministic pseudo-random sequence for 1,000 timestamps across extreme ranges
    for (let i = 0; i < 1000; i++) {
      // Range: -1,000,000 to +1,000,000 seconds with fractional values
      const t = Math.sin(i * 1.37) * 1e6 + Math.cos(i * 0.91) * 100.0;

      const polyline = generateVibratingEdgePolyline(p1, p2, t, {
        segments,
        amplitude: 5.0,
        frequency: 18.0,
        isVibrating: true
      });

      assert.equal(polyline.length, segments + 1);

      const d0 = polyline[0].distanceTo(p1);
      const d1 = polyline[segments].distanceTo(p2);

      if (d0 > maxDist0) maxDist0 = d0;
      if (d1 > maxDist1) maxDist1 = d1;

      // Start vertex: exact mathematical zero
      assert.ok(
        d0 < 1e-12,
        `d(0, t) violation at stamp i=${i}, t=${t}: d0=${d0}`
      );

      // End vertex: IEEE 754 precision bound (sin(PI) ~ 1.22e-16 gives machine-epsilon drift < 1e-12)
      assert.ok(
        d1 < 1e-12,
        `d(1, t) violation at stamp i=${i}, t=${t}: d1=${d1}`
      );
    }

    assert.ok(maxDist0 < 1e-12, `Maximum start drift ${maxDist0} must be < 1e-12`);
    assert.ok(maxDist1 < 1e-12, `Maximum end drift ${maxDist1} must be < 1e-12`);
  });

  test('4.2: Boundary invariant across edge orientations: vertical (ty > 0.95), horizontal, and zero-length', () => {
    const orientations = [
      { name: 'Vertical +Y', p1: new Vector3(0, -100, 0), p2: new Vector3(0, 100, 0) },
      { name: 'Vertical -Y', p1: new Vector3(0, 100, 0), p2: new Vector3(0, -100, 0) },
      { name: 'Collinear X', p1: new Vector3(-50, 0, 0), p2: new Vector3(50, 0, 0) },
      { name: 'Collinear Z', p1: new Vector3(0, 0, -80), p2: new Vector3(0, 0, 80) },
      { name: 'Degenerate Zero-Length', p1: new Vector3(33, 44, 55), p2: new Vector3(33, 44, 55) }
    ];

    for (const ori of orientations) {
      for (let s = 0; s < 50; s++) {
        const t = s * 0.123;
        const line = generateVibratingEdgePolyline(ori.p1, ori.p2, t, {
          segments: 20,
          amplitude: 8.0,
          isVibrating: true
        });

        assert.equal(line.length, 21);
        const d0 = line[0].distanceTo(ori.p1);
        const d1 = line[20].distanceTo(ori.p2);

        assert.ok(d0 < 1e-12, `[${ori.name}] d0 failed: ${d0}`);
        assert.ok(d1 < 1e-12, `[${ori.name}] d1 failed: ${d1}`);
      }
    }
  });

  test('4.3: Boundary invariant across extreme amplitudes and frequencies', () => {
    const p1 = new Vector3(-10, -20, -30);
    const p2 = new Vector3(40, 50, 60);

    const extremeConfigs = [
      { amplitude: 0.0, frequency: 10.0 },
      { amplitude: 1000.0, frequency: 10000.0 },
      { amplitude: 0.0001, frequency: 0.0001 },
      { amplitude: 50.0, frequency: 0.0 }
    ];

    for (const cfg of extremeConfigs) {
      const line = generateVibratingEdgePolyline(p1, p2, 12.345, {
        segments: 32,
        amplitude: cfg.amplitude,
        frequency: cfg.frequency,
        isVibrating: true
      });

      assert.ok(line[0].distanceTo(p1) < 1e-12);
      assert.ok(line[32].distanceTo(p2) < 1e-12);
    }
  });
});

// =========================================================================
// SUITE 5: CAMERA TRANSITION INTERRUPTION & POLAR SINGULARITY LIMITS
// =========================================================================
describe('Adversarial Challenge 5: Camera Polar Singularity & Transition Interruption', () => {
  test('5.1: Polar singularity limits (phi -> 0, PI) strictly clamped against gimbal lock', () => {
    const minPhi = 0.001;
    const maxPhi = Math.PI - 0.001;

    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100],
      minPolarAngle: minPhi,
      maxPolarAngle: maxPhi
    });

    // Extreme pitch up (orbiting to North Pole zenith)
    cam.orbit(0, 1e7);
    let s = cam.getState();
    assert.ok(s.spherical.phi >= minPhi, `Phi must not breach minPolarAngle: ${s.spherical.phi}`);
    assert.ok(s.spherical.phi < minPhi + 1e-6);

    // Verify coordinate frame validity at north pole limit
    assertIsUnitVector(s.forward, 1e-4, 'North Pole forward vector must be unit');
    assertIsUnitVector(s.up, 1e-4, 'North Pole up vector must be unit');
    assertIsUnitVector(s.right, 1e-4, 'North Pole right vector must be unit');

    // Orthogonality checks
    assert.ok(Math.abs(s.forward.dot(s.up)) < 1e-4, 'forward and up must be orthogonal');
    assert.ok(Math.abs(s.forward.dot(s.right)) < 1e-4, 'forward and right must be orthogonal');
    assert.ok(Math.abs(s.up.dot(s.right)) < 1e-4, 'up and right must be orthogonal');

    // Extreme pitch down (orbiting to South Pole nadir)
    cam.orbit(0, -2e7);
    s = cam.getState();
    assert.ok(s.spherical.phi <= maxPhi, `Phi must not breach maxPolarAngle: ${s.spherical.phi}`);
    assert.ok(s.spherical.phi > maxPhi - 1e-6);

    // Verify coordinate frame validity at south pole limit
    assertIsUnitVector(s.forward, 1e-4, 'South Pole forward vector must be unit');
    assertIsUnitVector(s.up, 1e-4, 'South Pole up vector must be unit');
    assertIsUnitVector(s.right, 1e-4, 'South Pole right vector must be unit');

    assert.ok(Math.abs(s.forward.dot(s.up)) < 1e-4);
    assert.ok(Math.abs(s.forward.dot(s.right)) < 1e-4);
    assert.ok(Math.abs(s.up.dot(s.right)) < 1e-4);
  });

  test('5.2: In-flight transition interruption by orbit, pan, zoom, and chained transition', () => {
    const cam = new CameraController({
      position: [0, 50, 200],
      target: [0, 0, 0]
    });

    // In-flight transition: advance to ~25%
    cam.transitionTo(new Vector3(200, 200, 200), 150, 2.0);
    cam.update(0.5);
    assert.equal(cam.getState().isTransitioning, true);

    const posInFlight = cam.getState().position.clone();
    const targetInFlight = cam.getState().target.clone();

    // Cancellation check: cancelTransition preserves EXACT position and target
    cam.cancelTransition();
    assert.equal(cam.getState().isTransitioning, false, 'cancelTransition must cancel transition');
    assertVector3Close(cam.getState().position, posInFlight, 1e-12, 'Cancellation must preserve exact position');
    assertVector3Close(cam.getState().target, targetInFlight, 1e-12, 'Cancellation must preserve exact target');

    // Subsequent updates do nothing
    const ranAfterCancel = cam.update(0.1);
    assert.equal(ranAfterCancel, false);

    // Case A: Orbit interruption
    cam.transitionTo(new Vector3(100, 100, 100), 150, 2.0);
    cam.update(0.4);
    assert.equal(cam.getState().isTransitioning, true);
    const posBeforeOrbit = cam.getState().position.clone();

    cam.orbit(1, 1); // Micro-orbit drag
    assert.equal(cam.getState().isTransitioning, false, 'Orbit must cancel active transition');
    // Camera must continue smoothly from current location without teleporting to start or destination
    const posAfterOrbit = cam.getState().position;
    assert.ok(
      posAfterOrbit.distanceTo(posBeforeOrbit) < 2.0,
      `Micro-orbit shift should be smooth (< 2.0): dist = ${posAfterOrbit.distanceTo(posBeforeOrbit)}`
    );

    // Case B: Pan interruption
    cam.transitionTo(new Vector3(-100, -100, -100), 200, 1.5);
    cam.update(0.3);
    assert.equal(cam.getState().isTransitioning, true);
    cam.pan(25, -30);
    assert.equal(cam.getState().isTransitioning, false, 'Pan must cancel active transition');

    // Case C: Zoom interruption
    cam.transitionTo(new Vector3(50, 50, 50), 300, 1.0);
    cam.update(0.2);
    assert.equal(cam.getState().isTransitioning, true);
    cam.zoom(100);
    assert.equal(cam.getState().isTransitioning, false, 'Zoom must cancel active transition');

    // Case D: Chained transitionTo interruption (user clicks another node mid-flight)
    cam.transitionTo(new Vector3(100, 0, 0), 200, 2.0);
    cam.update(0.6);
    const midPos = cam.getState().position.clone();

    // Re-target immediately to a different node
    const newTarget = new Vector3(-300, 50, 100);
    cam.transitionTo(newTarget, 100, 1.0);

    assert.equal(cam.getState().isTransitioning, true);
    // Camera should start the new transition from midPos without teleporting
    assertVector3Close(cam.getState().position, midPos, 1e-4, 'New transition must seamlessly originate from interruption position');

    // Advance new transition to completion
    for (let i = 0; i < 20; i++) cam.update(0.1);
    assert.equal(cam.getState().isTransitioning, false);
    assertVector3Close(cam.getState().target, newTarget, 1e-4);
  });

  test('5.3: Antipodal 180-degree nadir-to-zenith transition fallback stability', () => {
    // Camera looking down from North Pole (+Y), target at [0,0,0], transitioning to South Pole (-Y)
    const cam = new CameraController({
      position: [0, 100, 0],
      target: [0, 0, 0]
    });

    // Transition to exactly opposite position
    cam.transitionTo([0, 0, 0], 100, 1.0);

    for (let i = 0; i < 20; i++) {
      cam.update(0.05);
      const s = cam.getState();
      assert.ok(!Number.isNaN(s.position.x), `NaN detected in position.x at step ${i}`);
      assert.ok(!Number.isNaN(s.position.y), `NaN detected in position.y at step ${i}`);
      assert.ok(!Number.isNaN(s.position.z), `NaN detected in position.z at step ${i}`);
    }

    assert.equal(cam.getState().isTransitioning, false);
  });

  test('5.4: Zero/negative duration and instantaneous transitions execute safely', () => {
    const cam = new CameraController({
      position: [0, 0, 100],
      target: [0, 0, 0]
    });

    const targetPos = new Vector3(50, 75, -100);
    cam.transitionTo(targetPos, 250, 0); // 0 duration

    assert.equal(cam.getState().isTransitioning, false);
    assertVector3Close(cam.getState().target, targetPos, 1e-4);
    assert.equal(cam.getState().spherical.radius, 250);

    // Negative duration
    cam.transitionTo([10, 20, 30], 100, -1.0);
    assert.equal(cam.getState().isTransitioning, false);
    assertVector3Close(cam.getState().target, [10, 20, 30], 1e-4);
  });
});
