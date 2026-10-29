/**
 * @file src/vault/math/vector3.js
 * @description Pure ESM 3D Continuous Vector Arithmetic Primitive.
 * Zero external dependencies. Numerical stability guarded with defensive division and finite checks.
 * Conforms to Node.js >= 18 pure ES Modules.
 */

/**
 * Clamps a numerical value between min and max bounds.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  const num = Number.isFinite(val) ? Number(val) : 0;
  return Math.max(min, Math.min(max, num));
}

/**
 * Linearly interpolates between scalar start and end by alpha.
 * @param {number} start
 * @param {number} end
 * @param {number} alpha
 * @returns {number}
 */
export function lerp(start, end, alpha) {
  const s = Number.isFinite(start) ? Number(start) : 0;
  const e = Number.isFinite(end) ? Number(end) : 0;
  const a = Number.isFinite(alpha) ? Number(alpha) : 0;
  return s + (e - s) * a;
}

/**
 * Class representing a 3D Euclidean vector in continuous space.
 */
export class Vector3 {
  /**
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [z=0]
   */
  constructor(x = 0, y = 0, z = 0) {
    this.x = Number.isFinite(x) ? Number(x) : 0;
    this.y = Number.isFinite(y) ? Number(y) : 0;
    this.z = Number.isFinite(z) ? Number(z) : 0;
  }

  /**
   * Sets components in-place.
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [z=0]
   * @returns {this}
   */
  set(x = 0, y = 0, z = 0) {
    this.x = Number.isFinite(x) ? Number(x) : 0;
    this.y = Number.isFinite(y) ? Number(y) : 0;
    this.z = Number.isFinite(z) ? Number(z) : 0;
    return this;
  }

  /**
   * Creates a new Vector3 instance with identical coordinates.
   * @returns {Vector3}
   */
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  /**
   * Copies coordinates from another vector or object.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @returns {this}
   */
  copy(v) {
    if (!v) return this.set(0, 0, 0);
    this.x = Number.isFinite(v.x) ? Number(v.x) : 0;
    this.y = Number.isFinite(v.y) ? Number(v.y) : 0;
    this.z = Number.isFinite(v.z) ? Number(v.z) : 0;
    return this;
  }

  /**
   * Adds another vector to this vector in-place.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @returns {this}
   */
  add(v) {
    if (v) {
      this.x += Number.isFinite(v.x) ? Number(v.x) : 0;
      this.y += Number.isFinite(v.y) ? Number(v.y) : 0;
      this.z += Number.isFinite(v.z) ? Number(v.z) : 0;
    }
    return this;
  }

  /**
   * Subtracts another vector from this vector in-place.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @returns {this}
   */
  sub(v) {
    if (v) {
      this.x -= Number.isFinite(v.x) ? Number(v.x) : 0;
      this.y -= Number.isFinite(v.y) ? Number(v.y) : 0;
      this.z -= Number.isFinite(v.z) ? Number(v.z) : 0;
    }
    return this;
  }

  /**
   * Sets this vector to a + b.
   * @param {Vector3|{x?: number, y?: number, z?: number}} a
   * @param {Vector3|{x?: number, y?: number, z?: number}} b
   * @returns {this}
   */
  addVectors(a, b) {
    const ax = Number.isFinite(a?.x) ? Number(a.x) : 0;
    const ay = Number.isFinite(a?.y) ? Number(a.y) : 0;
    const az = Number.isFinite(a?.z) ? Number(a.z) : 0;

    const bx = Number.isFinite(b?.x) ? Number(b.x) : 0;
    const by = Number.isFinite(b?.y) ? Number(b.y) : 0;
    const bz = Number.isFinite(b?.z) ? Number(b.z) : 0;

    this.x = ax + bx;
    this.y = ay + by;
    this.z = az + bz;
    return this;
  }

  /**
   * Sets this vector to a - b.
   * @param {Vector3|{x?: number, y?: number, z?: number}} a
   * @param {Vector3|{x?: number, y?: number, z?: number}} b
   * @returns {this}
   */
  subVectors(a, b) {
    const ax = Number.isFinite(a?.x) ? Number(a.x) : 0;
    const ay = Number.isFinite(a?.y) ? Number(a.y) : 0;
    const az = Number.isFinite(a?.z) ? Number(a.z) : 0;

    const bx = Number.isFinite(b?.x) ? Number(b.x) : 0;
    const by = Number.isFinite(b?.y) ? Number(b.y) : 0;
    const bz = Number.isFinite(b?.z) ? Number(b.z) : 0;

    this.x = ax - bx;
    this.y = ay - by;
    this.z = az - bz;
    return this;
  }

  /**
   * Multiplies components by scalar s.
   * @param {number} s
   * @returns {this}
   */
  multiplyScalar(s) {
    const num = Number(s);
    if (!Number.isFinite(num)) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      return this;
    }
    this.x *= num;
    this.y *= num;
    this.z *= num;
    return this;
  }

  /**
   * Divides components by scalar s, guarded against zero division or non-finite inputs.
   * @param {number} s
   * @returns {this}
   */
  divideScalar(s) {
    const num = Number(s);
    if (!Number.isFinite(num) || Math.abs(num) < 1e-12) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      return this;
    }
    const inv = 1 / num;
    this.x *= inv;
    this.y *= inv;
    this.z *= inv;
    return this;
  }

  /**
   * Computes algebraic dot product with v.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @returns {number}
   */
  dot(v) {
    if (!v) return 0;
    const vx = Number.isFinite(v.x) ? Number(v.x) : 0;
    const vy = Number.isFinite(v.y) ? Number(v.y) : 0;
    const vz = Number.isFinite(v.z) ? Number(v.z) : 0;
    return this.x * vx + this.y * vy + this.z * vz;
  }

  /**
   * Computes cross product this x v in-place.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @returns {this}
   */
  cross(v) {
    return this.crossVectors(this, v);
  }

  /**
   * Sets this vector to cross product a x b.
   * @param {Vector3|{x?: number, y?: number, z?: number}} a
   * @param {Vector3|{x?: number, y?: number, z?: number}} b
   * @returns {this}
   */
  crossVectors(a, b) {
    const ax = Number.isFinite(a?.x) ? Number(a.x) : 0;
    const ay = Number.isFinite(a?.y) ? Number(a.y) : 0;
    const az = Number.isFinite(a?.z) ? Number(a.z) : 0;

    const bx = Number.isFinite(b?.x) ? Number(b.x) : 0;
    const by = Number.isFinite(b?.y) ? Number(b.y) : 0;
    const bz = Number.isFinite(b?.z) ? Number(b.z) : 0;

    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  /**
   * Returns squared Euclidean length.
   * @returns {number}
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * Returns Euclidean length using Math.hypot to prevent overflow/underflow.
   * @returns {number}
   */
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  /**
   * Returns squared Euclidean distance to vector v.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @returns {number}
   */
  distanceToSq(v) {
    const vx = Number.isFinite(v?.x) ? Number(v.x) : 0;
    const vy = Number.isFinite(v?.y) ? Number(v.y) : 0;
    const vz = Number.isFinite(v?.z) ? Number(v.z) : 0;

    const dx = this.x - vx;
    const dy = this.y - vy;
    const dz = this.z - vz;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Returns Euclidean distance to vector v.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @returns {number}
   */
  distanceTo(v) {
    const vx = Number.isFinite(v?.x) ? Number(v.x) : 0;
    const vy = Number.isFinite(v?.y) ? Number(v.y) : 0;
    const vz = Number.isFinite(v?.z) ? Number(v.z) : 0;

    return Math.hypot(this.x - vx, this.y - vy, this.z - vz);
  }

  /**
   * Normalizes this vector to unit length in-place.
   * If length < 1e-12, sets to (0,0,0).
   * @returns {this}
   */
  normalize() {
    const len = this.length();
    if (len < 1e-12) {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      return this;
    }
    return this.divideScalar(len);
  }

  /**
   * Linearly interpolates towards vector v by alpha in-place.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @param {number} alpha
   * @returns {this}
   */
  lerp(v, alpha) {
    const a = Number.isFinite(alpha) ? Number(alpha) : 0;
    const vx = Number.isFinite(v?.x) ? Number(v.x) : 0;
    const vy = Number.isFinite(v?.y) ? Number(v.y) : 0;
    const vz = Number.isFinite(v?.z) ? Number(v.z) : 0;

    this.x += (vx - this.x) * a;
    this.y += (vy - this.y) * a;
    this.z += (vz - this.z) * a;
    return this;
  }

  /**
   * Sets this vector to lerp between v1 and v2 by alpha.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v1
   * @param {Vector3|{x?: number, y?: number, z?: number}} v2
   * @param {number} alpha
   * @returns {this}
   */
  lerpVectors(v1, v2, alpha) {
    const a = Number.isFinite(alpha) ? Number(alpha) : 0;
    const x1 = Number.isFinite(v1?.x) ? Number(v1.x) : 0;
    const y1 = Number.isFinite(v1?.y) ? Number(v1.y) : 0;
    const z1 = Number.isFinite(v1?.z) ? Number(v1.z) : 0;

    const x2 = Number.isFinite(v2?.x) ? Number(v2.x) : 0;
    const y2 = Number.isFinite(v2?.y) ? Number(v2.y) : 0;
    const z2 = Number.isFinite(v2?.z) ? Number(v2.z) : 0;

    this.x = x1 + (x2 - x1) * a;
    this.y = y1 + (y2 - y1) * a;
    this.z = z1 + (z2 - z1) * a;
    return this;
  }

  /**
   * Computes the angle in radians between this vector and v.
   * Cosine is clamped to [-1, 1] to guard against Math.acos NaN.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @returns {number}
   */
  angleTo(v) {
    const vLen = v?.length ? v.length() : Math.hypot(v?.x || 0, v?.y || 0, v?.z || 0);
    const lenProduct = this.length() * vLen;
    if (lenProduct < 1e-12) return 0;

    const cosVal = this.dot(v) / lenProduct;
    return Math.acos(clamp(cosVal, -1, 1));
  }

  /**
   * Clamps vector components between min and max bounds.
   * @param {number|Vector3|{x?: number, y?: number, z?: number}} min
   * @param {number|Vector3|{x?: number, y?: number, z?: number}} max
   * @returns {this}
   */
  clamp(min, max) {
    const minX = typeof min === 'number' ? min : (Number.isFinite(min?.x) ? Number(min.x) : -Infinity);
    const minY = typeof min === 'number' ? min : (Number.isFinite(min?.y) ? Number(min.y) : -Infinity);
    const minZ = typeof min === 'number' ? min : (Number.isFinite(min?.z) ? Number(min.z) : -Infinity);

    const maxX = typeof max === 'number' ? max : (Number.isFinite(max?.x) ? Number(max.x) : Infinity);
    const maxY = typeof max === 'number' ? max : (Number.isFinite(max?.y) ? Number(max.y) : Infinity);
    const maxZ = typeof max === 'number' ? max : (Number.isFinite(max?.z) ? Number(max.z) : Infinity);

    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
    this.z = Math.max(minZ, Math.min(maxZ, this.z));
    return this;
  }

  /**
   * Negates all components in-place.
   * @returns {this}
   */
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  /**
   * Tests equality with tolerance epsilon.
   * @param {Vector3|{x?: number, y?: number, z?: number}} v
   * @param {number} [epsilon=1e-6]
   * @returns {boolean}
   */
  equals(v, epsilon = 1e-6) {
    if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number' || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) return false;
    const eps = Number.isFinite(epsilon) ? Math.max(0, epsilon) : 1e-6;

    return (
      Math.abs(this.x - v.x) <= eps &&
      Math.abs(this.y - v.y) <= eps &&
      Math.abs(this.z - v.z) <= eps
    );
  }

  /**
   * Serializes vector to an array [x, y, z].
   * @param {number[]} [array=[]]
   * @param {number} [offset=0]
   * @returns {number[]}
   */
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    return array;
  }

  /**
   * Creates a Vector3 instance from an array [x, y, z].
   * @param {number[]} arr
   * @param {number} [offset=0]
   * @returns {Vector3}
   */
  static fromArray(arr, offset = 0) {
    if (!Array.isArray(arr)) return new Vector3(0, 0, 0);
    return new Vector3(
      arr[offset] ?? 0,
      arr[offset + 1] ?? 0,
      arr[offset + 2] ?? 0
    );
  }
}
