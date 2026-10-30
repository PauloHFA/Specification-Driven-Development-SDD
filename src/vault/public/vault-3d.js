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
  MeshBasicMaterial,
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
 * Creates a high-DPI text canvas texture for a billboard label with Retina sharpness.
 */
function createTextSprite(text, color = '#f8fafc', bgColor = 'rgba(11, 16, 28, 0.90)', borderColor = 'rgba(56, 189, 248, 0.35)') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // High-DPI Rounded rectangle pill
  const r = 32, x = 8, y = 16, w = 496, h = 96;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // Typography with glowing neon text
  ctx.font = '600 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillText(text, 256, 64);

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, transparent: true });
  const sprite = new Sprite(material);
  sprite.scale.set(38, 9.5, 1);
  return sprite;
}

function createOrbitRing(radius, color = 0x8b5cf6) {
  const points = [];
  const segments = 36;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  const geom = new BufferGeometry().setFromPoints(points);
  const mat = new LineBasicMaterial({ color, opacity: 0.45, transparent: true, linewidth: 1.5 });
  return new Line(geom, mat);
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
    this.onNodeDragCallback = null;
    this.onNodeDragEndCallback = null;

    // 3D Node Drag State (Shift + Drag)
    this.isDraggingNode = false;
    this.draggedNodeId = null;
    this.dragPlanePoint = new Vector3();
    this.dragPlaneNormal = new Vector3();

    // Legend Type Filtering State
    this.hiddenTypes = new Set();

    // Shared Pulse Geometry for Directional Data Flow
    this.pulseGeometry = new SphereGeometry(2.1, 10, 8);

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
    this._boundOnPointerMove = this._onPointerMove.bind(this);
    this._boundOnPointerUp = this._onPointerUp.bind(this);
    this._boundOnResize = this._onResize.bind(this);
  }

  _getContainerDimensions() {
    const parent = this.canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    const w = Math.floor(rect.width) || window.innerWidth || 800;
    const h = Math.floor(rect.height) || window.innerHeight || 600;
    return { width: Math.max(w, 320), height: Math.max(h, 240) };
  }

  init() {
    const dims = this._getContainerDimensions();
    this.width = dims.width;
    this.height = dims.height;

    this.scene = new Scene();
    this.scene.background = new Color(0x070b14);

    this.camera = new PerspectiveCamera(50, this.width / this.height, 1, 5000);
    this.camera.position.set(0, 80, 380);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(this.width, this.height, false);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 3500;

    // Lighting
    const ambientLight = new AmbientLight(0xffffff, 1.4);
    this.scene.add(ambientLight);

    const dirLight1 = new DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(200, 400, 300);
    this.scene.add(dirLight1);

    const dirLight2 = new DirectionalLight(0x38bdf8, 0.7);
    dirLight2.position.set(-200, 200, 200);
    this.scene.add(dirLight2);

    this.scene.add(this.edgeGroup);
    this.scene.add(this.nodeGroup);
    this._buildHolographicBaseGrid();

    this.canvas.addEventListener('pointerdown', this._boundOnPointerDown);
    window.addEventListener('pointermove', this._boundOnPointerMove);
    window.addEventListener('pointerup', this._boundOnPointerUp);
    window.addEventListener('resize', this._boundOnResize);

    // Initial resize sync after layout
    setTimeout(() => this._onResize(), 50);

    requestAnimationFrame(this._boundAnimate);
  }

  _buildHolographicBaseGrid() {
    const gridGroup = new Group();
    const yLevel = -160;

    // Concentric spatial rings
    const radii = [140, 280, 440, 640];
    for (const r of radii) {
      const points = [];
      const segments = 48;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new Vector3(Math.cos(theta) * r, yLevel, Math.sin(theta) * r));
      }
      const geom = new BufferGeometry().setFromPoints(points);
      const mat = new LineBasicMaterial({
        color: 0x38bdf8,
        opacity: 0.15,
        transparent: true
      });
      gridGroup.add(new Line(geom, mat));
    }

    // Cross axes
    const axisX = [new Vector3(-650, yLevel, 0), new Vector3(650, yLevel, 0)];
    gridGroup.add(new Line(new BufferGeometry().setFromPoints(axisX), new LineBasicMaterial({ color: 0x8b5cf6, opacity: 0.15, transparent: true })));

    const axisZ = [new Vector3(0, yLevel, -650), new Vector3(0, yLevel, 650)];
    gridGroup.add(new Line(new BufferGeometry().setFromPoints(axisZ), new LineBasicMaterial({ color: 0x8b5cf6, opacity: 0.15, transparent: true })));

    this.scene.add(gridGroup);
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
      const radius = node.type === 'feature' ? 10 : node.type === 'story' ? 8 : 6.5;
      const isCircular = node.status === 'circular' || (node.tags && node.tags.includes('CIRCULAR_DEPENDENCY'));

      const nodeColorHex = isCircular ? COLOR_CYCLIC_NODE : (TYPE_COLORS[node.type] || TYPE_COLORS.generic);

      const geometry = new SphereGeometry(radius, 24, 18);
      const material = new MeshPhongMaterial({
        color: nodeColorHex,
        emissive: isCircular ? 0x991b1b : 0x223355,
        shininess: 60
      });

      const mesh = new Mesh(geometry, material);
      if (node.type === 'feature') {
        const ring = createOrbitRing(radius * 1.6, nodeColorHex);
        mesh.add(ring);
      }
      const hasPos = node.position && (node.position.x !== 0 || node.position.y !== 0 || node.position.z !== 0);
      const pos = hasPos
        ? node.position
        : {
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 150,
            z: (Math.random() - 0.5) * 80
          };
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

    // 2. Build Edge Connections & Directional Flow Pulses
    let edgeIdx = 0;
    for (const edge of edges) {
      this._createEdgeVisual(edge, edgeIdx++);
    }

    this.resetView();
  }

  _createPulseMesh(isCircular) {
    const mat = new MeshPhongMaterial({
      color: isCircular ? 0xff4444 : 0x7dd3fc,
      emissive: isCircular ? 0xdc2626 : 0x0284c7,
      shininess: 90,
      transparent: true,
      opacity: 0.95
    });
    const pulseMesh = new Mesh(this.pulseGeometry, mat);
    this.edgeGroup.add(pulseMesh);
    return pulseMesh;
  }

  _createEdgeVisual(edge, index = 0) {
    const srcNode = this.nodeMeshMap.get(edge.source);
    const tgtNode = this.nodeMeshMap.get(edge.target);
    if (!srcNode || !tgtNode) return;

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

    const pulseMesh = this._createPulseMesh(isCircular);
    pulseMesh.position.copy(srcNode.position);

    this.edgeObjectList.push({
      line,
      geom,
      pulseMesh,
      phaseOffset: (index * 0.29) % 1.0,
      edge,
      sourceMesh: srcNode,
      targetMesh: tgtNode,
      isCircular,
      segments
    });
  }

  addNode(node) {
    if (!node || !node.id) return;
    this.nodeDataMap.set(node.id, node);

    const radius = node.type === 'feature' ? 10 : node.type === 'story' ? 8 : 6.5;
    const isCircular = node.status === 'circular' || (node.tags && node.tags.includes('CIRCULAR_DEPENDENCY'));
    const nodeColorHex = isCircular ? COLOR_CYCLIC_NODE : (TYPE_COLORS[node.type] || TYPE_COLORS.generic);

    const geometry = new SphereGeometry(radius, 24, 18);
    const material = new MeshPhongMaterial({
      color: nodeColorHex,
      emissive: isCircular ? 0x991b1b : 0x223355,
      shininess: 60
    });

    const mesh = new Mesh(geometry, material);
    if (node.type === 'feature') {
      const ring = createOrbitRing(radius * 1.6, nodeColorHex);
      mesh.add(ring);
    }
    const pos = node.position || {
      x: (Math.random() - 0.5) * 120,
      y: (Math.random() - 0.5) * 100,
      z: (Math.random() - 0.5) * 60
    };
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.userData = { nodeId: node.id, isCircular };

    this.nodeGroup.add(mesh);
    this.nodeMeshMap.set(node.id, mesh);

    const labelText = node.id;
    const sprite = createTextSprite(labelText, isCircular ? '#fca5a5' : '#f8fafc');
    sprite.position.set(pos.x, pos.y + radius + 7, pos.z);
    this.nodeGroup.add(sprite);
    this.nodeLabelMap.set(node.id, sprite);

    if (node.pinned) {
      this.setNodePinnedVisual(node.id, true);
    }
  }

  addEdge(edge) {
    if (!edge || !edge.source || !edge.target) return;
    this._createEdgeVisual(edge, this.edgeObjectList.length);
  }

  removeNode(nodeId) {
    const mesh = this.nodeMeshMap.get(nodeId);
    if (mesh) {
      this.nodeGroup.remove(mesh);
      this.nodeMeshMap.delete(nodeId);
    }
    const label = this.nodeLabelMap.get(nodeId);
    if (label) {
      this.nodeGroup.remove(label);
      this.nodeLabelMap.delete(nodeId);
    }
    this.nodeDataMap.delete(nodeId);

    const remainingEdges = [];
    for (const item of this.edgeObjectList) {
      if (item.edge.source === nodeId || item.edge.target === nodeId) {
        this.edgeGroup.remove(item.line);
        if (item.pulseMesh) this.edgeGroup.remove(item.pulseMesh);
      } else {
        remainingEdges.push(item);
      }
    }
    this.edgeObjectList = remainingEdges;
  }

  removeEdge(sourceId, targetId) {
    const remainingEdges = [];
    for (const item of this.edgeObjectList) {
      if (item.edge.source === sourceId && item.edge.target === targetId) {
        this.edgeGroup.remove(item.line);
        if (item.pulseMesh) this.edgeGroup.remove(item.pulseMesh);
      } else {
        remainingEdges.push(item);
      }
    }
    this.edgeObjectList = remainingEdges;
  }

  setNodePinnedVisual(nodeId, isPinned) {
    const mesh = this.nodeMeshMap.get(nodeId);
    if (!mesh) return;
    const radius = mesh.geometry ? mesh.geometry.radius || 7 : 7;

    if (isPinned) {
      if (!mesh.userData.pinRing) {
        const pinRing = createOrbitRing(radius * 1.45, 0xf59e0b);
        pinRing.rotation.x = Math.PI * 0.25;
        mesh.add(pinRing);
        mesh.userData.pinRing = pinRing;
      }
      mesh.userData.pinRing.visible = true;
    } else if (mesh.userData.pinRing) {
      mesh.userData.pinRing.visible = false;
    }
  }

  setTypeFilter(hiddenTypesSet) {
    this.hiddenTypes = new Set(hiddenTypesSet);

    for (const [id, mesh] of this.nodeMeshMap.entries()) {
      const nodeData = this.nodeDataMap.get(id) || {};
      const nType = nodeData.type || 'generic';
      const isCircular = Boolean(mesh.userData && mesh.userData.isCircular);

      let isHidden = this.hiddenTypes.has(nType);
      if (isCircular && this.hiddenTypes.has('circular')) {
        isHidden = true;
      }

      mesh.visible = !isHidden;
      const label = this.nodeLabelMap.get(id);
      if (label) label.visible = !isHidden;
    }

    for (const item of this.edgeObjectList) {
      const visible = item.sourceMesh.visible && item.targetMesh.visible;
      item.line.visible = visible;
      if (item.pulseMesh) item.pulseMesh.visible = visible;
    }
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

    const curOffset = new Vector3().subVectors(this.camStartPos, this.camStartTarget);
    this.camStartDist = Math.max(30, curOffset.length());

    this.camStartDir.copy(curOffset).normalize();
    if (this.camStartDir.lengthSq() < 0.001) this.camStartDir.set(0, 0.35, 0.92).normalize();

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
    const meshes = Array.from(this.nodeMeshMap.values()).filter(m => m.visible);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const nodeId = hitObject.userData && hitObject.userData.nodeId;
      if (nodeId) {
        // Shift + Drag initiates 3D Spatial Node Dragging
        if (event.shiftKey) {
          this.isDraggingNode = true;
          this.draggedNodeId = nodeId;
          this.dragPlanePoint.copy(hitObject.position);
          this.dragPlaneNormal.subVectors(this.camera.position, this.controls.target).normalize();
          if (this.dragPlaneNormal.lengthSq() === 0) this.dragPlaneNormal.set(0, 0, 1);

          this.controls.enabled = false;
          this.isTransitioning = false;
          this.canvas.style.cursor = 'grabbing';

          if (this.onNodeClickCallback) {
            const nodeData = this.nodeDataMap.get(nodeId);
            this.onNodeClickCallback(nodeData);
          }
          return;
        }

        this.focusNode(nodeId);
        if (this.onNodeClickCallback) {
          const nodeData = this.nodeDataMap.get(nodeId);
          this.onNodeClickCallback(nodeData);
        }
      }
    }
  }

  _onPointerMove(event) {
    if (!this.isDraggingNode || !this.draggedNodeId) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const denom = this.raycaster.direction.dot(this.dragPlaneNormal);
    if (Math.abs(denom) > 1e-5) {
      const diff = new Vector3().subVectors(this.dragPlanePoint, this.raycaster.origin);
      const t = diff.dot(this.dragPlaneNormal) / denom;
      if (t > 0) {
        const newPos = this.raycaster.origin.clone().add(this.raycaster.direction.clone().multiplyScalar(t));
        const mesh = this.nodeMeshMap.get(this.draggedNodeId);
        const label = this.nodeLabelMap.get(this.draggedNodeId);
        if (mesh) {
          mesh.position.copy(newPos);
          if (label) {
            const r = mesh.geometry ? mesh.geometry.radius || 6 : 6;
            label.position.set(newPos.x, newPos.y + r + 7, newPos.z);
          }
        }
        if (this.onNodeDragCallback) {
          this.onNodeDragCallback(this.draggedNodeId, newPos);
        }
      }
    }
  }

  _onPointerUp() {
    if (!this.isDraggingNode) return;
    const nodeId = this.draggedNodeId;
    const mesh = nodeId ? this.nodeMeshMap.get(nodeId) : null;
    this.isDraggingNode = false;
    this.draggedNodeId = null;
    if (this.controls) this.controls.enabled = true;
    this.canvas.style.cursor = 'default';

    if (nodeId && mesh && this.onNodeDragEndCallback) {
      this.onNodeDragEndCallback(nodeId, mesh.position.clone());
    }
  }

  _onResize() {
    const dims = this._getContainerDimensions();
    this.width = dims.width;
    this.height = dims.height;

    if (this.camera && this.renderer) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height, false);
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
      const arcLift = Math.sin(Math.PI * ease) * 20.0; // Arc parabola
      const dist = (1 - ease) * this.camStartDist + ease * this.camEndDist;

      this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(dist));
      this.camera.position.y += arcLift;

      this.camera.lookAt(this.controls.target);
      this.controls.syncFromCamera();

      if (u >= 1.0) {
        this.isTransitioning = false;
      }
    } else {
      this.controls.update();
    }

    // 2. Update Dynamic Edges, Standing Wave Vibration & Directional Flow Pulses
    for (const item of this.edgeObjectList) {
      const p1 = item.sourceMesh.position;
      const p2 = item.targetMesh.position;
      const geom = item.geom;
      const posAttr = geom.getAttribute('position');

      // Compute directional pulse progress s in [0, 1] from source -> target
      const speed = item.isCircular ? 1.1 : 0.42;
      const pulseT = (timeSec * speed + (item.phaseOffset || 0)) % 1.0;

      if (!item.isCircular) {
        // Straight elastic line
        posAttr.setXYZ(0, p1.x, p1.y, p1.z);
        posAttr.setXYZ(1, p2.x, p2.y, p2.z);

        if (item.pulseMesh && item.line.visible) {
          item.pulseMesh.position.set(
            (1 - pulseT) * p1.x + pulseT * p2.x,
            (1 - pulseT) * p1.y + pulseT * p2.y,
            (1 - pulseT) * p1.z + pulseT * p2.z
          );
        }
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

        if (item.pulseMesh && item.line.visible) {
          const pEnv = Math.sin(Math.PI * pulseT);
          const pDispN = pEnv * (oscN + jitter);
          const pDispB = pEnv * oscB;
          item.pulseMesh.position.set(
            (1 - pulseT) * p1.x + pulseT * p2.x + pDispN * nx + pDispB * bx,
            (1 - pulseT) * p1.y + pulseT * p2.y + pDispN * ny + pDispB * by,
            (1 - pulseT) * p1.z + pulseT * p2.z + pDispN * nz + pDispB * bz
          );
        }
      }
      posAttr.needsUpdate = true;
    }

    // 3. Render Frame
    this.renderer.render(this.scene, this.camera);
  }
}
