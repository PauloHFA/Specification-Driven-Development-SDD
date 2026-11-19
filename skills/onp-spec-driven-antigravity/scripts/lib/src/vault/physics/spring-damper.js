/**
 * @file src/vault/physics/spring-damper.js
 * @description Pure ESM Damped Hooke's Law Spring Simulation with Symplectic Euler integration,
 * Coulomb Electrostatic Repulsion with Plummer softening, Centering Gravity,
 * Velocity Damping, Velocity Clamping, and Kinetic Energy Sleep Threshold.
 * Zero external dependencies. Node.js >= 18.
 */

import { Vector3 } from '../math/vector3.js';

/**
 * Class representing the physical spring-damper graph layout simulation.
 */
export class SpringSimulation {
  /**
   * @param {Object} [graph] - Graph object { nodes: Array|Map, edges: Array|Map }
   * @param {Object} [config={}] - Simulation configuration parameters
   */
  constructor(graph = {}, config = {}) {
    this.config = {
      kRepulsion: config.kRepulsion ?? 3000.0,
      softening: config.softening ?? 25.0,
      kSpring: config.kSpring ?? 0.20,
      dampingRatio: config.dampingRatio ?? 0.85,
      restLength: config.restLength ?? 80.0,
      kCenter: config.kCenter ?? 0.008,
      velocityDamping: config.velocityDamping ?? 0.12,
      maxVelocity: config.maxVelocity ?? 400.0,
      fixedDt: config.fixedDt ?? 0.02,
      sleepEnergyThreshold: config.sleepEnergyThreshold ?? 0.001,
      sleepTicksRequired: config.sleepTicksRequired ?? 30,
      ...config
    };

    this.nodes = new Map(); // id -> InternalNode
    this.edges = [];        // Array<InternalEdge>
    this.nodeList = [];     // Cached array for O(N^2) pairwise iteration
    this.resting = false;
    this.sleepTicks = 0;
    this.totalKineticEnergy = 0;

    this._initializeGraph(graph);
  }

  /**
   * Populates internal structures from input graph.
   * @private
   */
  _initializeGraph(graph) {
    this.nodes.clear();
    this.edges = [];
    this.nodeList = [];

    if (!graph) return;

    // 1. Process nodes
    const rawNodes = graph.nodes
      ? (graph.nodes instanceof Map ? Array.from(graph.nodes.values()) : Array.from(graph.nodes))
      : [];

    for (const n of rawNodes) {
      if (!n || !n.id) continue;
      const id = String(n.id);
      const posX = n.x ?? n.position?.x ?? 0;
      const posY = n.y ?? n.position?.y ?? 0;
      const posZ = n.z ?? n.position?.z ?? 0;

      const velX = n.vx ?? n.velocity?.x ?? 0;
      const velY = n.vy ?? n.velocity?.y ?? 0;
      const velZ = n.vz ?? n.velocity?.z ?? 0;

      const mass = typeof n.mass === 'number' && n.mass > 0 ? n.mass : 1.0;
      const pinned = Boolean(n.pinned);

      const internalNode = {
        id,
        x: Number.isFinite(posX) ? Number(posX) : 0,
        y: Number.isFinite(posY) ? Number(posY) : 0,
        z: Number.isFinite(posZ) ? Number(posZ) : 0,
        vx: Number.isFinite(velX) ? Number(velX) : 0,
        vy: Number.isFinite(velY) ? Number(velY) : 0,
        vz: Number.isFinite(velZ) ? Number(velZ) : 0,
        fx: 0,
        fy: 0,
        fz: 0,
        mass,
        pinned
      };

      this.nodes.set(id, internalNode);
      this.nodeList.push(internalNode);
    }

    // 2. Process edges
    const rawEdges = graph.edges
      ? (graph.edges instanceof Map ? Array.from(graph.edges.values()) : Array.from(graph.edges))
      : [];

    for (const e of rawEdges) {
      if (!e || typeof e.source !== 'string' || typeof e.target !== 'string') continue;
      const restLength = e.restLength ?? e.visualStyle?.restLength ?? this.config.restLength;
      const stiffness = e.stiffness ?? e.visualStyle?.stiffness ?? this.config.kSpring;
      const dampingRatio = e.damping ?? e.dampingRatio ?? e.visualStyle?.damping ?? this.config.dampingRatio;

      this.edges.push({
        id: e.id || `${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        restLength: Number.isFinite(restLength) ? Number(restLength) : this.config.restLength,
        stiffness: Number.isFinite(stiffness) ? Number(stiffness) : this.config.kSpring,
        dampingRatio: Number.isFinite(dampingRatio) ? Number(dampingRatio) : this.config.dampingRatio
      });
    }

    let initialKinetic = 0;
    for (const node of this.nodeList) {
      initialKinetic += 0.5 * node.mass * (node.vx * node.vx + node.vy * node.vy + node.vz * node.vz);
    }
    this.totalKineticEnergy = initialKinetic;

    this.resting = false;
    this.sleepTicks = 0;
  }

  /**
   * Advances physics simulation by dtSec seconds using Symplectic Euler.
   * @param {number} [dtSec=0.02] - Simulation delta time in seconds
   * @returns {{ kinetic: number, potential: number, isResting: boolean, stepsRun: number }}
   */
  step(dtSec = 0.02) {
    if (this.nodeList.length === 0) {
      this.resting = true;
      return { kinetic: 0, potential: 0, isResting: true, stepsRun: 0 };
    }

    if (this.resting) {
      return { kinetic: 0, potential: this._computePotentialEnergy(), isResting: true, stepsRun: 0 };
    }

    // Clamp delta time to maximum step size for numerical stability
    const rawDt = Number(dtSec);
    const dt = Math.max(0, Math.min(Number.isFinite(rawDt) ? rawDt : this.config.fixedDt, this.config.fixedDt));

    if (dt <= 0) {
      return {
        kinetic: this.totalKineticEnergy,
        potential: this._computePotentialEnergy(),
        isResting: this.resting,
        stepsRun: 0
      };
    }

    const n = this.nodeList.length;

    // Reset accumulated forces
    for (let i = 0; i < n; i++) {
      const node = this.nodeList[i];
      node.fx = 0;
      node.fy = 0;
      node.fz = 0;
    }

    // 1. Coulomb Electrostatic Repulsion (all pairs i < j) with Plummer Softening
    const kRep = this.config.kRepulsion;
    const r0Sq = this.config.softening * this.config.softening;

    for (let i = 0; i < n; i++) {
      const nodeI = this.nodeList[i];
      for (let j = i + 1; j < n; j++) {
        const nodeJ = this.nodeList[j];

        const dx = nodeI.x - nodeJ.x;
        const dy = nodeI.y - nodeJ.y;
        const dz = nodeI.z - nodeJ.z;
        const dist = Math.hypot(dx, dy, dz);

        let rx, ry, rz;
        if (dist < 1e-6) {
          // Anti-singularity deterministic perturbation
          const px = Math.sin(1.7 * i + 3.1 * j);
          const py = Math.cos(2.3 * i + 1.9 * j);
          const pz = Math.sin(3.7 * i + 2.7 * j);
          const pLen = Math.hypot(px, py, pz) || 1.0;
          rx = px / pLen;
          ry = py / pLen;
          rz = pz / pLen;
        } else {
          rx = dx / dist;
          ry = dy / dist;
          rz = dz / dist;
        }

        const denom = dist * dist + r0Sq;
        const fRep = (kRep * nodeI.mass * nodeJ.mass) / denom;

        const fX = fRep * rx;
        const fY = fRep * ry;
        const fZ = fRep * rz;

        nodeI.fx += fX;
        nodeI.fy += fY;
        nodeI.fz += fZ;

        nodeJ.fx -= fX;
        nodeJ.fy -= fY;
        nodeJ.fz -= fZ;
      }
    }

    // 2. Damped Hooke's Law Spring Attraction along Edges
    const numEdges = this.edges.length;
    for (let k = 0; k < numEdges; k++) {
      const edge = this.edges[k];
      const u = this.nodes.get(edge.source);
      const v = this.nodes.get(edge.target);

      if (!u || !v) continue;

      // Displacement from u to v
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const dz = v.z - u.z;
      const dist = Math.hypot(dx, dy, dz);

      let rx = 0, ry = 0, rz = 0;
      if (dist >= 1e-6) {
        rx = dx / dist;
        ry = dy / dist;
        rz = dz / dist;
      }

      // Restoring Hooke force (elongation pulls u towards v)
      const deltaL = dist - edge.restLength;
      const fSpring = edge.stiffness * deltaL;

      // Axial Viscous Damper Force
      const dvx = v.vx - u.vx;
      const dvy = v.vy - u.vy;
      const dvz = v.vz - u.vz;
      const vAxial = dvx * rx + dvy * ry + dvz * rz;

      const reducedMass = (u.mass * v.mass) / (u.mass + v.mass);
      const cd = 2 * edge.dampingRatio * Math.sqrt(edge.stiffness * reducedMass);
      const fDamper = cd * vAxial;

      const fTotal = fSpring + fDamper;

      const fX = fTotal * rx;
      const fY = fTotal * ry;
      const fZ = fTotal * rz;

      u.fx += fX;
      u.fy += fY;
      u.fz += fZ;

      v.fx -= fX;
      v.fy -= fY;
      v.fz -= fZ;
    }

    // 3. Centering Gravity & 4. Atmospheric Drag
    const kCenter = this.config.kCenter;
    const gammaDrag = this.config.velocityDamping;
    const maxV = this.config.maxVelocity;

    let totalKinetic = 0;

    // 5. Symplectic Euler Numerical Integration
    for (let i = 0; i < n; i++) {
      const node = this.nodeList[i];

      if (node.pinned) {
        node.vx = 0;
        node.vy = 0;
        node.vz = 0;
        continue;
      }

      // Centering force
      node.fx += -kCenter * node.x;
      node.fy += -kCenter * node.y;
      node.fz += -kCenter * node.z;

      // Drag force
      node.fx += -gammaDrag * node.vx;
      node.fy += -gammaDrag * node.vy;
      node.fz += -gammaDrag * node.vz;

      // Semi-implicit update: velocity first
      const ax = node.fx / node.mass;
      const ay = node.fy / node.mass;
      const az = node.fz / node.mass;

      node.vx += ax * dt;
      node.vy += ay * dt;
      node.vz += az * dt;

      // Velocity magnitude clamping governor
      const speed = Math.hypot(node.vx, node.vy, node.vz);
      if (speed > maxV) {
        const vScale = maxV / speed;
        node.vx *= vScale;
        node.vy *= vScale;
        node.vz *= vScale;
      }

      // Position updated with new velocity
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      node.z += node.vz * dt;

      // Accumulate system kinetic energy
      totalKinetic += 0.5 * node.mass * (node.vx * node.vx + node.vy * node.vy + node.vz * node.vz);
    }

    this.totalKineticEnergy = totalKinetic;

    // 6. Sleep State Evaluation
    if (totalKinetic < this.config.sleepEnergyThreshold) {
      this.sleepTicks++;
      if (this.sleepTicks >= this.config.sleepTicksRequired) {
        this.resting = true;
        for (let i = 0; i < n; i++) {
          this.nodeList[i].vx = 0;
          this.nodeList[i].vy = 0;
          this.nodeList[i].vz = 0;
        }
      }
    } else {
      this.sleepTicks = 0;
      this.resting = false;
    }

    const potential = this._computePotentialEnergy();

    return {
      kinetic: this.totalKineticEnergy,
      potential,
      isResting: this.resting,
      stepsRun: 1
    };
  }

  /**
   * Computes total elastic potential energy and gravitational potential energy.
   * @private
   * @returns {number}
   */
  _computePotentialEnergy() {
    let ep = 0;

    // Spring potential energy: 0.5 * k_s * (dist - L_0)^2
    for (let k = 0; k < this.edges.length; k++) {
      const e = this.edges[k];
      const u = this.nodes.get(e.source);
      const v = this.nodes.get(e.target);
      if (!u || !v) continue;

      const dist = Math.hypot(u.x - v.x, u.y - v.y, u.z - v.z);
      const deltaL = dist - e.restLength;
      ep += 0.5 * e.stiffness * deltaL * deltaL;
    }

    // Centering gravitational potential: 0.5 * k_c * ||p||^2
    const kCenter = this.config.kCenter;
    for (let i = 0; i < this.nodeList.length; i++) {
      const node = this.nodeList[i];
      const rSq = node.x * node.x + node.y * node.y + node.z * node.z;
      ep += 0.5 * kCenter * rSq;
    }

    return ep;
  }

  /**
   * Returns a Map of node IDs to Vector3 positions.
   * @returns {Map<string, Vector3>}
   */
  getNodePositions() {
    const map = new Map();
    for (const [id, node] of this.nodes.entries()) {
      map.set(id, new Vector3(node.x, node.y, node.z));
    }
    return map;
  }

  /**
   * Returns current position of a single node.
   * @param {string} id
   * @returns {Vector3|null}
   */
  getNodePosition(id) {
    const node = this.nodes.get(id);
    if (!node) return null;
    return new Vector3(node.x, node.y, node.z);
  }

  /**
   * Sets node position and wakes up the simulation.
   * @param {string} id
   * @param {Vector3|{x?: number, y?: number, z?: number}} pos
   */
  setNodePosition(id, pos) {
    const node = this.nodes.get(id);
    if (!node || !pos) return;

    node.x = Number.isFinite(pos.x) ? Number(pos.x) : 0;
    node.y = Number.isFinite(pos.y) ? Number(pos.y) : 0;
    node.z = Number.isFinite(pos.z) ? Number(pos.z) : 0;
    node.vx = 0;
    node.vy = 0;
    node.vz = 0;

    this.wake();
  }

  /**
   * Pins or unpins a node to lock its position during user drag interaction.
   * @param {string} id
   * @param {boolean} [pinned=true]
   */
  pinNode(id, pinned = true) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.pinned = Boolean(pinned);
    if (node.pinned) {
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
    }
    this.wake();
  }

  /**
   * Unpins a node.
   * @param {string} id
   */
  unpinNode(id) {
    this.pinNode(id, false);
  }

  /**
   * Checks whether a node is currently pinned.
   * @param {string} id
   * @returns {boolean}
   */
  isNodePinned(id) {
    const node = this.nodes.get(id);
    return Boolean(node && node.pinned);
  }

  /**
   * Removes a node and any connected edges from the simulation.
   * @param {string} id
   */
  removeNode(id) {
    const strId = String(id);
    if (!this.nodes.has(strId)) return;
    this.nodes.delete(strId);
    this.nodeList = this.nodeList.filter(n => n.id !== strId);
    this.edges = this.edges.filter(e => e.source !== strId && e.target !== strId);
    this.wake();
  }

  /**
   * Removes a directed edge from the simulation.
   * @param {string} source
   * @param {string} target
   */
  removeEdge(source, target) {
    this.edges = this.edges.filter(e => !(e.source === source && e.target === target));
    this.wake();
  }

  /**
   * Returns kinetic, potential, and total simulation energy.
   * @returns {{ kinetic: number, potential: number, total: number, isResting: boolean }}
   */
  getSimulationEnergy() {
    const kinetic = this.totalKineticEnergy;
    const potential = this._computePotentialEnergy();
    return {
      kinetic,
      potential,
      total: kinetic + potential,
      isResting: this.resting
    };
  }

  /**
   * Returns whether the simulation is resting in sleep mode.
   * @returns {boolean}
   */
  isResting() {
    return this.resting;
  }

  /**
   * Explicitly wakes up the simulation.
   */
  wake() {
    this.resting = false;
    this.sleepTicks = 0;
  }

  /**
   * Dynamically adds or updates a node in the simulation.
   * @param {Object} node - { id: string, x?: number, y?: number, z?: number, mass?: number, pinned?: boolean }
   */
  addNode(node) {
    if (!node || !node.id) return;
    const id = String(node.id);

    if (this.nodes.has(id)) {
      this.setNodePosition(id, node);
      return;
    }

    const internalNode = {
      id,
      x: Number.isFinite(node.x) ? Number(node.x) : 0,
      y: Number.isFinite(node.y) ? Number(node.y) : 0,
      z: Number.isFinite(node.z) ? Number(node.z) : 0,
      vx: 0,
      vy: 0,
      vz: 0,
      fx: 0,
      fy: 0,
      fz: 0,
      mass: typeof node.mass === 'number' && node.mass > 0 ? node.mass : 1.0,
      pinned: Boolean(node.pinned)
    };

    this.nodes.set(id, internalNode);
    this.nodeList.push(internalNode);
    this.wake();
  }

  /**
   * Dynamically adds an edge to the simulation.
   * @param {Object} edge - { id?: string, source: string, target: string, restLength?: number, stiffness?: number, damping?: number }
   */
  addEdge(edge) {
    if (!edge || !edge.source || !edge.target) return;
    const restLength = edge.restLength ?? edge.visualStyle?.restLength ?? this.config.restLength;
    const stiffness = edge.stiffness ?? edge.visualStyle?.stiffness ?? this.config.kSpring;
    const dampingRatio = edge.damping ?? edge.dampingRatio ?? edge.visualStyle?.damping ?? this.config.dampingRatio;

    this.edges.push({
      id: edge.id || `${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      restLength: Number.isFinite(restLength) ? Number(restLength) : this.config.restLength,
      stiffness: Number.isFinite(stiffness) ? Number(stiffness) : this.config.kSpring,
      dampingRatio: Number.isFinite(dampingRatio) ? Number(dampingRatio) : this.config.dampingRatio
    });

    this.wake();
  }
}
