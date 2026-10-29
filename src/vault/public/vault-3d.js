/**
 * @file src/vault/public/vault-3d.js
 * @description 3D Spatial Knowledge Graph Scene Controller.
 * Manages 3D node meshes, text billboard sprites, elastic line geometry,
 * glowing crimson vibrating cables for cyclic dependencies, OrbitControls,
 * Raycaster mouse selection, and Quintic Ease-Out Arc Lerp camera transitions.
 * Zero external CDN or internet dependencies. 100% offline.
 */

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  SphereGeometry,
  MeshPhongMaterial,
  LineBasicMaterial,
  Line,
  BufferGeometry,
  Float32BufferAttribute,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  Raycaster,
  Vector2,
  Vector3,
  Color,
  AmbientLight,
  DirectionalLight,
  Group
} from './vendor/three.module.js';

import { OrbitControls } from './vendor/OrbitControls.js';

const TYPE_COLORS = {
  feature: 0x8b5cf6,   // Violet
  story: 0x3b82f6,     // Blue
  criterion: 0x10b981, // Emerald Green
  task: 0xf59e0b,      // Amber
  principle: 0xec4899, // Pink
  file: 0x64748b,      // Slate
  assumption: 0x06b6d4,// Cyan
  question: 0xeab308,  // Yellow
  generic: 0x94a3b8    // Default Gray
};

const COLOR_NORMAL_EDGE = 0x38bdf8; // Vibrant Sky Blue
const COLOR_CYCLIC_EDGE = 0xef4444; // Neon Crimson
const COLOR_CYCLIC_NODE = 0xef4444;

/**
 * Creates a high-DPI text canvas texture for a billboard label.
 */
function createTextSprite(text, color = '#f8fafc', bgColor = 'rgba(15, 23, 42, 0.85)') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
  ctx.lineWidth = 2;

  // Rounded rectangle pill
  const r = 16, x = 4, y = 8, w = 248, h = 48;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, transparent: true });
  const sprite = new Sprite(material);
  sprite.scale.set(36, 9, 1);
  return sprite;
}

export class Vault3D {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.width = canvasElement.clientWidth || window.innerWidth;
    this.height = canvasElement.clientHeight || window.innerHeight;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();

    this.nodeGroup = new Group();
    this.edgeGroup = new Group();

    this.nodeMeshMap = new Map(); // id -> Mesh
    this.nodeLabelMap = new Map(); // id -> Sprite
    this.edgeObjectList = [];     // Array of edge rendering descriptors

    this.nodeDataMap = new Map(); // id -> node data
    this.edgeDataList = [];

    this.selectedNodeId = null;
    this.onNodeClickCallback = null;

    // Camera Lerp State
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 0.8; // seconds
    this.camStartPos = new Vector3();
    this.camStartTarget = new Vector3();
    this.camEndPos = new Vector3();
    this.camEndTarget = new Vector3();
    this.camStartDir = new Vector3();
    this.camEndDir = new Vector3();
    this.camStartDist = 120;
    this.camEndDist = 120;

    this.clockStartTime = performance.now();
    this.lastFrameTime = performance.now();

    this._boundAnimate = this._animate.bind(this);
    this._boundOnPointerDown = this._onPointerDown.bind(this);
    this._boundOnResize = this._onResize.bind(this);
  }

  init() {
    this.scene = new Scene();
    this.scene.background = new Color(0x070b14);

    this.camera = new PerspectiveCamera(50, this.width / this.height, 1, 5000);
    this.camera.position.set(0, 80, 360);

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(this.width, this.height);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 2500;

    // Lighting
    const ambientLight = new AmbientLight(0x475569, 1.2);
    this.scene.add(ambientLight);

    const dirLight1 = new DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(200, 400, 300);
    this.scene.add(dirLight1);

    const dirLight2 = new DirectionalLight(0x38bdf8, 0.4);
    dirLight2.position.set(-200, -200, -100);
    this.scene.add(dirLight2);

    this.scene.add(this.edgeGroup);
    this.scene.add(this.nodeGroup);

    this.canvas.addEventListener('pointerdown', this._boundOnPointerDown);
    window.addEventListener('resize', this._boundOnResize);

    requestAnimationFrame(this._boundAnimate);
  }

  loadGraph(graphData) {
    this.clearGraph();

    const nodes = graphData.nodes || [];
    const edges = graphData.edges || [];

    this.nodeDataMap.clear();
    for (const n of nodes) {
      this.nodeDataMap.set(n.id, n);
    }
    this.edgeDataList = edges;

    // 1. Build Node Meshes & Billboard Labels
    for (const node of nodes) {
      const radius = node.type === 'feature' ? 8 : node.type === 'story' ? 6.5 : 5;
      const isCircular = node.status === 'circular' || (node.tags && node.tags.includes('CIRCULAR_DEPENDENCY'));

      const nodeColorHex = isCircular ? COLOR_CYCLIC_NODE : (TYPE_COLORS[node.type] || TYPE_COLORS.generic);

      const geometry = new SphereGeometry(radius, 16, 12);
      const material = new MeshPhongMaterial({
        color: nodeColorHex,
        emissive: isCircular ? 0x991b1b : 0x1e293b,
        shininess: 40
      });

      const mesh = new Mesh(geometry, material);
      const pos = node.position || { x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200, z: (Math.random() - 0.5) * 100 };
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { nodeId: node.id, isCircular };

      this.nodeGroup.add(mesh);
      this.nodeMeshMap.set(node.id, mesh);

      // Billboard Text Label
      const labelText = node.id;
      const sprite = createTextSprite(labelText, isCircular ? '#fca5a5' : '#f8fafc');
      sprite.position.set(pos.x, pos.y + radius + 7, pos.z);
      this.nodeGroup.add(sprite);
      this.nodeLabelMap.set(node.id, sprite);
    }

    // 2. Build Edge Connections
    for (const edge of edges) {
      const srcNode = this.nodeMeshMap.get(edge.source);
      const tgtNode = this.nodeMeshMap.get(edge.target);
      if (!srcNode || !tgtNode) continue;

      const isCircular = edge.status === 'circular' || (edge.tags && edge.tags.includes('CIRCULAR_DEPENDENCY'));
      const edgeColorHex = isCircular ? COLOR_CYCLIC_EDGE : COLOR_NORMAL_EDGE;

      const segments = isCircular ? 16 : 1;
      const points = [];
      for (let i = 0; i <= segments; i++) {
        points.push(new Vector3().copy(srcNode.position));
      }

      const geom = new BufferGeometry().setFromPoints(points);
      const mat = new LineBasicMaterial({
        color: edgeColorHex,
        opacity: isCircular ? 1.0 : 0.65,
        transparent: true,
        linewidth: isCircular ? 2.5 : 1
      });

      const line = new Line(geom, mat);
      this.edgeGroup.add(line);

      this.edgeObjectList.push({
        line,
        geom,
        edge,
        sourceMesh: srcNode,
        targetMesh: tgtNode,
        isCircular,
        segments
      });
    }

    this.resetView();
  }

  clearGraph() {
    while (this.nodeGroup.children.length > 0) {
      this.nodeGroup.remove(this.nodeGroup.children[0]);
    }
    while (this.edgeGroup.children.length > 0) {
      this.edgeGroup.remove(this.edgeGroup.children[0]);
    }
    this.nodeMeshMap.clear();
    this.nodeLabelMap.clear();
    this.edgeObjectList = [];
  }

  updateNodePositions(positionsMap) {
    if (!positionsMap) return;

    for (const [id, pos] of positionsMap.entries()) {
      const mesh = this.nodeMeshMap.get(id);
      const label = this.nodeLabelMap.get(id);
      if (mesh) {
        mesh.position.set(pos.x, pos.y, pos.z);
        if (label) {
          const r = mesh.geometry ? mesh.geometry.radius || 6 : 6;
          label.position.set(pos.x, pos.y + r + 7, pos.z);
        }
      }
    }
  }

  /**
   * Smoothly animates camera focus to a target node using Quintic Ease-Out Arc Lerp.
   */
  focusNode(nodeId) {
    const mesh = this.nodeMeshMap.get(nodeId);
    if (!mesh) return;

    this.selectedNodeId = nodeId;

    this.isTransitioning = true;
    this.transitionProgress = 0;

    this.camStartPos.copy(this.camera.position);
    this.camStartTarget.copy(this.controls.target);

    this.camEndTarget.copy(mesh.position);

    const curOffset = new Vector3().subVectors(this.camStartPos, this.camStartTarget);
    this.camStartDist = Math.max(30, curOffset.length());
    this.camEndDist = 120; // Optimal node inspection focal distance

    this.camStartDir.copy(curOffset).normalize();
    if (this.camStartDir.lengthSq() === 0) this.camStartDir.set(0, 0, 1);

    // Keep camera azimuth/polar angle relative to new target
    this.camEndDir.copy(this.camStartDir);
    this.camEndPos.copy(this.camEndTarget).add(this.camEndDir.clone().multiplyScalar(this.camEndDist));
  }

  resetView() {
    this.selectedNodeId = null;
    this.isTransitioning = true;
    this.transitionProgress = 0;

    this.camStartPos.copy(this.camera.position);
    this.camStartTarget.copy(this.controls.target);

    // Center of all nodes
    const center = new Vector3(0, 0, 0);
    let count = 0;
    for (const mesh of this.nodeMeshMap.values()) {
      center.add(mesh.position);
      count++;
    }
    if (count > 0) center.divideScalar(count);

    this.camEndTarget.copy(center);
    this.camEndDist = 380;
    this.camStartDir.set(0, 0.4, 0.9).normalize();
    this.camEndDir.set(0, 0.35, 0.92).normalize();
    this.camEndPos.copy(center).add(this.camEndDir.clone().multiplyScalar(this.camEndDist));
  }

  _onPointerDown(event) {
    // Only raycast on primary left-click
    if (event.button !== 0) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.nodeMeshMap.values());
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const nodeId = hitObject.userData && hitObject.userData.nodeId;
      if (nodeId) {
        this.focusNode(nodeId);
        if (this.onNodeClickCallback) {
          const nodeData = this.nodeDataMap.get(nodeId);
          this.onNodeClickCallback(nodeData);
        }
      }
    }
  }

  _onResize() {
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;

    if (this.camera && this.renderer) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    }
  }

  _animate() {
    requestAnimationFrame(this._boundAnimate);

    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) * 0.001, 0.1);
    this.lastFrameTime = now;
    const timeSec = (now - this.clockStartTime) * 0.001;

    // 1. Camera Transition Kinematics (Quintic Ease-Out + Arc Lerp)
    if (this.isTransitioning) {
      this.transitionProgress += dt / this.transitionDuration;
      const u = Math.min(1.0, this.transitionProgress);

      // Quintic ease out: E(u) = 1 - (1 - u)^5
      const ease = 1 - Math.pow(1 - u, 5);

      // Target position lerp
      this.controls.target.lerpVectors(this.camStartTarget, this.camEndTarget, ease);

      // Slerp direction with obstacle clearing arc lift
      const dir = new Vector3().lerpVectors(this.camStartDir, this.camEndDir, ease).normalize();
      const arcLift = Math.sin(Math.PI * ease) * 25.0; // Arc parabola
      const dist = (1 - ease) * this.camStartDist + ease * this.camEndDist;

      this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(dist));
      this.camera.position.y += arcLift;

      this.controls.syncFromCamera();

      if (u >= 1.0) {
        this.isTransitioning = false;
      }
    } else {
      this.controls.update();
    }

    // 2. Update Dynamic Edges & Real-Time Standing Wave Vibration
    for (const item of this.edgeObjectList) {
      const p1 = item.sourceMesh.position;
      const p2 = item.targetMesh.position;
      const geom = item.geom;
      const posAttr = geom.getAttribute('position');

      if (!item.isCircular) {
        // Straight elastic line
        posAttr.setXYZ(0, p1.x, p1.y, p1.z);
        posAttr.setXYZ(1, p2.x, p2.y, p2.z);
      } else {
        // Active Standing Wave Harmonic Vibration (Lissajous + Jitter)
        const rx = p2.x - p1.x, ry = p2.y - p1.y, rz = p2.z - p1.z;
        const len = Math.hypot(rx, ry, rz) || 1e-6;
        const tx = rx / len, ty = ry / len, tz = rz / len;

        // Transverse normal vector
        let upX = 0, upY = 1, upZ = 0;
        if (Math.abs(ty) > 0.95) { upX = 1; upY = 0; upZ = 0; }

        let nx = ty * upZ - tz * upY;
        let ny = tz * upX - tx * upZ;
        let nz = tx * upY - ty * upX;
        const nLen = Math.hypot(nx, ny, nz) || 1e-6;
        nx /= nLen; ny /= nLen; nz /= nLen;

        // Binormal vector
        const bx = ty * nz - tz * ny;
        const by = tz * nx - tx * nz;
        const bz = tx * ny - ty * nx;

        const f1 = 11.0, f2 = 14.7;
        const amp = 4.2;
        const w1 = 2 * Math.PI * f1 * timeSec;
        const w2 = 2 * Math.PI * f2 * timeSec;

        const oscN = amp * Math.sin(w1);
        const oscB = (amp * 0.7) * Math.cos(w2 + 0.4);
        const jitter = 0.8 * Math.sin(73 * timeSec);

        const K = item.segments;
        for (let k = 0; k <= K; k++) {
          const s = k / K;
          const envelope = Math.sin(Math.PI * s); // Dirichlet boundary: zero at endpoints!
          const dispN = envelope * (oscN + jitter);
          const dispB = envelope * oscB;

          const vx = (1 - s) * p1.x + s * p2.x + dispN * nx + dispB * bx;
          const vy = (1 - s) * p1.y + s * p2.y + dispN * ny + dispB * by;
          const vz = (1 - s) * p1.z + s * p2.z + dispN * nz + dispB * bz;

          posAttr.setXYZ(k, vx, vy, vz);
        }
      }
      posAttr.needsUpdate = true;
    }

    // 3. Render Frame
    this.renderer.render(this.scene, this.camera);
  }
}
