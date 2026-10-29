/**
 * @file test/vault/vector3.test.js
 * @description Comprehensive automated tests for Vector3 3D math primitive.
 * Covers Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases).
 * Zero external dependencies, pure node:test.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, clamp, lerp } from '../../src/vault/math/vector3.js';
import { assertVector3Close, assertIsUnitVector } from './test-helpers.js';

describe('F1: Vector3 Primitive — Tier 1 Feature Coverage', () => {
  test('T1.1: Vector arithmetic (add, sub, multiplyScalar, divideScalar, in-place chaining)', () => {
    const v1 = new Vector3(1, 2, 3);
    const v2 = new Vector3(4, 5, 6);

    // In-place addition
    const addResult = v1.add(v2);
    assert.equal(addResult, v1, 'add() should return this for chaining');
    assertVector3Close(v1, [5, 7, 9]);

    // In-place subtraction
    v1.sub(new Vector3(2, 3, 4));
    assertVector3Close(v1, [3, 4, 5]);

    // Scalar multiplication
    v1.multiplyScalar(2);
    assertVector3Close(v1, [6, 8, 10]);

    // Scalar division
    v1.divideScalar(2);
    assertVector3Close(v1, [3, 4, 5]);

    // addVectors / subVectors without mutating operands
    const va = new Vector3(10, 20, 30);
    const vb = new Vector3(1, 2, 3);
    const vc = new Vector3().addVectors(va, vb);
    assertVector3Close(vc, [11, 22, 33]);
    assertVector3Close(va, [10, 20, 30], 1e-6, 'Operand va must remain unmodified');

    const vd = new Vector3().subVectors(va, vb);
    assertVector3Close(vd, [9, 18, 27]);
  });

  test('T1.2: Length, squared length and normalization', () => {
    const v = new Vector3(3, 4, 0);
    assert.equal(v.lengthSq(), 25);
    assert.equal(v.length(), 5);

    const ized = v.normalize();
    assert.equal(ized, v, 'normalize() should return this for chaining');
    assertVector3Close(v, [0.6, 0.8, 0]);
    assertIsUnitVector(v);

    // 3D diagonal vector length
    const diag = new Vector3(2, 3, 6);
    assert.equal(diag.length(), 7); // sqrt(4 + 9 + 36) = sqrt(49) = 7
    diag.normalize();
    assertIsUnitVector(diag);
  });

  test('T1.3: Dot product properties (orthogonality, parallelism, sign)', () => {
    const vx = new Vector3(1, 0, 0);
    const vy = new Vector3(0, 1, 0);
    const vz = new Vector3(0, 0, 1);

    // Orthogonal unit vectors
    assert.equal(vx.dot(vy), 0, 'Orthogonal vectors dot product must be 0');
    assert.equal(vx.dot(vz), 0);
    assert.equal(vy.dot(vz), 0);

    // Parallel unit vectors
    assert.equal(vx.dot(vx), 1, 'Parallel identical unit vectors dot product must be 1');

    // Anti-parallel
    const negVx = new Vector3(-1, 0, 0);
    assert.equal(vx.dot(negVx), -1, 'Anti-parallel unit vectors dot product must be -1');

    // General dot product: a . b = ax*bx + ay*by + az*bz
    const a = new Vector3(1, 2, 3);
    const b = new Vector3(4, -5, 6);
    // 1*4 + 2*(-5) + 3*6 = 4 - 10 + 18 = 12
    assert.equal(a.dot(b), 12);
  });

  test('T1.4: Cross product right-hand rule and anti-commutativity', () => {
    const vx = new Vector3(1, 0, 0);
    const vy = new Vector3(0, 1, 0);

    // x cross y = z
    const vz = new Vector3().crossVectors(vx, vy);
    assertVector3Close(vz, [0, 0, 1], 1e-6, 'x cross y must equal z');

    // y cross x = -z (anti-commutativity)
    const negVz = new Vector3().crossVectors(vy, vx);
    assertVector3Close(negVz, [0, 0, -1], 1e-6, 'y cross x must equal -z');

    // In-place cross
    const v = new Vector3(1, 0, 0);
    v.cross(new Vector3(0, 1, 0));
    assertVector3Close(v, [0, 0, 1]);

    // Cross product with self is zero vector
    const selfCross = new Vector3().crossVectors(v, v);
    assertVector3Close(selfCross, [0, 0, 0]);
  });

  test('T1.5: Euclidean distanceTo and squared distanceToSq', () => {
    const p1 = new Vector3(1, 2, 3);
    const p2 = new Vector3(4, 6, 3);

    // 2D sub-distance in XY: dx=3, dy=4, dz=0 -> dist=5, distSq=25
    assert.equal(p1.distanceToSq(p2), 25);
    assert.equal(p1.distanceTo(p2), 5);
    assert.equal(p2.distanceTo(p1), 5, 'Distance must be symmetric');

    // 3D distance
    const p3 = new Vector3(0, 0, 0);
    const p4 = new Vector3(2, 3, 6);
    assert.equal(p3.distanceTo(p4), 7);
  });

  test('T1.6: Linear interpolation (lerp, lerpVectors, scalar lerp)', () => {
    const start = new Vector3(0, 0, 0);
    const end = new Vector3(10, 20, 30);

    // In-place lerp alpha=0
    const v = start.clone().lerp(end, 0.0);
    assertVector3Close(v, [0, 0, 0]);

    // alpha=0.5
    v.lerp(end, 0.5);
    assertVector3Close(v, [5, 10, 15]);

    // alpha=1.0
    v.lerp(end, 1.0);
    assertVector3Close(v, [10, 20, 30]);

    // lerpVectors
    const res = new Vector3().lerpVectors(new Vector3(0, 0, 0), new Vector3(100, 200, 300), 0.25);
    assertVector3Close(res, [25, 50, 75]);

    // Standalone scalar lerp helper
    assert.equal(lerp(10, 20, 0.5), 15);
    assert.equal(lerp(0, 100, 0.2), 20);
  });
});

describe('F1: Vector3 Primitive — Tier 2 Boundary & Corner Cases', () => {
  test('T2.1: Zero vector safety (division by zero guard, zero length normalization)', () => {
    const zero = new Vector3(0, 0, 0);

    // Length of zero vector
    assert.equal(zero.length(), 0);
    assert.equal(zero.lengthSq(), 0);

    // Normalizing a zero vector must NOT produce NaN or Infinity; must reset to (0,0,0)
    zero.normalize();
    assert.ok(!Number.isNaN(zero.x) && !Number.isNaN(zero.y) && !Number.isNaN(zero.z), 'No NaN on normalize(zero)');
    assertVector3Close(zero, [0, 0, 0]);

    // Dividing any vector by zero must NOT produce Infinity or NaN; must reset to (0,0,0)
    const v = new Vector3(10, 20, 30);
    v.divideScalar(0);
    assert.ok(!Number.isNaN(v.x) && Number.isFinite(v.x), 'Division by zero must be finite');
    assertVector3Close(v, [0, 0, 0], 1e-6, 'Division by zero resets to (0,0,0)');

    // Dividing by extremely tiny number < 1e-12 (near-zero singularity)
    const vTiny = new Vector3(5, 5, 5);
    vTiny.divideScalar(1e-13);
    assertVector3Close(vTiny, [0, 0, 0], 1e-6, 'Division by sub-epsilon (<1e-12) resets to (0,0,0)');
  });

  test('T2.2: Collinear and anti-collinear vectors (angleTo limits and acos NaN prevention)', () => {
    const v1 = new Vector3(1, 0, 0);
    const v2 = new Vector3(10, 0, 0); // parallel collinear
    const v3 = new Vector3(-5, 0, 0); // anti-parallel collinear

    // Angle to parallel vector must be 0
    const angleParallel = v1.angleTo(v2);
    assert.ok(Math.abs(angleParallel - 0) < 1e-6, `Angle to parallel should be 0, got ${angleParallel}`);

    // Angle to anti-parallel vector must be PI
    const angleAnti = v1.angleTo(v3);
    assert.ok(Math.abs(angleAnti - Math.PI) < 1e-6, `Angle to anti-parallel should be PI, got ${angleAnti}`);

    // Angle with identical vector where floating-point dot / (len*len) could slightly exceed 1.0
    const vSame = new Vector3(1.0000000000000002, 0, 0);
    const angleSame = vSame.angleTo(vSame);
    assert.ok(!Number.isNaN(angleSame), 'angleTo must not produce NaN on floating point boundary');
    assert.equal(angleSame, 0);

    // Angle with zero vector returns 0 without crashing
    const zero = new Vector3(0, 0, 0);
    assert.equal(v1.angleTo(zero), 0, 'angleTo(zero) must return 0');
  });

  test('T2.3: Tiny numbers (1e-15) and floating-point subnormal stability', () => {
    const tiny = new Vector3(1e-15, 2e-15, 2e-15);
    assert.ok(tiny.length() > 0, 'Tiny vector length must be strictly positive');
    assert.ok(Number.isFinite(tiny.length()));

    // Normalizing tiny vector (< 1e-12 length guard resets to zero)
    tiny.normalize();
    assert.ok(Number.isFinite(tiny.x) && Number.isFinite(tiny.y) && Number.isFinite(tiny.z));
    assertVector3Close(tiny, [0, 0, 0]);
  });

  test('T2.4: Large numbers (1e150) — hypot prevents intermediate IEEE 754 overflow', () => {
    const large = new Vector3(3e150, 4e150, 0);
    const len = large.length();
    assert.ok(Number.isFinite(len), 'Length of 1e150 vector must be finite');
    assert.ok(Math.abs(len - 5e150) / 5e150 < 1e-10, `Expected 5e150, got ${len}`);

    // Normalization of large vector
    large.normalize();
    assertIsUnitVector(large);
    assertVector3Close(large, [0.6, 0.8, 0]);
  });

  test('T2.5: Component clamping and standalone clamp() utility', () => {
    const v = new Vector3(-10, 50, 150);
    v.clamp(new Vector3(0, 0, 0), new Vector3(100, 100, 100));
    assertVector3Close(v, [0, 50, 100]);

    // Scalar bounds
    const v2 = new Vector3(-5, 12, 20);
    v2.clamp(0, 10);
    assertVector3Close(v2, [0, 10, 10]);

    // Standalone clamp utility
    assert.equal(clamp(50, 0, 100), 50);
    assert.equal(clamp(-10, 0, 100), 0);
    assert.equal(clamp(150, 0, 100), 100);
    assert.equal(clamp(NaN, 0, 100), 0, 'NaN input to clamp() defaults safely');
  });

  test('T2.6: Array serialization (toArray, fromArray) with arbitrary offsets', () => {
    const v = new Vector3(7, 8, 9);
    const arr = [0, 0, 0, 0, 0, 0];
    v.toArray(arr, 2);
    assert.deepEqual(arr, [0, 0, 7, 8, 9, 0]);

    const reconstructed = Vector3.fromArray(arr, 2);
    assertVector3Close(reconstructed, [7, 8, 9]);

    // Corrupted or missing array
    const empty = Vector3.fromArray(null);
    assertVector3Close(empty, [0, 0, 0]);

    const shortArr = Vector3.fromArray([42]);
    assertVector3Close(shortArr, [42, 0, 0]);
  });

  test('T2.7: Immutability of clone() and negation', () => {
    const original = new Vector3(1, -2, 3);
    const cloned = original.clone();
    assertVector3Close(cloned, [1, -2, 3]);

    cloned.x = 999;
    assert.equal(original.x, 1, 'Modifying clone must not alter original instance');

    original.negate();
    assertVector3Close(original, [-1, 2, -3]);
  });

  test('T2.8: Robust non-finite input sanitization', () => {
    const v = new Vector3(NaN, Infinity, -Infinity);
    assert.equal(v.x, 0, 'NaN coerced to 0');
    assert.equal(v.y, 0, 'Infinity coerced to 0');
    assert.equal(v.z, 0, '-Infinity coerced to 0');

    v.set('invalid', undefined, null);
    assert.equal(v.x, 0);
    assert.equal(v.y, 0);
    assert.equal(v.z, 0);

    v.multiplyScalar(NaN);
    assertVector3Close(v, [0, 0, 0]);
  });

  test('T2.9: Strict equality evaluation with defensive object validation', () => {
    const v = new Vector3(0, 0, 0);
    // Non-Vector3, null, undefined, empty object
    assert.equal(v.equals(null), false);
    assert.equal(v.equals(undefined), false);
    assert.equal(v.equals({}), false);
    assert.equal(v.equals({ x: 0 }), false);
    assert.equal(v.equals({ x: 0, y: 0 }), false);
    assert.equal(v.equals({ x: 0, y: 0, z: NaN }), false);
    assert.equal(v.equals({ x: 0, y: 0, z: Infinity }), false);
    assert.equal(v.equals('string'), false);
    assert.equal(v.equals(123), false);

    // Valid equals
    const vIdentical = new Vector3(0, 0, 0);
    assert.equal(v.equals(vIdentical), true);

    const vDiff = new Vector3(0, 0, 0.001);
    assert.equal(v.equals(vDiff), false);
    assert.equal(v.equals(vDiff, 0.01), true);
  });
});
