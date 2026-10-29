/**
 * @file src/vault/math/camera-kinematics.js
 * @description Pure ESM 3D Camera Kinematics Engine.
 * Implements Spherical Orbit with Gimbal Lock Protection,
 * Distance-Scaled Screen Pan, Logarithmic Zoom, and
 * Quintic Ease-Out Slerp + Arc Lerp Camera Transitions.
 * Zero external dependencies. Conforms to Node.js >= 18.
 */

import { Vector3, clamp, lerp } from './vector3.js';

/**
 * Quintic ease-out interpolation function.
 * Smooth acceleration with silky asymptotic settling.
 * @param {number} t - Normalized progress [0, 1]
 * @returns {number}
 */
export function easeOutQuint(t) {
  const clamped = clamp(t, 0, 1);
  return 1 - Math.pow(1 - clamped, 5);
}

/**
 * Spherical linear interpolation (Slerp) between two unit direction vectors.
 * Falls back to normalized linear interpolation when vectors are collinear.
 * @param {Vector3} d0 - Starting unit direction
 * @param {Vector3} d1 - Ending unit direction
 * @param {number} t - Interpolation alpha [0, 1]
 * @returns {Vector3}
 */
export function slerpDirections(d0, d1, t) {
  const dot = clamp(d0.dot(d1), -1, 1);
  const omega = Math.acos(dot);

  if (Math.sin(omega) < 1e-4) {
    // Nearly parallel or collinear: fallback to normalized linear lerp
    return new Vector3()
      .copy(d0)
      .multiplyScalar(1 - t)
      .add(new Vector3().copy(d1).multiplyScalar(t))
      .normalize();
  }

  const sinOmega = Math.sin(omega);
  const s0 = Math.sin((1 - t) * omega) / sinOmega;
  const s1 = Math.sin(t * omega) / sinOmega;

  return new Vector3()
    .copy(d0)
    .multiplyScalar(s0)
    .add(new Vector3().copy(d1).multiplyScalar(s1))
    .normalize();
}

/**
 * Camera kinematics controller for 3D navigation and focus transitions.
 */
export class CameraController {
  /**
   * @param {Object} [config={}]
   * @param {Vector3|number[]} [config.target=[0,0,0]]
   * @param {Vector3|number[]} [config.position=[0,50,200]]
   * @param {number} [config.fov=60] - Vertical field of view in degrees
   * @param {number} [config.viewportWidth=1920]
   * @param {number} [config.viewportHeight=1080]
   * @param {number} [config.minDistance=5.0]
   * @param {number} [config.maxDistance=8000.0]
   * @param {number} [config.minPolarAngle=0.001]
   * @param {number} [config.maxPolarAngle=Math.PI - 0.001]
   * @param {number} [config.orbitSpeed=1.0]
   * @param {number} [config.panSpeed=1.0]
   * @param {number} [config.zoomSpeed=0.0015]
   */
  constructor(config = {}) {
    this.target = new Vector3();
    if (config.target) {
      if (Array.isArray(config.target)) this.target.set(...config.target);
      else this.target.copy(config.target);
    } else {
      this.target.set(0, 0, 0);
    }

    this.position = new Vector3();
    if (config.position) {
      if (Array.isArray(config.position)) this.position.set(...config.position);
      else this.position.copy(config.position);
    } else {
      this.position.set(0, 50, 200);
    }

    this.worldUp = new Vector3(0, 1, 0);
    this.fov = config.fov || 60; // vertical FOV in degrees
    this.viewportWidth = config.viewportWidth || 1920;
    this.viewportHeight = config.viewportHeight || 1080;

    // Bounds & Safeguards
    this.minDistance = config.minDistance ?? 5.0;
    this.maxDistance = config.maxDistance ?? 8000.0;
    this.minPolarAngle = config.minPolarAngle ?? 0.001; // epsilon to avoid gimbal lock
    this.maxPolarAngle = config.maxPolarAngle ?? (Math.PI - 0.001);

    // Sensitivities
    this.orbitSpeed = config.orbitSpeed ?? 1.0;
    this.panSpeed = config.panSpeed ?? 1.0;
    this.zoomSpeed = config.zoomSpeed ?? 0.0015;

    // Spherical state (radius, theta, phi)
    this.radius = 200;
    this.theta = 0;
    this.phi = Math.PI / 2;
    this._updateSphericalFromCartesian();

    // Transition state
    this._transition = {
      active: false,
      elapsed: 0,
      duration: 0.8,
      startTarget: new Vector3(),
      endTarget: new Vector3(),
      startDir: new Vector3(),
      endDir: new Vector3(),
      startDist: 200,
      endDist: 200,
      arcLift: 0
    };
  }

  /**
   * Recalculates spherical coordinates (radius, theta, phi) from Cartesian position relative to target.
   * @private
   */
  _updateSphericalFromCartesian() {
    const offset = new Vector3().subVectors(this.position, this.target);
    this.radius = clamp(offset.length(), this.minDistance, this.maxDistance);

    if (this.radius < 1e-6) {
      this.radius = this.minDistance;
      offset.set(0, 0, this.radius);
    }

    // Azimuth theta: atan2(x, z)
    this.theta = Math.atan2(offset.x, offset.z);

    // Polar phi: acos(y / r)
    const cosPhi = clamp(offset.y / this.radius, -1, 1);
    this.phi = clamp(Math.acos(cosPhi), this.minPolarAngle, this.maxPolarAngle);
  }

  /**
   * Recalculates Cartesian position from current target and spherical coordinates.
   * @private
   */
  _updateCartesianFromSpherical() {
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinTheta = Math.sin(this.theta);
    const cosTheta = Math.cos(this.theta);

    this.position.x = this.target.x + this.radius * sinPhi * sinTheta;
    this.position.y = this.target.y + this.radius * cosPhi;
    this.position.z = this.target.z + this.radius * sinPhi * cosTheta;
  }

  /**
   * Sets look-at target.
   * @param {Vector3|number[]} target
   * @param {boolean} [keepDistance=true] - If true, translates camera position along with target.
   * @returns {this}
   */
  setTarget(target, keepDistance = true) {
    const newTarget = new Vector3();
    if (Array.isArray(target)) newTarget.set(...target);
    else newTarget.copy(target);

    if (keepDistance) {
      const delta = new Vector3().subVectors(newTarget, this.target);
      this.position.add(delta);
    }
    this.target.copy(newTarget);
    this._updateSphericalFromCartesian();
    return this;
  }

  /**
   * Sets camera position explicitly and updates spherical angles.
   * @param {Vector3|number[]} pos
   * @returns {this}
   */
  setPosition(pos) {
    if (Array.isArray(pos)) this.position.set(...pos);
    else this.position.copy(pos);
    this._updateSphericalFromCartesian();
    return this;
  }

  /**
   * Orbits camera around target.
   * Clamps polar angle to prevent gimbal lock at North/South poles.
   * Cancels any active transition.
   * @param {number} deltaX - Horizontal drag delta in pixels
   * @param {number} deltaY - Vertical drag delta in pixels
   * @returns {this}
   */
  orbit(deltaX, deltaY) {
    if (this._transition.active) this.cancelTransition();
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return this;

    const factorX = (2 * Math.PI) / this.viewportWidth;
    const factorY = Math.PI / this.viewportHeight;

    this.theta -= deltaX * factorX * this.orbitSpeed;
    this.phi -= deltaY * factorY * this.orbitSpeed;

    // Strict polar clamping to prevent gimbal lock
    this.phi = clamp(this.phi, this.minPolarAngle, this.maxPolarAngle);

    this._updateCartesianFromSpherical();
    return this;
  }

  /**
   * Pans camera and target synchronously in the screen projection plane.
   * Panning sensitivity scales linearly with viewing distance.
   * Cancels any active transition.
   * @param {number} deltaX - Horizontal drag delta in pixels
   * @param {number} deltaY - Vertical drag delta in pixels
   * @returns {this}
   */
  pan(deltaX, deltaY) {
    if (this._transition.active) this.cancelTransition();
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return this;

    const forward = new Vector3().subVectors(this.target, this.position).normalize();
    let right = new Vector3().crossVectors(forward, this.worldUp).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    const up = new Vector3().crossVectors(right, forward).normalize();

    // Distance-scaled pan
    const fovRad = (this.fov * Math.PI) / 180;
    const panScale = ((2 * this.radius * Math.tan(fovRad / 2)) / this.viewportHeight) * this.panSpeed;

    const panOffset = new Vector3()
      .copy(right)
      .multiplyScalar(-deltaX * panScale)
      .add(new Vector3().copy(up).multiplyScalar(deltaY * panScale));

    this.target.add(panOffset);
    this.position.add(panOffset);
    return this;
  }

  /**
   * Logarithmic zoom scaling distance exponentially.
   * Clamps radius to [minDistance, maxDistance].
   * Cancels any active transition.
   * @param {number} deltaY - Wheel/pinch delta
   * @returns {this}
   */
  zoom(deltaY) {
    if (this._transition.active) this.cancelTransition();
    if (!Number.isFinite(deltaY)) return this;

    const zoomFactor = Math.exp(deltaY * this.zoomSpeed);
    this.radius = clamp(this.radius * zoomFactor, this.minDistance, this.maxDistance);

    this._updateCartesianFromSpherical();
    return this;
  }

  /**
   * Initiates a smooth camera transition to a new target position.
   * @param {Vector3|number[]} newTarget - Destination target coordinates
   * @param {number|null} [newDistance=null] - Desired camera distance (defaults to current distance)
   * @param {number} [duration=0.8] - Transition duration in seconds (or ms if > 10)
   * @returns {this}
   */
  transitionTo(newTarget, newDistance = null, duration = 0.8) {
    const endTarget = new Vector3();
    if (Array.isArray(newTarget)) endTarget.set(...newTarget);
    else endTarget.copy(newTarget);

    let durationSec = Number.isFinite(duration) ? Number(duration) : 0.8;
    // Seamlessly support milliseconds input (e.g. 800ms)
    if (durationSec > 10) durationSec /= 1000;

    if (durationSec <= 0) {
      this.target.copy(endTarget);
      if (newDistance !== null) this.radius = clamp(newDistance, this.minDistance, this.maxDistance);
      this._updateCartesianFromSpherical();
      this._transition.active = false;
      return this;
    }

    const startOffset = new Vector3().subVectors(this.position, this.target);
    const startDist = clamp(startOffset.length(), this.minDistance, this.maxDistance);
    const startDir = startOffset.clone().normalize();

    const endDist = newDistance !== null
      ? clamp(newDistance, this.minDistance, this.maxDistance)
      : startDist;

    const endDir = startDir.clone();

    // Arc lift height proportional to distance between start and end targets
    const targetDist = this.target.distanceTo(endTarget);
    const arcLift = Math.min(80.0, 0.25 * targetDist);

    this._transition = {
      active: true,
      elapsed: 0,
      duration: durationSec,
      startTarget: this.target.clone(),
      endTarget,
      startDir,
      endDir,
      startDist,
      endDist,
      arcLift
    };

    return this;
  }

  /**
   * Halts active transition in-place, preserving current position and target.
   * @returns {this}
   */
  cancelTransition() {
    this._transition.active = false;
    this._updateSphericalFromCartesian();
    return this;
  }

  /**
   * Advances transition kinematics by deltaSec.
   * @param {number} deltaSec - Time delta in seconds
   * @returns {boolean} True if transition is still active, false otherwise
   */
  update(deltaSec) {
    if (!this._transition.active) return false;

    const dt = Math.max(0, Number(deltaSec) || 0);
    this._transition.elapsed += dt;

    const u = clamp(this._transition.elapsed / this._transition.duration, 0, 1);
    const ease = easeOutQuint(u);

    // 1. Target linear lerp
    this.target.lerpVectors(this._transition.startTarget, this._transition.endTarget, ease);

    // 2. Direction spherical slerp
    const curDir = slerpDirections(this._transition.startDir, this._transition.endDir, ease);

    // 3. Radius arc lerp with parabolic/sinusoidal lift
    const curDist = lerp(this._transition.startDist, this._transition.endDist, ease) +
      this._transition.arcLift * Math.sin(Math.PI * u);

    this.radius = curDist;
    this.position.copy(this.target).add(curDir.multiplyScalar(curDist));
    this._updateSphericalFromCartesian();

    if (u >= 1) {
      this._transition.active = false;
    }

    return true;
  }

  /**
   * Returns current camera kinematic state.
   * @returns {{
   *   position: Vector3,
   *   target: Vector3,
   *   up: Vector3,
   *   forward: Vector3,
   *   right: Vector3,
   *   spherical: { radius: number, theta: number, phi: number },
   *   isTransitioning: boolean,
   *   progress: number
   * }}
   */
  getState() {
    const forward = new Vector3().subVectors(this.target, this.position).normalize();
    let right = new Vector3().crossVectors(forward, this.worldUp).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    const up = new Vector3().crossVectors(right, forward).normalize();

    return {
      position: this.position.clone(),
      target: this.target.clone(),
      up,
      forward,
      right,
      spherical: {
        radius: this.radius,
        theta: this.theta,
        phi: this.phi
      },
      isTransitioning: this._transition.active,
      progress: this._transition.active
        ? clamp(this._transition.elapsed / this._transition.duration, 0, 1)
        : 1.0
    };
  }
}
