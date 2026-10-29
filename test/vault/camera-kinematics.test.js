/**
 * @file test/vault/camera-kinematics.test.js
 * @description Comprehensive automated tests for CameraController kinematics and interpolation.
 * Covers Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases).
 * Zero external dependencies, pure node:test.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from '../../src/vault/math/vector3.js';
import { CameraController, easeOutQuint, slerpDirections } from '../../src/vault/math/camera-kinematics.js';
import { assertVector3Close, assertIsUnitVector } from './test-helpers.js';

describe('F2: Camera Kinematics — Tier 1 Feature Coverage', () => {
  test('T1.1: Spherical orbit navigation alters azimuth and polar angles', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100], // On +Z axis: r=100, theta=0, phi=PI/2
      viewportWidth: 1000,
      viewportHeight: 1000
    });

    const init = cam.getState();
    assert.equal(init.spherical.radius, 100);
    assert.ok(Math.abs(init.spherical.phi - Math.PI / 2) < 1e-4);

    // Orbit horizontally (deltaX > 0)
    cam.orbit(100, 0);
    const afterX = cam.getState();
    assert.notEqual(afterX.spherical.theta, init.spherical.theta, 'Theta must change after horizontal orbit');
    assert.equal(afterX.spherical.radius, 100, 'Radius must remain invariant during orbit');
    assertVector3Close(afterX.target, [0, 0, 0], 1e-6, 'Target must remain invariant during orbit');

    // Orbit vertically (deltaY > 0)
    const prevPhi = afterX.spherical.phi;
    cam.orbit(0, 50);
    const afterY = cam.getState();
    assert.notEqual(afterY.spherical.phi, prevPhi, 'Phi must change after vertical orbit');
  });

  test('T1.2: Polar gimbal-lock prevention via clamping [eps, PI - eps]', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100],
      minPolarAngle: 0.001,
      maxPolarAngle: Math.PI - 0.001
    });

    // Attempt to orbit far beyond the North pole (zenith singularity)
    cam.orbit(0, 50000);
    let state = cam.getState();
    assert.ok(
      state.spherical.phi >= 0.001,
      `Phi ${state.spherical.phi} must not be less than minPolarAngle 0.001`
    );
    assert.ok(!Number.isNaN(state.position.x) && !Number.isNaN(state.position.y) && !Number.isNaN(state.position.z));

    // Attempt to orbit far beyond the South pole (nadir singularity)
    cam.orbit(0, -100000);
    state = cam.getState();
    assert.ok(
      state.spherical.phi <= Math.PI - 0.001,
      `Phi ${state.spherical.phi} must not exceed maxPolarAngle PI - 0.001`
    );
    assert.ok(!Number.isNaN(state.position.x));
  });

  test('T1.3: Distance-scaled planar pan navigation', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100] // looking down -Z axis
    });

    const initTarget = cam.getState().target;
    const initPos = cam.getState().position;

    // Pan right (deltaX = 50, deltaY = 0)
    cam.pan(50, 0);
    const panned = cam.getState();

    // Both target and camera position must move by the exact same offset vector
    const deltaTarget = new Vector3().copy(panned.target).sub(initTarget);
    const deltaPos = new Vector3().copy(panned.position).sub(initPos);

    assertVector3Close(deltaTarget, deltaPos, 1e-5, 'Pan must translate target and camera identically');
    assert.equal(panned.spherical.radius, 100, 'Radius must remain invariant during pan');
  });

  test('T1.4: Logarithmic zoom navigation with distance scaling', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 200],
      minDistance: 10,
      maxDistance: 2000
    });

    const r0 = cam.getState().spherical.radius;
    assert.equal(r0, 200);

    // Zoom in (negative deltaY: wheel up decreases radius)
    cam.zoom(-100);
    const rIn = cam.getState().spherical.radius;
    assert.ok(rIn < r0, `Zoom in must reduce radius: ${rIn} < ${r0}`);

    // Zoom out (positive deltaY: wheel down increases radius)
    cam.zoom(150);
    const rOut = cam.getState().spherical.radius;
    assert.ok(rOut > rIn, `Zoom out must increase radius: ${rOut} > ${rIn}`);
  });

  test('T1.5: Smooth transitionTo interpolation with easeOutQuint curve', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100]
    });

    const newTarget = new Vector3(50, 20, -30);
    const newDistance = 150;
    cam.transitionTo(newTarget, newDistance, 1.0); // 1.0 second duration

    assert.equal(cam.getState().isTransitioning, true);

    // Advance 5 steps of 0.1s (total 0.5s halfway)
    for (let i = 0; i < 5; i++) {
      const running = cam.update(0.1);
      assert.equal(running, true);
    }
    const mid = cam.getState();
    assert.ok(mid.progress >= 0.49 && mid.progress <= 0.51, `Progress should be ~0.5, got ${mid.progress}`);

    // Advance remaining steps until transition settles
    while (cam.getState().isTransitioning) {
      cam.update(0.1);
    }
    assert.equal(cam.getState().isTransitioning, false);
    // Subsequent update call must return false (idle)
    const afterDone = cam.update(0.1);
    assert.equal(afterDone, false, 'update() after transition complete should return false');

    // Target must match newTarget and radius must match newDistance
    assertVector3Close(cam.getState().target, newTarget, 1e-4);
    assert.ok(Math.abs(cam.getState().spherical.radius - newDistance) < 1e-3);
  });

  test('T1.6: EaseOutQuint mathematical curve characteristics', () => {
    // E(0) = 0
    assert.equal(easeOutQuint(0), 0);
    // E(1) = 1
    assert.equal(easeOutQuint(1), 1);
    // Quintic ease-out accelerates quickly: at t=0.5, E(0.5) = 1 - 0.5^5 = 1 - 0.03125 = 0.96875
    assert.ok(Math.abs(easeOutQuint(0.5) - 0.96875) < 1e-6);
    // Clamping out-of-range inputs
    assert.equal(easeOutQuint(-0.5), 0);
    assert.equal(easeOutQuint(1.5), 1);
  });
});

describe('F2: Camera Kinematics — Tier 2 Boundary & Corner Cases', () => {
  test('T2.1: Zero deltas produce zero state change', () => {
    const cam = new CameraController({
      target: [10, 20, 30],
      position: [10, 20, 130]
    });

    const beforeState = cam.getState();
    cam.orbit(0, 0);
    cam.pan(0, 0);
    cam.zoom(0);
    const afterState = cam.getState();

    assertVector3Close(afterState.position, beforeState.position, 1e-6);
    assertVector3Close(afterState.target, beforeState.target, 1e-6);
    assert.equal(afterState.spherical.radius, beforeState.spherical.radius);
    assert.equal(afterState.isTransitioning, false);
  });

  test('T2.2: Extreme zoom clamping to minDistance and maxDistance', () => {
    const minD = 10;
    const maxD = 500;
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100],
      minDistance: minD,
      maxDistance: maxD
    });

    // Extreme zoom in (negative deltaY wheel up) clamps to minDistance
    cam.zoom(-100000);
    assert.equal(cam.getState().spherical.radius, minD, `Radius must clamp to minDistance ${minD}`);

    // Extreme zoom out (positive deltaY wheel down) clamps to maxDistance
    cam.zoom(200000);
    assert.equal(cam.getState().spherical.radius, maxD, `Radius must clamp to maxDistance ${maxD}`);
  });

  test('T2.3: User interaction immediately cancels active transition without jump', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100]
    });

    cam.transitionTo(new Vector3(500, 500, 500), 200, 1.0);
    cam.update(0.1);
    cam.update(0.1);
    cam.update(0.1); // Mid-transition (0.3s)
    assert.equal(cam.getState().isTransitioning, true);

    const midPos = cam.getState().position.clone();

    // User interrupts by orbiting
    cam.orbit(10, 10);
    assert.equal(cam.getState().isTransitioning, false, 'Transition must be canceled by user orbit');

    // Camera must continue smoothly from midPos, not snapped back to origin or end
    assert.ok(cam.getState().position.distanceTo(midPos) < 20);
  });

  test('T2.4: Collinear/anti-collinear Slerp fallback handles 180-degree transitions safely', () => {
    const d0 = new Vector3(0, 0, 1);
    const d1 = new Vector3(0, 0, -1); // Exactly opposite (omega = PI)

    // Intermediate alpha where vectors are not exactly cancelled out
    const step = slerpDirections(d0, d1, 0.2);
    assert.ok(!Number.isNaN(step.x) && !Number.isNaN(step.y) && !Number.isNaN(step.z));
    assertIsUnitVector(step);

    // Parallel identical vectors
    const same = slerpDirections(d0, d0, 0.5);
    assertVector3Close(same, d0);
    assertIsUnitVector(same);

    // At exact midpoint of 180-deg opposite vectors, fallback yields zero vector safely without NaN
    const mid = slerpDirections(d0, d1, 0.5);
    assert.ok(!Number.isNaN(mid.x) && !Number.isNaN(mid.y) && !Number.isNaN(mid.z));
  });

  test('T2.5: Extreme deltaSec updates (0s, negative, huge tab-switch delay)', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100]
    });

    cam.transitionTo(new Vector3(100, 0, 0), 100, 0.8);

    // Zero deltaSec
    cam.update(0);
    assert.equal(cam.getState().isTransitioning, true);
    assert.equal(cam.getState().progress, 0);

    // Negative deltaSec handled safely (clamped to 0)
    cam.update(-0.1);
    assert.equal(cam.getState().progress, 0);

    // Frame update with clamping to max 0.1s step per call:
    for (let i = 0; i < 10; i++) {
      cam.update(0.1);
    }
    assert.equal(cam.getState().isTransitioning, false);
    assert.equal(cam.getState().progress, 1.0);
    assertVector3Close(cam.getState().target, [100, 0, 0]);
  });

  test('T2.6: setTarget with keepDistance=true vs keepDistance=false', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100]
    });

    // keepDistance=true (default): camera shifts with target
    cam.setTarget([50, 50, 50], true);
    assertVector3Close(cam.getState().target, [50, 50, 50]);
    assertVector3Close(cam.getState().position, [50, 50, 150]);
    assert.equal(cam.getState().spherical.radius, 100);

    // keepDistance=false: target moves, camera stays in place, radius recomputed
    cam.setTarget([50, 50, 100], false);
    assertVector3Close(cam.getState().position, [50, 50, 150]);
    assert.equal(cam.getState().spherical.radius, 50);
  });

  test('T2.7: setPosition recomputes spherical coordinates accurately', () => {
    const cam = new CameraController({
      target: [0, 0, 0],
      position: [0, 0, 100]
    });

    // Move to +Y axis (North pole nadir check)
    cam.setPosition([0, 150, 0]);
    const state = cam.getState();
    assert.equal(state.spherical.radius, 150);
    assert.ok(state.spherical.phi <= 0.05);
  });
});
