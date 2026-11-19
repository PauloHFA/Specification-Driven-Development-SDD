/**
 * @file src/vault/public/vendor/three.module.js
 * @description Lightweight, self-contained offline ESM 3D engine providing standard Three.js API.
 * Renders 3D node spheres, elastic lines, vibrating standing-wave cables, and billboard sprites
 * directly via standard WebGL. Zero internet access or external CDN dependencies required.
 * Pure ESM. Runs 100% offline in modern browsers.
 */

// --- Math Primitives ---

export const MathUtils = {
  degToRad(deg) { return deg * (Math.PI / 180); },
  radToDeg(rad) { return rad * (180 / Math.PI); },
  clamp(val, min, max) { return Math.max(min, Math.min(max, val)); },
  lerp(x, y, t) { return (1 - t) * x + t * y; },
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) { this.x = x; this.y = y; return this; }
  clone() { return new Vector2(this.x, this.y); }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  divideScalar(s) { return this.multiplyScalar(1 / (s || 1)); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x; this.y = y; this.z = z;
    return this;
  }
  crossVectors(a, b) {
    const x = a.y * b.z - a.z * b.y;
    const y = a.z * b.x - a.x * b.z;
    const z = a.x * b.y - a.y * b.x;
    this.x = x; this.y = y; this.z = z;
    return this;
  }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  normalize() {
    const len = this.length();
    return len > 0 ? this.multiplyScalar(1 / len) : this;
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  lerpVectors(v1, v2, alpha) {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    return this;
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    return array;
  }
}

export class Color {
  constructor(r = 1, g = 1, b = 1) {
    this.r = 1;
    this.g = 1;
    this.b = 1;
    if (typeof r === 'string' || typeof r === 'number') {
      this.set(r);
    } else {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }
  set(val) {
    if (typeof val === 'number') {
      return this.setHex(val);
    }
    if (typeof val === 'string') {
      return this.setStyle(val);
    }
    if (val && typeof val.r === 'number') {
      this.r = val.r; this.g = val.g; this.b = val.b;
      return this;
    }
    return this;
  }
  setHex(hex) {
    const h = Math.floor(hex);
    this.r = ((h >> 16) & 255) / 255;
    this.g = ((h >> 8) & 255) / 255;
    this.b = (h & 255) / 255;
    return this;
  }
  setStyle(style) {
    if (style.startsWith('#')) {
      let hex = style.slice(1);
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      return this.setHex(parseInt(hex, 16));
    }
    const m = style.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (m) {
      this.r = parseInt(m[1], 10) / 255;
      this.g = parseInt(m[2], 10) / 255;
      this.b = parseInt(m[3], 10) / 255;
      return this;
    }
    return this;
  }
  getHexString() {
    const h = ((this.r * 255) << 16) ^ ((this.g * 255) << 8) ^ ((this.b * 255) << 0);
    return ('000000' + h.toString(16)).slice(-6);
  }
  clone() { return new Color(this.r, this.g, this.b); }
  copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
}

export class Matrix4 {
  constructor() {
    this.elements = new Float32Array(16);
    this.identity();
  }
  identity() {
    const e = this.elements;
    e[0] = 1; e[4] = 0; e[8] = 0; e[12] = 0;
    e[1] = 0; e[5] = 1; e[9] = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
  }
  copy(m) {
    this.elements.set(m.elements);
    return this;
  }
  clone() {
    const m = new Matrix4();
    m.copy(this);
    return m;
  }
  makePerspective(left, right, top, bottom, near, far) {
    const e = this.elements;
    const x = (2 * near) / (right - left);
    const y = (2 * near) / (top - bottom);
    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    const c = -(far + near) / (far - near);
    const d = -(2 * far * near) / (far - near);

    e[0] = x;  e[4] = 0;  e[8] = a;   e[12] = 0;
    e[1] = 0;  e[5] = y;  e[9] = b;   e[13] = 0;
    e[2] = 0;  e[6] = 0;  e[10] = c;  e[14] = d;
    e[3] = 0;  e[7] = 0;  e[11] = -1; e[15] = 0;
    return this;
  }
  perspective(fovYDeg, aspect, near, far) {
    const top = near * Math.tan(MathUtils.degToRad(fovYDeg) * 0.5);
    const bottom = -top;
    const left = bottom * aspect;
    const right = top * aspect;
    return this.makePerspective(left, right, top, bottom, near, far);
  }
  lookAt(eye, target, up) {
    const e = this.elements;
    const z = new Vector3().subVectors(eye, target).normalize();
    if (z.lengthSq() === 0) z.z = 1;
    const x = new Vector3().crossVectors(up, z).normalize();
    if (x.lengthSq() === 0) {
      z.x += 0.0001;
      x.crossVectors(up, z).normalize();
    }
    const y = new Vector3().crossVectors(z, x);

    e[0] = x.x; e[4] = x.y; e[8] = x.z;  e[12] = -x.dot(eye);
    e[1] = y.x; e[5] = y.y; e[9] = y.z;  e[13] = -y.dot(eye);
    e[2] = z.x; e[6] = z.y; e[10] = z.z; e[14] = -z.dot(eye);
    e[3] = 0;   e[7] = 0;   e[11] = 0;   e[15] = 1;
    return this;
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;

    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    return this;
  }
  compose(position, quaternion, scale) {
    const te = this.elements;
    const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    const sx = scale.x, sy = scale.y, sz = scale.z;

    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;

    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;

    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;

    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;

    return this;
  }
  invert() {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3];
    const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7];
    const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11];
    const n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15];

    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0) return this.identity();

    const detInv = 1 / det;
    te[0] = t11 * detInv;
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;

    te[4] = t12 * detInv;
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;

    te[8] = t13 * detInv;
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;

    te[12] = t14 * detInv;
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;

    return this;
  }
}

export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x; this.y = y; this.z = z; this.w = w;
  }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  identity() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; return this; }
  copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
}

export class Euler {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

// --- Geometries & Buffers ---

export class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array ? array.length / itemSize : 0;
    this.needsUpdate = false;
    this.version = 0;
  }
  setXYZ(index, x, y, z) {
    const i = index * this.itemSize;
    this.array[i] = x;
    this.array[i + 1] = y;
    this.array[i + 2] = z;
    this.needsUpdate = true;
    return this;
  }
}

export class Float32BufferAttribute extends BufferAttribute {
  constructor(array, itemSize) {
    super(array instanceof Float32Array ? array : new Float32Array(array), itemSize);
  }
}

export class BufferGeometry {
  constructor() {
    this.attributes = {};
    this.index = null;
  }
  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  setIndex(index) {
    this.index = Array.isArray(index) ? new Uint16Array(index) : index;
    return this;
  }
  setFromPoints(points) {
    const position = [];
    for (const p of points) {
      position.push(p.x, p.y, p.z);
    }
    this.setAttribute('position', new Float32BufferAttribute(position, 3));
    return this;
  }
  dispose() {}
}

export class SphereGeometry extends BufferGeometry {
  constructor(radius = 1, widthSegments = 16, heightSegments = 12) {
    super();
    this.radius = radius;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let iy = 0; iy <= heightSegments; iy++) {
      const v = iy / heightSegments;
      const uOffset = iy === 0 ? 0.5 / widthSegments : (iy === heightSegments ? -0.5 / widthSegments : 0);
      const theta = v * Math.PI;

      for (let ix = 0; ix <= widthSegments; ix++) {
        const u = ix / widthSegments;
        const phi = u * Math.PI * 2;

        const x = -radius * Math.cos(phi) * Math.sin(theta);
        const y = radius * Math.cos(theta);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        positions.push(x, y, z);
        normals.push(x / radius, y / radius, z / radius);
        uvs.push(u + uOffset, 1 - v);
      }
    }

    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = iy * (widthSegments + 1) + ix;
        const b = (iy + 1) * (widthSegments + 1) + ix;
        const c = (iy + 1) * (widthSegments + 1) + (ix + 1);
        const d = iy * (widthSegments + 1) + (ix + 1);

        if (iy !== 0) indices.push(a, b, d);
        if (iy !== heightSegments - 1) indices.push(b, c, d);
      }
    }

    this.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    this.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    this.setIndex(indices);
  }
}

// --- Materials ---

export class Material {
  constructor(params = {}) {
    this.color = new Color(params.color ?? 0xffffff);
    this.opacity = params.opacity ?? 1.0;
    this.transparent = params.transparent ?? false;
    this.depthTest = params.depthTest ?? true;
    this.depthWrite = params.depthWrite ?? true;
    this.wireframe = params.wireframe ?? false;
    this.visible = params.visible ?? true;
  }
  dispose() {}
}

export class MeshBasicMaterial extends Material {
  constructor(params = {}) {
    super(params);
    this.isMeshBasicMaterial = true;
  }
}

export class MeshPhongMaterial extends Material {
  constructor(params = {}) {
    super(params);
    this.isMeshPhongMaterial = true;
    this.shininess = params.shininess ?? 30;
    this.specular = new Color(params.specular ?? 0x222222);
    this.emissive = new Color(params.emissive ?? 0x000000);
  }
}

export class MeshStandardMaterial extends MeshPhongMaterial {
  constructor(params = {}) {
    super(params);
    this.isMeshStandardMaterial = true;
    this.roughness = params.roughness ?? 0.5;
    this.metalness = params.metalness ?? 0.0;
  }
}

export class LineBasicMaterial extends Material {
  constructor(params = {}) {
    super(params);
    this.isLineBasicMaterial = true;
    this.linewidth = params.linewidth ?? 1;
  }
}

export class SpriteMaterial extends Material {
  constructor(params = {}) {
    super(params);
    this.isSpriteMaterial = true;
    this.map = params.map || null;
  }
}

export class CanvasTexture {
  constructor(canvas) {
    this.image = canvas;
    this.needsUpdate = true;
  }
  dispose() {}
}

// --- Scene Graph Objects ---

export class Object3D {
  constructor() {
    this.position = new Vector3();
    this.rotation = new Euler();
    this.scale = new Vector3(1, 1, 1);
    this.quaternion = new Quaternion();
    this.matrix = new Matrix4();
    this.matrixWorld = new Matrix4();
    this.children = [];
    this.parent = null;
    this.visible = true;
    this.userData = {};
  }
  add(child) {
    if (child && child !== this) {
      if (child.parent) child.parent.remove(child);
      child.parent = this;
      this.children.push(child);
    }
    return this;
  }
  remove(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      child.parent = null;
      this.children.splice(idx, 1);
    }
    return this;
  }
  updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
  }
  updateMatrixWorld(force = false) {
    this.updateMatrix();
    if (this.parent === null) {
      this.matrixWorld.copy(this.matrix);
    } else {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    }
    for (const child of this.children) {
      child.updateMatrixWorld(force);
    }
  }
  traverse(callback) {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }
}

export class Scene extends Object3D {
  constructor() {
    super();
    this.background = new Color(0x0a0f1d);
  }
}

export class Group extends Object3D {}

export class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.isMesh = true;
    this.geometry = geometry;
    this.material = material;
  }
}

export class Line extends Object3D {
  constructor(geometry, material) {
    super();
    this.isLine = true;
    this.geometry = geometry;
    this.material = material;
  }
}

export class LineSegments extends Line {
  constructor(geometry, material) {
    super(geometry, material);
    this.isLineSegments = true;
  }
}

export class Sprite extends Object3D {
  constructor(material) {
    super();
    this.isSprite = true;
    this.material = material;
    this.scale.set(1, 1, 1);
  }
}

// --- Lights ---

export class Light extends Object3D {
  constructor(color = 0xffffff, intensity = 1.0) {
    super();
    this.color = new Color(color);
    this.intensity = intensity;
  }
}

export class AmbientLight extends Light {
  constructor(color, intensity) {
    super(color, intensity);
    this.isAmbientLight = true;
  }
}

export class DirectionalLight extends Light {
  constructor(color, intensity) {
    super(color, intensity);
    this.isDirectionalLight = true;
    this.position.set(0, 1, 0);
    this.target = new Object3D();
  }
}

export class PointLight extends Light {
  constructor(color, intensity, distance = 0) {
    super(color, intensity);
    this.isPointLight = true;
    this.distance = distance;
  }
}

// --- Camera ---

export class PerspectiveCamera extends Object3D {
  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    super();
    this.isPerspectiveCamera = true;
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.projectionMatrix = new Matrix4();
    this.projectionMatrixInverse = new Matrix4();
    this.matrixWorldInverse = new Matrix4();
    this.target = new Vector3(0, 0, 0);
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    this.projectionMatrix.perspective(this.fov, this.aspect, this.near, this.far);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
  lookAt(x, y, z) {
    if (x instanceof Vector3) {
      this.target.copy(x);
    } else {
      this.target.set(x, y, z);
    }
    this.matrixWorldInverse.lookAt(this.position, this.target, new Vector3(0, 1, 0));
    this.matrix.copy(this.matrixWorldInverse).invert();
    this.matrixWorld.copy(this.matrix);
  }
}

// --- Raycaster ---

export class Raycaster {
  constructor(origin = new Vector3(), direction = new Vector3(0, 0, -1), near = 0, far = Infinity) {
    this.origin = origin;
    this.direction = direction;
    this.near = near;
    this.far = far;
  }
  setFromCamera(coords2D, camera) {
    // coords2D: normalized device coordinates [-1, 1]
    this.origin.copy(camera.position);
    const ndc = new Vector3(coords2D.x, coords2D.y, 0.5);
    const p = ndc.applyMatrix4(camera.projectionMatrixInverse);
    const dir = new Vector3(p.x, p.y, p.z);
    // Transform direction by camera view orientation
    const viewInv = camera.matrixWorld;
    const e = viewInv.elements;
    const dx = e[0] * dir.x + e[4] * dir.y + e[8] * dir.z;
    const dy = e[1] * dir.x + e[5] * dir.y + e[9] * dir.z;
    const dz = e[2] * dir.x + e[6] * dir.y + e[10] * dir.z;
    this.direction.set(dx, dy, dz).normalize();
  }
  intersectObjects(objects, recursive = true) {
    const intersects = [];
    const check = (obj) => {
      if (!obj.visible) return;
      if (obj.isMesh && obj.geometry && obj.geometry.radius) {
        // Ray vs Sphere intersection test
        const center = new Vector3(obj.matrixWorld.elements[12], obj.matrixWorld.elements[13], obj.matrixWorld.elements[14]);
        const radius = obj.geometry.radius * Math.max(obj.scale.x, obj.scale.y, obj.scale.z);
        const oc = new Vector3().subVectors(this.origin, center);
        const b = oc.dot(this.direction);
        const c = oc.dot(oc) - radius * radius;
        const disc = b * b - c;
        if (disc >= 0) {
          const dist = -b - Math.sqrt(disc);
          if (dist >= this.near && dist <= this.far) {
            const point = this.origin.clone().add(this.direction.clone().multiplyScalar(dist));
            intersects.push({
              distance: dist,
              point,
              object: obj
            });
          }
        }
      }
      if (recursive && obj.children) {
        for (const child of obj.children) check(child);
      }
    };

    for (const obj of objects) check(obj);
    intersects.sort((a, b) => a.distance - b.distance);
    return intersects;
  }
}

// --- WebGL Shader Programs & Renderer ---

const VS_MESH = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
  vec4 mvPosition = uModelViewMatrix * vec4(aPosition, 1.0);
  vViewPosition = -mvPosition.xyz;
  vNormal = normalize(uNormalMatrix * aNormal);
  vUv = aUv;
  gl_Position = uProjectionMatrix * mvPosition;
}
`;

const FS_MESH = `
precision mediump float;

uniform vec3 uColor;
uniform vec3 uEmissive;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uLightDir);
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 diffuse = uLightColor * diff;

  // Specular blinn-phong
  vec3 viewDir = normalize(vViewPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
  vec3 specular = vec3(0.4) * spec;

  vec3 finalColor = uEmissive + uColor * (uAmbientColor + diffuse) + specular;
  gl_FragColor = vec4(finalColor, uOpacity);
}
`;

const VS_LINE = `
attribute vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

void main() {
  gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4(aPosition, 1.0));
}
`;

const FS_LINE = `
precision mediump float;
uniform vec3 uColor;
uniform float uOpacity;

void main() {
  gl_FragColor = vec4(uColor, uOpacity);
}
`;

const VS_SPRITE = `
attribute vec2 aCorner;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec2 uScale;

varying vec2 vUv;

void main() {
  vUv = aCorner * 0.5 + 0.5;
  vec4 mvPos = uModelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mvPos.xy += aCorner * uScale * 0.5;
  gl_Position = uProjectionMatrix * mvPos;
}
`;

const FS_SPRITE = `
precision mediump float;
uniform sampler2D uTexture;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  vec4 tex = texture2D(uTexture, vUv);
  if (tex.a < 0.05) discard;
  gl_FragColor = vec4(tex.rgb, tex.a * uOpacity);
}
`;

function createShader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

export class WebGLRenderer {
  constructor(options = {}) {
    this.domElement = options.canvas || document.createElement('canvas');
    this.antialias = options.antialias ?? true;
    this.alpha = options.alpha ?? true;
    this.gl = this.domElement.getContext('webgl', {
      antialias: this.antialias,
      alpha: this.alpha,
      depth: true
    }) || this.domElement.getContext('experimental-webgl');

    this.clearColor = new Color(0x0a0f1d);
    this.clearAlpha = 1.0;
    this.pixelRatio = 1.0;

    const gl = this.gl;
    if (gl) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      this.meshProg = createProgram(gl, VS_MESH, FS_MESH);
      this.lineProg = createProgram(gl, VS_LINE, FS_LINE);
      this.spriteProg = createProgram(gl, VS_SPRITE, FS_SPRITE);

      // Sprite quad buffer
      this.spriteQuadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteQuadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
      ]), gl.STATIC_DRAW);

      this.textureMap = new WeakMap();
    }
  }

  setPixelRatio(ratio) {
    this.pixelRatio = ratio || 1.0;
  }

  setSize(width, height, updateStyle = false) {
    this.domElement.width = Math.round(width * this.pixelRatio);
    this.domElement.height = Math.round(height * this.pixelRatio);
    if (updateStyle) {
      this.domElement.style.width = width + 'px';
      this.domElement.style.height = height + 'px';
    }
    if (this.gl) {
      this.gl.viewport(0, 0, this.domElement.width, this.domElement.height);
    }
  }

  setClearColor(color, alpha = 1.0) {
    this.clearColor.set(color);
    this.clearAlpha = alpha;
  }

  render(scene, camera) {
    const gl = this.gl;
    if (!gl) return;

    scene.updateMatrixWorld();
    camera.matrixWorldInverse.lookAt(camera.position, camera.target || new Vector3(), new Vector3(0, 1, 0));

    // Clear frame
    const bg = scene.background || this.clearColor;
    gl.clearColor(bg.r, bg.g, bg.b, this.clearAlpha);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const lights = [];
    const meshes = [];
    const lines = [];
    const sprites = [];

    scene.traverse((obj) => {
      if (!obj.visible) return;
      if (obj instanceof Light) lights.push(obj);
      else if (obj.isMesh && obj.geometry) meshes.push(obj);
      else if (obj.isLine && obj.geometry) lines.push(obj);
      else if (obj.isSprite && obj.material) sprites.push(obj);
    });

    // Determine primary lights
    let ambient = new Color(0x334155);
    let dirLightColor = new Color(0xffffff);
    let dirLightDir = new Vector3(0.5, 1.0, 0.8).normalize();

    for (const l of lights) {
      if (l.isAmbientLight) {
        ambient.r = l.color.r * l.intensity;
        ambient.g = l.color.g * l.intensity;
        ambient.b = l.color.b * l.intensity;
      } else if (l.isDirectionalLight) {
        dirLightColor.r = l.color.r * l.intensity;
        dirLightColor.g = l.color.g * l.intensity;
        dirLightColor.b = l.color.b * l.intensity;
        dirLightDir.copy(l.position).normalize();
      }
    }

    // 1. Render Meshes (Spheres)
    if (meshes.length > 0 && this.meshProg) {
      gl.useProgram(this.meshProg);
      const uProj = gl.getUniformLocation(this.meshProg, 'uProjectionMatrix');
      const uMV = gl.getUniformLocation(this.meshProg, 'uModelViewMatrix');
      const uNorm = gl.getUniformLocation(this.meshProg, 'uNormalMatrix');
      const uCol = gl.getUniformLocation(this.meshProg, 'uColor');
      const uEmiss = gl.getUniformLocation(this.meshProg, 'uEmissive');
      const uLDir = gl.getUniformLocation(this.meshProg, 'uLightDir');
      const uLCol = gl.getUniformLocation(this.meshProg, 'uLightColor');
      const uAmb = gl.getUniformLocation(this.meshProg, 'uAmbientColor');
      const uOp = gl.getUniformLocation(this.meshProg, 'uOpacity');

      gl.uniformMatrix4fv(uProj, false, camera.projectionMatrix.elements);
      gl.uniform3f(uLDir, dirLightDir.x, dirLightDir.y, dirLightDir.z);
      gl.uniform3f(uLCol, dirLightColor.r, dirLightColor.g, dirLightColor.b);
      gl.uniform3f(uAmb, ambient.r, ambient.g, ambient.b);

      for (const mesh of meshes) {
        const mat = mesh.material || {};
        const col = mat.color || new Color(1, 1, 1);
        const emiss = mat.emissive || new Color(0, 0, 0);
        gl.uniform3f(uCol, col.r, col.g, col.b);
        gl.uniform3f(uEmiss, emiss.r, emiss.g, emiss.b);
        gl.uniform1f(uOp, mat.opacity ?? 1.0);

        const mv = new Matrix4().multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
        gl.uniformMatrix4fv(uMV, false, mv.elements);

        // Approximate normal matrix
        const nm = new Float32Array([
          mv.elements[0], mv.elements[1], mv.elements[2],
          mv.elements[4], mv.elements[5], mv.elements[6],
          mv.elements[8], mv.elements[9], mv.elements[10]
        ]);
        gl.uniformMatrix3fv(uNorm, false, nm);

        this.drawGeometry(mesh.geometry, this.meshProg);
      }
    }

    // 2. Render Lines
    if (lines.length > 0 && this.lineProg) {
      gl.useProgram(this.lineProg);
      const uProj = gl.getUniformLocation(this.lineProg, 'uProjectionMatrix');
      const uMV = gl.getUniformLocation(this.lineProg, 'uModelViewMatrix');
      const uCol = gl.getUniformLocation(this.lineProg, 'uColor');
      const uOp = gl.getUniformLocation(this.lineProg, 'uOpacity');

      gl.uniformMatrix4fv(uProj, false, camera.projectionMatrix.elements);

      for (const line of lines) {
        const mat = line.material || {};
        const col = mat.color || new Color(0.2, 0.7, 1.0);
        gl.uniform3f(uCol, col.r, col.g, col.b);
        gl.uniform1f(uOp, mat.opacity ?? 1.0);

        const mv = new Matrix4().multiplyMatrices(camera.matrixWorldInverse, line.matrixWorld);
        gl.uniformMatrix4fv(uMV, false, mv.elements);

        this.drawLines(line.geometry, this.lineProg, line.isLineSegments);
      }
    }

    // 3. Render Sprites (Billboard Labels)
    if (sprites.length > 0 && this.spriteProg) {
      gl.useProgram(this.spriteProg);
      const uProj = gl.getUniformLocation(this.spriteProg, 'uProjectionMatrix');
      const uMV = gl.getUniformLocation(this.spriteProg, 'uModelViewMatrix');
      const uScale = gl.getUniformLocation(this.spriteProg, 'uScale');
      const uTex = gl.getUniformLocation(this.spriteProg, 'uTexture');
      const uOp = gl.getUniformLocation(this.spriteProg, 'uOpacity');

      gl.uniformMatrix4fv(uProj, false, camera.projectionMatrix.elements);
      gl.uniform1i(uTex, 0);

      const aCorner = gl.getAttribLocation(this.spriteProg, 'aCorner');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteQuadBuf);
      gl.enableVertexAttribArray(aCorner);
      gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

      gl.depthMask(false); // disable depth write for alpha sprites

      for (const sprite of sprites) {
        const mat = sprite.material;
        if (!mat || !mat.map || !mat.map.image) continue;

        let glTexture = this.textureMap.get(mat.map);
        if (!glTexture || mat.map.needsUpdate) {
          if (!glTexture) {
            glTexture = gl.createTexture();
            this.textureMap.set(mat.map, glTexture);
          }
          gl.bindTexture(gl.TEXTURE_2D, glTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mat.map.image);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          mat.map.needsUpdate = false;
        } else {
          gl.bindTexture(gl.TEXTURE_2D, glTexture);
        }

        const mv = new Matrix4().multiplyMatrices(camera.matrixWorldInverse, sprite.matrixWorld);
        gl.uniformMatrix4fv(uMV, false, mv.elements);
        gl.uniform2f(uScale, sprite.scale.x, sprite.scale.y);
        gl.uniform1f(uOp, mat.opacity ?? 1.0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      gl.depthMask(true);
      gl.disableVertexAttribArray(aCorner);
    }
  }

  drawGeometry(geometry, program) {
    const gl = this.gl;
    const posAttr = geometry.getAttribute('position');
    const normAttr = geometry.getAttribute('normal');
    if (!posAttr) return;

    if (!geometry._posBuf) geometry._posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry._posBuf);
    if (!geometry._posUploaded) {
      gl.bufferData(gl.ARRAY_BUFFER, posAttr.array, gl.STATIC_DRAW);
      geometry._posUploaded = true;
    }

    const aPos = gl.getAttribLocation(program, 'aPosition');
    if (aPos !== -1) {
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    }

    let aNorm = -1;
    if (normAttr) {
      if (!geometry._normBuf) geometry._normBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, geometry._normBuf);
      if (!geometry._normUploaded) {
        gl.bufferData(gl.ARRAY_BUFFER, normAttr.array, gl.STATIC_DRAW);
        geometry._normUploaded = true;
      }
      aNorm = gl.getAttribLocation(program, 'aNormal');
      if (aNorm !== -1) {
        gl.enableVertexAttribArray(aNorm);
        gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
      }
    }

    if (geometry.index) {
      if (!geometry._idxBuf) geometry._idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geometry._idxBuf);
      if (!geometry._idxUploaded) {
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.index, gl.STATIC_DRAW);
        geometry._idxUploaded = true;
      }
      gl.drawElements(gl.TRIANGLES, geometry.index.length, gl.UNSIGNED_SHORT, 0);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, posAttr.count);
    }

    if (aPos !== -1) gl.disableVertexAttribArray(aPos);
    if (aNorm !== -1) gl.disableVertexAttribArray(aNorm);
  }

  drawLines(geometry, program, isSegments = false) {
    const gl = this.gl;
    const posAttr = geometry.getAttribute('position');
    if (!posAttr || posAttr.count === 0) return;

    if (!geometry._posBuf) geometry._posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry._posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, posAttr.array, gl.DYNAMIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'aPosition');
    if (aPos !== -1) {
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(isSegments ? gl.LINES : gl.LINE_STRIP, 0, posAttr.count);
      gl.disableVertexAttribArray(aPos);
    }
  }
}
