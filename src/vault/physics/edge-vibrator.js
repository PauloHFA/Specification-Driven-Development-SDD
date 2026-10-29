/**
 * @file src/vault/physics/edge-vibrator.js
 * @description Dynamic Transverse Standing Wave & Dual-Axis Lissajous Polyline Generator for graph edges.
 * Implements strict Dirichlet fixed-endpoint boundary conditions, preventing visual cable detachment.
 * Deterministic harmonic jitter eliminates test flakiness while creating vivid mechanical resonance.
 * Pure ESM, zero external dependencies. Node.js >= 18.
 */

import { Vector3 } from '../math/vector3.js';

/**
 * Generates an array of 3D polyline vertices for an edge.
 *
 * @param {Vector3|{x:number, y:number, z:number}} p1 - Source node position
 * @param {Vector3|{x:number, y:number, z:number}} p2 - Target node position
 * @param {number} timeSec - Current elapsed simulation time in seconds
 * @param {Object} [options={}]
 * @param {number} [options.segments=16] - Polyline subdivision segment count (returns segments + 1 vertices)
 * @param {number} [options.amplitude=0.8] - Peak transverse vibration amplitude
 * @param {number} [options.frequency=12.0] - Primary oscillation frequency in Hz
 * @param {boolean} [options.isVibrating=false] - Whether edge is undergoing circular/error vibration
 * @param {boolean} [options.minimalStraight=false] - If true and !isVibrating, returns [p1, p2] (length 2)
 * @returns {Vector3[]}
 */
export function generateVibratingEdgePolyline(p1, p2, timeSec = 0, options = {}) {
  const segments = Math.max(1, Math.floor(options.segments ?? 16));
  const isVibrating = Boolean(options.isVibrating);
  const minimalStraight = Boolean(options.minimalStraight);
  const t = Number.isFinite(timeSec) ? Number(timeSec) : 0;

  const v1 = p1 instanceof Vector3 ? p1 : new Vector3(p1?.x ?? 0, p1?.y ?? 0, p1?.z ?? 0);
  const v2 = p2 instanceof Vector3 ? p2 : new Vector3(p2?.x ?? 0, p2?.y ?? 0, p2?.z ?? 0);

  if (!isVibrating && minimalStraight) {
    return [v1.clone(), v2.clone()];
  }

  const rx = v2.x - v1.x;
  const ry = v2.y - v1.y;
  const rz = v2.z - v1.z;
  const len = Math.hypot(rx, ry, rz);

  const vertices = [];

  // Degenerate zero-length edge guard: return identical copies
  if (len < 1e-6) {
    for (let k = 0; k <= segments; k++) {
      vertices.push(v1.clone());
    }
    return vertices;
  }

  // Non-vibrating: return uniform collinear segment vertices
  if (!isVibrating) {
    for (let k = 0; k <= segments; k++) {
      const s = k / segments;
      vertices.push(new Vector3(
        v1.x + s * rx,
        v1.y + s * ry,
        v1.z + s * rz
      ));
    }
    return vertices;
  }

  // Tangent unit vector
  const tx = rx / len;
  const ty = ry / len;
  const tz = rz / len;

  // Singularity-free reference vector (avoiding parallel cross product)
  let upX = 0, upY = 1, upZ = 0;
  if (Math.abs(ty) > 0.95) {
    upX = 1; upY = 0; upZ = 0;
  }

  // Normal unit vector: t x up
  let nx = ty * upZ - tz * upY;
  let ny = tz * upX - tx * upZ;
  let nz = tx * upY - ty * upX;
  const nLen = Math.hypot(nx, ny, nz) || 1e-6;
  nx /= nLen;
  ny /= nLen;
  nz /= nLen;

  // Binormal unit vector: t x n
  const bx = ty * nz - tz * ny;
  const by = tz * nx - tx * nz;
  const bz = tx * ny - ty * nx;

  // Frequencies and temporal oscillators
  const amp = Number.isFinite(options.amplitude) ? Number(options.amplitude) : 0.8;
  const freq = Number.isFinite(options.frequency) ? Number(options.frequency) : 12.0;

  const w1 = 2 * Math.PI * freq * t;
  const w2 = 2 * Math.PI * (freq * 1.336) * t;

  const oscN = amp * Math.sin(w1);
  const oscB = (amp * 0.7) * Math.cos(w2 + 0.4);

  const jitterAmp = 0.15 * amp;
  const jitN = jitterAmp * Math.sin(73.13 * t);
  const jitB = jitterAmp * Math.cos(91.37 * t);

  const dispAxisN = oscN + jitN;
  const dispAxisB = oscB + jitB;

  for (let k = 0; k <= segments; k++) {
    const s = k / segments;
    // Strict Dirichlet boundary condition: envelope(0) = envelope(1) = 0
    const envelope = Math.sin(Math.PI * s);
    const dispN = envelope * dispAxisN;
    const dispB = envelope * dispAxisB;

    vertices.push(new Vector3(
      v1.x + s * rx + dispN * nx + dispB * bx,
      v1.y + s * ry + dispN * ny + dispB * by,
      v1.z + s * rz + dispN * nz + dispB * bz
    ));
  }

  return vertices;
}
