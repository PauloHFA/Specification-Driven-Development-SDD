/**
 * @file src/vault/public/vendor/OrbitControls.js
 * @description Lightweight offline OrbitControls ESM module for 3D Camera navigation.
 * Implements smooth spherical orbit (yaw/pitch) with polar gimbal-lock prevention,
 * planar pan, logarithmic zoom, damping inertia, and change event dispatching.
 * Zero external CDN or internet dependencies. 100% offline.
 */

import { Vector3, MathUtils } from './three.module.js';

export class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement || document.body;

    this.enabled = true;
    this.target = new Vector3(0, 0, 0);

    this.minDistance = 10;
    this.maxDistance = 4000;

    this.minPolarAngle = 0.01;
    this.maxPolarAngle = Math.PI - 0.01;

    this.enableDamping = true;
    this.dampingFactor = 0.08;

    this.rotateSpeed = 0.8;
    this.panSpeed = 1.0;
    this.zoomSpeed = 1.2;

    this._listeners = new Map();

    // Spherical coordinates
    const offset = new Vector3().subVectors(this.camera.position, this.target);
    this.radius = Math.max(this.minDistance, offset.length());
    this.theta = Math.atan2(offset.x, offset.z);
    this.phi = Math.acos(MathUtils.clamp(offset.y / this.radius, -1, 1));

    this.targetRadius = this.radius;
    this.targetTheta = this.theta;
    this.targetPhi = this.phi;

    this._isPointerDown = false;
    this._pointerMode = 'none'; // 'rotate' | 'pan'
    this._startX = 0;
    this._startY = 0;

    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    this.domElement.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this.domElement.addEventListener('wheel', this._onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this._onContextMenu);
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    if (this._listeners.has(type)) {
      this._listeners.get(type).delete(listener);
    }
  }

  dispatchEvent(event) {
    const listeners = this._listeners.get(event.type);
    if (listeners) {
      for (const fn of listeners) {
        fn(event);
      }
    }
  }

  _handlePointerDown(e) {
    if (!this.enabled) return;
    this._isPointerDown = true;
    this._startX = e.clientX;
    this._startY = e.clientY;

    if (e.button === 0 && !e.shiftKey && !e.ctrlKey) {
      this._pointerMode = 'rotate';
    } else if (e.button === 2 || (e.button === 0 && (e.shiftKey || e.ctrlKey)) || e.button === 1) {
      this._pointerMode = 'pan';
    }
  }

  _handlePointerMove(e) {
    if (!this.enabled || !this._isPointerDown) return;

    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;
    this._startX = e.clientX;
    this._startY = e.clientY;

    if (this._pointerMode === 'rotate') {
      const rotSpeed = 0.005 * this.rotateSpeed;
      this.targetTheta -= dx * rotSpeed;
      this.targetPhi = MathUtils.clamp(
        this.targetPhi - dy * rotSpeed,
        this.minPolarAngle,
        this.maxPolarAngle
      );
      this.dispatchEvent({ type: 'change' });
    } else if (this._pointerMode === 'pan') {
      const factor = (2 * this.radius * Math.tan(MathUtils.degToRad(this.camera.fov * 0.5))) / (this.domElement.clientHeight || 800);
      const panX = -dx * factor * this.panSpeed;
      const panY = dy * factor * this.panSpeed;

      // Pan relative to camera right and up vectors
      const forward = new Vector3().subVectors(this.target, this.camera.position).normalize();
      const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
      const up = new Vector3().crossVectors(right, forward).normalize();

      const deltaPan = new Vector3()
        .add(right.multiplyScalar(panX))
        .add(up.multiplyScalar(panY));

      this.target.add(deltaPan);
      this.camera.position.add(deltaPan);
      this.dispatchEvent({ type: 'change' });
    }
  }

  _handlePointerUp() {
    this._isPointerDown = false;
    this._pointerMode = 'none';
  }

  _handleWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();

    const zoomDelta = e.deltaY * 0.0015 * this.zoomSpeed;
    this.targetRadius = MathUtils.clamp(
      this.targetRadius * Math.exp(zoomDelta),
      this.minDistance,
      this.maxDistance
    );
    this.dispatchEvent({ type: 'change' });
  }

  update() {
    if (!this.enabled) return false;

    if (this.enableDamping) {
      this.radius += (this.targetRadius - this.radius) * this.dampingFactor;
      this.theta += (this.targetTheta - this.theta) * this.dampingFactor;
      this.phi += (this.targetPhi - this.phi) * this.dampingFactor;
    } else {
      this.radius = this.targetRadius;
      this.theta = this.targetTheta;
      this.phi = this.targetPhi;
    }

    // Convert spherical to cartesian
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    this.camera.position.x = this.target.x + this.radius * sinPhi * sinTheta;
    this.camera.position.y = this.target.y + this.radius * cosPhi;
    this.camera.position.z = this.target.z + this.radius * sinPhi * cosTheta;

    this.camera.lookAt(this.target);
    return true;
  }

  syncFromCamera() {
    const offset = new Vector3().subVectors(this.camera.position, this.target);
    this.radius = Math.max(this.minDistance, offset.length());
    this.theta = Math.atan2(offset.x, offset.z);
    this.phi = Math.acos(MathUtils.clamp(offset.y / this.radius, -1, 1));
    this.targetRadius = this.radius;
    this.targetTheta = this.theta;
    this.targetPhi = this.phi;
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.domElement.removeEventListener('wheel', this._onWheel);
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
  }
}
