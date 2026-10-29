/**
 * @file test/vault/edge-vibrator.test.js
 * @description Comprehensive automated tests for transverse standing wave edge vibrator.
 * Covers Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases).
 * Zero external dependencies, pure node:test.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateVibratingEdgePolyline } from '../../src/vault/physics/edge-vibrator.js';
import { Vector3 } from '../../src/vault/math/vector3.js';
import { assertVector3Close, assertDirichletBoundaries } from './test-helpers.js';

describe('F5: Dynamic Vibration & Wave Generator — Tier 1 Feature Coverage', () => {
  const p1 = new Vector3(0, 0, 0);
  const p2 = new Vector3(100, 0, 0);

  test('T1.1: Straight lines for valid edges (isVibrating=false)', () => {
    const polyline = generateVibratingEdgePolyline(p1, p2, 0.5, {
      segments: 10,
      isVibrating: false
    });

    assert.equal(polyline.length, 11, 'Must return segments + 1 vertices');
    assertDirichletBoundaries(polyline, p1, p2);

    // Every intermediate point must lie exactly on the straight baseline
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      assertVector3Close(polyline[i], [s * 100, 0, 0], 1e-6);
    }
  });

  test('T1.2: Transverse standing waves for cyclic edges (isVibrating=true)', () => {
    const polyline = generateVibratingEdgePolyline(p1, p2, 0.05, {
      segments: 16,
      amplitude: 5.0,
      isVibrating: true
    });

    assert.equal(polyline.length, 17);
    assertDirichletBoundaries(polyline, p1, p2);

    // Midpoint (index 8) must have non-zero transverse displacement (Y or Z != 0)
    const mid = polyline[8];
    const transverseDisplacement = Math.hypot(mid.y, mid.z);
    assert.ok(
      transverseDisplacement > 0.01,
      `Midpoint must have significant transverse displacement, got ${transverseDisplacement}`
    );
  });

  test('T1.3: Boundary Dirichlet conditions strictly hold across all time instances', () => {
    const times = [0, 0.01, 0.123, 1.0, 5.5, 100.0];

    for (const t of times) {
      const polyline = generateVibratingEdgePolyline(p1, p2, t, {
        segments: 16,
        amplitude: 10.0,
        isVibrating: true
      });

      // Strict attachment: start is p1, end is p2
      assertVector3Close(polyline[0], p1, 1e-6, `Start vertex must match p1 at t=${t}`);
      assertVector3Close(polyline[16], p2, 1e-6, `End vertex must match p2 at t=${t}`);
    }
  });

  test('T1.4: Time-based oscillation (different simulation times produce distinct waves)', () => {
    const waveT1 = generateVibratingEdgePolyline(p1, p2, 0.02, {
      segments: 16,
      amplitude: 5.0,
      frequency: 12.0,
      isVibrating: true
    });

    const waveT2 = generateVibratingEdgePolyline(p1, p2, 0.05, {
      segments: 16,
      amplitude: 5.0,
      frequency: 12.0,
      isVibrating: true
    });

    const mid1 = waveT1[8];
    const mid2 = waveT2[8];

    // Midpoints at different times must differ
    const distBetweenMids = mid1.distanceTo(mid2);
    assert.ok(
      distBetweenMids > 0.05,
      `Wave should oscillate over time: distance between midpoints is ${distBetweenMids.toFixed(3)}`
    );
  });

  test('T1.5: Midpoint antinode excursion matches spatial envelope sin(PI * s)', () => {
    // Spatial envelope is sin(PI * s). At s=0.5, envelope = sin(PI/2) = 1.0 (maximum)
    // At s=0.25 (index 4) and s=0.75 (index 12), envelope = sin(PI/4) = 0.7071
    const polyline = generateVibratingEdgePolyline(p1, p2, 0.02, {
      segments: 16,
      amplitude: 5.0,
      isVibrating: true
    });

    const dQuarter = Math.hypot(polyline[4].y, polyline[4].z);
    const dMid = Math.hypot(polyline[8].y, polyline[8].z);
    const dThreeQuarter = Math.hypot(polyline[12].y, polyline[12].z);

    assert.ok(dMid > dQuarter, `Midpoint excursion (${dMid}) must exceed quarter-point excursion (${dQuarter})`);
    assert.ok(dMid > dThreeQuarter, `Midpoint excursion (${dMid}) must exceed three-quarter excursion (${dThreeQuarter})`);
  });
});

describe('F5: Dynamic Vibration & Wave Generator — Tier 2 Boundary & Corner Cases', () => {
  test('T2.1: Degenerate zero-length edge (p1 === p2) safely handled without NaN', () => {
    const point = new Vector3(42, -18, 99);
    const polyline = generateVibratingEdgePolyline(point, point, 1.0, {
      segments: 8,
      amplitude: 5.0,
      isVibrating: true
    });

    assert.equal(polyline.length, 9);
    for (let i = 0; i < polyline.length; i++) {
      assertVector3Close(polyline[i], point, 1e-6);
      assert.ok(!Number.isNaN(polyline[i].x) && !Number.isNaN(polyline[i].y) && !Number.isNaN(polyline[i].z));
    }
  });

  test('T2.2: Vertical line along Y axis (ty = 1.0) reference vector switch', () => {
    // When edge is aligned with +Y, tangent is (0, 1, 0)
    // Up-vector reference must switch to (1, 0, 0) to avoid zero cross product
    const pBottom = new Vector3(0, 0, 0);
    const pTop = new Vector3(0, 100, 0);

    const polyline = generateVibratingEdgePolyline(pBottom, pTop, 0.05, {
      segments: 16,
      amplitude: 4.0,
      isVibrating: true
    });

    assert.equal(polyline.length, 17);
    assertDirichletBoundaries(polyline, pBottom, pTop);

    // Normal should lie in XZ plane: all vertices must have finite coordinates
    for (const v of polyline) {
      assert.ok(Number.isFinite(v.x) && !Number.isNaN(v.x));
      assert.ok(Number.isFinite(v.y) && !Number.isNaN(v.y));
      assert.ok(Number.isFinite(v.z) && !Number.isNaN(v.z));
    }
  });

  test('T2.3: Zero amplitude generates straight unperturbed line even when isVibrating=true', () => {
    const p1 = new Vector3(0, 0, 0);
    const p2 = new Vector3(50, 50, 50);

    const polyline = generateVibratingEdgePolyline(p1, p2, 1.0, {
      segments: 10,
      amplitude: 0,
      isVibrating: true
    });

    for (let k = 0; k <= 10; k++) {
      const s = k / 10;
      assertVector3Close(polyline[k], [s * 50, s * 50, s * 50], 1e-6);
    }
  });

  test('T2.4: minimalStraight=true returns exactly 2 points [p1, p2] when not vibrating', () => {
    const p1 = new Vector3(10, 20, 30);
    const p2 = new Vector3(40, 50, 60);

    const minimal = generateVibratingEdgePolyline(p1, p2, 0, {
      segments: 16,
      minimalStraight: true,
      isVibrating: false
    });

    assert.equal(minimal.length, 2, 'minimalStraight must return length 2 array');
    assertVector3Close(minimal[0], p1);
    assertVector3Close(minimal[1], p2);

    // But if isVibrating=true, minimalStraight is ignored and full polyline is generated
    const vibrating = generateVibratingEdgePolyline(p1, p2, 0, {
      segments: 16,
      minimalStraight: true,
      isVibrating: true
    });
    assert.equal(vibrating.length, 17);
  });

  test('T2.5: Custom segments count (1, 4, 32, 64) matches segment + 1 length', () => {
    const p1 = new Vector3(0, 0, 0);
    const p2 = new Vector3(10, 0, 0);

    for (const seg of [1, 4, 32, 64]) {
      const line = generateVibratingEdgePolyline(p1, p2, 0.5, { segments: seg, isVibrating: true });
      assert.equal(line.length, seg + 1);
      assertDirichletBoundaries(line, p1, p2);
    }
  });

  test('T2.6: Raw coordinate objects {x, y, z} accepted without Vector3 instance requirement', () => {
    const rawP1 = { x: 5, y: 10, z: 15 };
    const rawP2 = { x: 25, y: 30, z: 35 };

    const polyline = generateVibratingEdgePolyline(rawP1, rawP2, 0.1, {
      segments: 8,
      isVibrating: true
    });

    assert.equal(polyline.length, 9);
    assertDirichletBoundaries(polyline, rawP1, rawP2);
  });
});
