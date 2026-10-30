/**
 * @file src/vault/public/app.js
 * @description Main Web Application Coordinator for the 3D Vault.
 * Bridges backend API endpoints, SpringSimulation elastic physics,
 * Vault3D WebGL renderer, and the slide-out Side Inspection HUD drawer.
 * Pure ESM, zero external runtime dependencies. Runs 100% offline.
 */

import { Vault3D } from './vault-3d.js';
import { SpringSimulation } from '/physics/spring-damper.js';

class VaultApp {
  constructor() {
    this.canvas = document.getElementById('vault-canvas');
    this.vault3D = new Vault3D(this.canvas);
    this.physics = null;
    this.isPhysicsEnabled = true;

    this.currentGraph = null;
    this.currentScenario = 'live_sdd';

    // UI Elements
    this.scenarioSelect = document.getElementById('scenario-select');
    this.btnTogglePhysics = document.getElementById('btn-toggle-physics');
    this.btnResetView = document.getElementById('btn-reset-view');
    this.inputSearch = document.getElementById('input-search');
    this.integrityBadge = document.getElementById('integrity-badge');
    this.integrityText = document.getElementById('integrity-text');

    this.statNodes = document.getElementById('stat-nodes');
    this.statEdges = document.getElementById('stat-edges');
    this.statEnergy = document.getElementById('stat-energy');

    // HUD Elements
    this.hudDrawer = document.getElementById('inspector-hud');
    this.btnCloseHud = document.getElementById('btn-close-hud');
    this.hudTypeBadge = document.getElementById('hud-type-badge');
    this.hudStatusBadge = document.getElementById('hud-status-badge');
    this.hudNodeId = document.getElementById('hud-node-id');
    this.hudTitle = document.getElementById('hud-title');
    this.hudSnippet = document.getElementById('hud-snippet');
    this.sectionGwt = document.getElementById('section-gwt');
    this.hudGwtContent = document.getElementById('hud-gwt-content');
    this.sectionFiles = document.getElementById('section-files');
    this.hudFilesList = document.getElementById('hud-files-list');
    this.sectionIntegrity = document.getElementById('section-integrity');
    this.hudIntegrityWarning = document.getElementById('hud-integrity-warning');
    this.hudIncomingList = document.getElementById('hud-incoming-list');
    this.hudOutgoingList = document.getElementById('hud-outgoing-list');
    this.btnHudConnect = document.getElementById('btn-hud-connect');

    // Creation Modal Elements
    this.btnAddNode = document.getElementById('btn-add-node');
    this.modalAddNode = document.getElementById('modal-add-node');
    this.btnModalClose = document.getElementById('btn-modal-close');
    this.btnModalCancel = document.getElementById('btn-modal-cancel');
    this.formAddNode = document.getElementById('form-add-node');
    this.newNodeId = document.getElementById('new-node-id');
    this.newNodeType = document.getElementById('new-node-type');
    this.newNodeTarget = document.getElementById('new-node-target');
    this.newNodeTitle = document.getElementById('new-node-title');
    this.newNodeSnippet = document.getElementById('new-node-snippet');

    // Connection Elements
    this.btnHudInteractiveConnect = document.getElementById('btn-hud-interactive-connect');
    this.selectHudConnectTarget = document.getElementById('select-hud-connect-target');
    this.btnHudQuickConnect = document.getElementById('btn-hud-quick-connect');

    this.connectModeBanner = document.getElementById('connect-mode-banner');
    this.connectSourceName = document.getElementById('connect-source-name');
    this.btnCancelConnect = document.getElementById('btn-cancel-connect');

    this.isConnectingMode = false;
    this.connectSourceNode = null;
    this.inspectedNode = null;
    this._lastPhysicsTime = performance.now();
  }

  async init() {
    this.vault3D.init();

    this.bindEvents();
    await this.loadScenario(this.currentScenario);

    // Physics step loop
    this.runPhysicsLoop();
  }

  bindEvents() {
    this.scenarioSelect.addEventListener('change', async (e) => {
      this.currentScenario = e.target.value;
      await this.loadScenario(this.currentScenario);
    });

    this.btnTogglePhysics.addEventListener('click', () => {
      this.isPhysicsEnabled = !this.isPhysicsEnabled;
      const textSpan = this.btnTogglePhysics.querySelector('.btn-text');
      const iconSpan = this.btnTogglePhysics.querySelector('.btn-icon');
      if (this.isPhysicsEnabled) {
        textSpan.textContent = 'Pausar Física';
        iconSpan.textContent = '⏸';
      } else {
        textSpan.textContent = 'Retomar Física';
        iconSpan.textContent = '▶';
      }
    });

    this.btnResetView.addEventListener('click', () => {
      this.vault3D.resetView();
    });

    this.inputSearch.addEventListener('input', (e) => {
      this.handleSearch(e.target.value.trim());
    });

    this.inputSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim().toLowerCase();
        if (!query || !this.currentGraph) return;
        const match = this.currentGraph.nodes.find(n =>
          n.id.toLowerCase().includes(query) || (n.title && n.title.toLowerCase().includes(query))
        );
        if (match) {
          this.vault3D.focusNode(match.id);
          this.openInspector(match);
        }
      }
    });

    this.btnCloseHud.addEventListener('click', () => {
      this.closeInspector();
    });

    // Node Creation Modal
    if (this.btnAddNode) {
      this.btnAddNode.addEventListener('click', () => this.openAddNodeModal());
    }
    if (this.btnModalClose) {
      this.btnModalClose.addEventListener('click', () => this.closeAddNodeModal());
    }
    if (this.btnModalCancel) {
      this.btnModalCancel.addEventListener('click', () => this.closeAddNodeModal());
    }
    if (this.formAddNode) {
      this.formAddNode.addEventListener('submit', (e) => this.handleAddNodeSubmit(e));
    }
    if (this.newNodeType) {
      this.newNodeType.addEventListener('change', () => {
        this.newNodeId.value = this.generateNextId(this.newNodeType.value);
      });
    }

    // Connection Mode Handlers
    if (this.btnHudInteractiveConnect) {
      this.btnHudInteractiveConnect.addEventListener('click', () => {
        this.startInteractiveConnect(this.inspectedNode);
      });
    }
    if (this.btnCancelConnect) {
      this.btnCancelConnect.addEventListener('click', () => {
        this.stopInteractiveConnect();
      });
    }
    if (this.btnHudQuickConnect) {
      this.btnHudQuickConnect.addEventListener('click', () => {
        this.handleQuickConnect();
      });
    }

    this.vault3D.onNodeClickCallback = (nodeData) => {
      if (!nodeData) return;

      // If user is in click-to-connect mode:
      if (this.isConnectingMode && this.connectSourceNode) {
        if (nodeData.id === this.connectSourceNode.id) {
          alert('Não é possível conectar um nó a ele mesmo. Clique em outro nó.');
          return;
        }

        const success = this.createConnection(this.connectSourceNode.id, nodeData.id);
        this.stopInteractiveConnect();
        if (success) {
          this.vault3D.focusNode(nodeData.id);
          this.openInspector(nodeData);
        }
        return;
      }

      this.openInspector(nodeData);
    };
  }

  generateNextId(type) {
    if (!this.currentGraph || !this.currentGraph.nodes) return 'NOTA-001';

    const prefixMap = {
      story: 'US-',
      criterion: 'AC-',
      task: 'T-',
      feature: 'FEAT-',
      principle: 'P-',
      file: 'FILE-',
      generic: 'NOTA-'
    };

    const prefix = prefixMap[type] || 'NOTA-';
    let maxNum = 0;

    for (const node of this.currentGraph.nodes) {
      if (!node.id) continue;
      const idUpper = node.id.toUpperCase();
      if (idUpper.startsWith(prefix)) {
        const numPart = idUpper.slice(prefix.length);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }

    const next = maxNum + 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  }

  openAddNodeModal() {
    if (!this.currentGraph) return;

    this.newNodeType.value = 'story';
    this.newNodeId.value = this.generateNextId('story');
    this.newNodeTitle.value = '';
    this.newNodeSnippet.value = '';

    // Populate connect target dropdown with existing nodes
    this.newNodeTarget.innerHTML = '<option value="">(Nenhum - nó independente)</option>';
    for (const n of this.currentGraph.nodes) {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = `${n.id} — ${n.title ? n.title.slice(0, 30) : n.type}`;
      this.newNodeTarget.appendChild(opt);
    }

    // If a node is already inspected, pre-select it as the connection target!
    if (this.inspectedNode) {
      this.newNodeTarget.value = this.inspectedNode.id;
    }

    this.modalAddNode.classList.remove('hidden');
    this.newNodeTitle.focus();
  }

  closeAddNodeModal() {
    this.modalAddNode.classList.add('hidden');
  }

  startInteractiveConnect(sourceNode) {
    if (!sourceNode) return;
    this.isConnectingMode = true;
    this.connectSourceNode = sourceNode;
    this.connectSourceName.textContent = `${sourceNode.id} (${sourceNode.title ? sourceNode.title.slice(0, 20) : sourceNode.type})`;
    this.connectModeBanner.classList.remove('hidden');
    this.closeInspector();
  }

  stopInteractiveConnect() {
    this.isConnectingMode = false;
    this.connectSourceNode = null;
    this.connectModeBanner.classList.add('hidden');
  }

  createConnection(sourceId, targetId, type = 'relates_to') {
    if (!sourceId || !targetId || sourceId === targetId || !this.currentGraph) return false;

    // Check duplicate edge
    const exists = this.currentGraph.edges.some(e =>
      (e.source === sourceId && e.target === targetId) ||
      (e.source === targetId && e.target === sourceId)
    );
    if (exists) {
      alert(`Já existe uma conexão entre "${sourceId}" e "${targetId}".`);
      return false;
    }

    const newEdge = {
      source: sourceId,
      target: targetId,
      type,
      status: 'valid',
      tags: []
    };

    this.currentGraph.edges.push(newEdge);
    this.vault3D.addEdge(newEdge);
    this.syncPhysicsGraph();
    this.updateIntegrityStatus(this.currentGraph);
    return true;
  }

  handleQuickConnect() {
    if (!this.inspectedNode || !this.selectHudConnectTarget) return;
    const targetId = this.selectHudConnectTarget.value;
    if (!targetId) return;

    const success = this.createConnection(this.inspectedNode.id, targetId);
    if (success) {
      this.openInspector(this.inspectedNode);
    }
  }

  handleAddNodeSubmit(e) {
    e.preventDefault();
    if (!this.currentGraph) return;

    const id = this.newNodeId.value.trim() || this.generateNextId(this.newNodeType.value);
    const title = this.newNodeTitle.value.trim();
    const type = this.newNodeType.value || 'story';
    const snippet = this.newNodeSnippet.value.trim() || `Nota criada interativamente no Cofre 3D: ${title}`;
    const targetId = this.newNodeTarget.value;

    if (!title) return;

    // Check duplicate ID
    if (this.currentGraph.nodes.some(n => n.id === id)) {
      alert(`O ID "${id}" já existe no grafo. Gerando novo identificador...`);
      this.newNodeId.value = this.generateNextId(type);
      return;
    }

    // Reference position near target node if connected, or near origin
    let initialPos = {
      x: (Math.random() - 0.5) * 80,
      y: (Math.random() - 0.5) * 80,
      z: (Math.random() - 0.5) * 50
    };
    if (targetId) {
      const parentMesh = this.vault3D.nodeMeshMap.get(targetId);
      if (parentMesh) {
        initialPos = {
          x: parentMesh.position.x + (Math.random() - 0.5) * 60,
          y: parentMesh.position.y + (Math.random() - 0.5) * 60,
          z: parentMesh.position.z + (Math.random() - 0.5) * 40
        };
      }
    }

    const newNode = {
      id,
      title,
      type,
      status: 'valid',
      snippet,
      position: initialPos,
      velocity: { x: 0, y: 0, z: 0 },
      mass: type === 'feature' ? 2.5 : type === 'story' ? 1.8 : 1.0,
      tags: [],
      auditFindings: [],
      metadata: {}
    };

    this.currentGraph.nodes.push(newNode);
    this.vault3D.addNode(newNode);

    if (targetId) {
      const newEdge = {
        source: targetId,
        target: id,
        type: 'relates_to',
        status: 'valid',
        tags: []
      };
      this.currentGraph.edges.push(newEdge);
      this.vault3D.addEdge(newEdge);
    }

    // Synchronize physics
    this.syncPhysicsGraph();
    this.updateIntegrityStatus(this.currentGraph);
    this.closeAddNodeModal();

    // Lerp camera and inspect
    this.vault3D.focusNode(id);
    this.openInspector(newNode);
  }

  syncPhysicsGraph() {
    if (this.physics) {
      const curPositions = this.physics.getNodePositions();
      for (const node of this.currentGraph.nodes) {
        if (curPositions.has(node.id)) {
          const p = curPositions.get(node.id);
          node.position = { x: p.x, y: p.y, z: p.z };
        }
      }
    }

    this.physics = new SpringSimulation(this.currentGraph, {
      kRepulsion: 3500.0,
      softening: 25.0,
      kSpring: 0.22,
      dampingRatio: 0.88,
      restLength: 75.0,
      velocityDamping: 0.15
    });
  }

  async loadScenario(scenarioName) {
    try {
      this.integrityText.textContent = 'Carregando...';
      const url = scenarioName === 'live_sdd'
        ? '/api/graph'
        : `/api/graph?scenario=${encodeURIComponent(scenarioName)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const data = await res.json();
      this.currentGraph = data;

      // Initialize Elastic Physics Engine (Symplectic Euler + Damped Springs)
      this.physics = new SpringSimulation(data, {
        kRepulsion: 3500.0,
        softening: 25.0,
        kSpring: 0.22,
        dampingRatio: 0.88,
        restLength: 75.0,
        velocityDamping: 0.15
      });

      this.vault3D.loadGraph(data);
      this.vault3D._onResize();
      this.updateIntegrityStatus(data);
      this.closeInspector();
    } catch (err) {
      console.error('Failed to load graph scenario:', err);
      this.integrityBadge.className = 'badge badge-circular';
      this.integrityText.textContent = 'Erro ao carregar';
    }
  }

  updateIntegrityStatus(data) {
    const stats = data.stats || {};
    const metadata = data.metadata || {};
    const hasCycles = Boolean(stats.hasCycles || metadata.hasCycles);
    const cycleCount = stats.cycleCount || (metadata.cycles ? metadata.cycles.length : 0);

    if (hasCycles) {
      this.integrityBadge.className = 'badge badge-circular';
      this.integrityText.textContent = `⚠ ${cycleCount} Ciclo(s) Detectado(s)`;
    } else {
      this.integrityBadge.className = 'badge badge-clean';
      this.integrityText.textContent = '✔ Grafo Íntegro (DAG)';
    }

    this.statNodes.textContent = `${stats.nodeCount || data.nodes.length} nós`;
    this.statEdges.textContent = `${stats.edgeCount || data.edges.length} arestas`;
  }

  runPhysicsLoop() {
    const loop = () => {
      requestAnimationFrame(loop);

      const now = performance.now();
      const dt = Math.min((now - this._lastPhysicsTime) * 0.001, 0.05);
      this._lastPhysicsTime = now;

      if (this.isPhysicsEnabled && this.physics) {
        if (!this.physics.isResting()) {
          this.physics.step(dt);
          const positions = this.physics.getNodePositions();
          this.vault3D.updateNodePositions(positions);
          const energy = this.physics.getSimulationEnergy();
          const energyText = (energy && typeof energy.kinetic === 'number') ? energy.kinetic.toFixed(2) : (typeof energy === 'number' ? energy.toFixed(2) : '0.00');
          this.statEnergy.textContent = `Ek: ${energyText}`;
        } else {
          this.statEnergy.textContent = '💤 Em Repouso';
        }
      } else if (!this.isPhysicsEnabled) {
        this.statEnergy.textContent = '⏸ Pausada';
      }
    };
    requestAnimationFrame(loop);
  }

  openInspector(node) {
    if (!node) return;
    this.inspectedNode = node;

    this.hudNodeId.textContent = node.id;
    this.hudTypeBadge.textContent = node.type || 'NÓ';
    this.hudTypeBadge.className = `badge type-${node.type || 'generic'}`;

    const isCircular = node.status === 'circular' || (node.tags && node.tags.includes('CIRCULAR_DEPENDENCY'));
    this.hudStatusBadge.textContent = node.status || 'valid';
    this.hudStatusBadge.className = `badge ${isCircular ? 'badge-circular' : 'badge-clean'}`;

    this.hudTitle.textContent = node.title || '(sem título)';
    this.hudSnippet.textContent = node.snippet || '(sem descrição adicional)';

    // GWT Clauses
    const isAc = node.type === 'criterion' || node.id.startsWith('AC-');
    if (isAc && node.snippet && /Dado|Quando|Então|Entao/i.test(node.snippet)) {
      this.sectionGwt.classList.remove('hidden');
      this.hudGwtContent.textContent = node.snippet;
    } else {
      this.sectionGwt.classList.add('hidden');
    }

    // Linked files
    const files = (node.metadata && node.metadata.files) || [];
    if (files.length > 0) {
      this.sectionFiles.classList.remove('hidden');
      this.hudFilesList.innerHTML = '';
      for (const f of files) {
        const li = document.createElement('li');
        li.textContent = `📄 ${f}`;
        this.hudFilesList.appendChild(li);
      }
    } else {
      this.sectionFiles.classList.add('hidden');
    }

    // Integrity Audit Alert
    if (isCircular) {
      this.sectionIntegrity.classList.remove('hidden');
      const cycles = (this.currentGraph && this.currentGraph.metadata && this.currentGraph.metadata.cycles) || [];
      const nodeCycles = cycles.filter(c => c.includes(node.id));
      let alertMsg = `<strong>🚨 Violação de Integridade: Dependência Circular!</strong><br>Este nó participa de um ciclo direcionado que bloqueia a execução paralela de tarefas.<br>`;
      if (nodeCycles.length > 0) {
        alertMsg += `<div style="margin-top:6px; font-family:var(--font-mono); font-size:11px;">Ciclo: ${nodeCycles[0].join(' ➔ ')}</div>`;
      }
      this.hudIntegrityWarning.innerHTML = alertMsg;
    } else {
      this.sectionIntegrity.classList.add('hidden');
    }

    // Connections
    const incoming = (this.currentGraph.edges || []).filter(e => e.target === node.id);
    const outgoing = (this.currentGraph.edges || []).filter(e => e.source === node.id);

    this.hudIncomingList.innerHTML = incoming.length > 0 ? '' : '<li style="cursor:default; opacity:0.6;">(nenhuma)</li>';
    for (const e of incoming) {
      const li = document.createElement('li');
      li.textContent = `← ${e.source} [${e.type || 'ref'}]`;
      li.addEventListener('click', () => {
        this.vault3D.focusNode(e.source);
        const targetNode = this.currentGraph.nodes.find(n => n.id === e.source);
        if (targetNode) this.openInspector(targetNode);
      });
      this.hudIncomingList.appendChild(li);
    }

    this.hudOutgoingList.innerHTML = outgoing.length > 0 ? '' : '<li style="cursor:default; opacity:0.6;">(nenhuma)</li>';
    for (const e of outgoing) {
      const li = document.createElement('li');
      li.textContent = `→ ${e.target} [${e.type || 'ref'}]`;
      li.addEventListener('click', () => {
        this.vault3D.focusNode(e.target);
        const targetNode = this.currentGraph.nodes.find(n => n.id === e.target);
        if (targetNode) this.openInspector(targetNode);
      });
      this.hudOutgoingList.appendChild(li);
    }

    // Populate quick-connect target select with other nodes
    if (this.selectHudConnectTarget && this.currentGraph) {
      this.selectHudConnectTarget.innerHTML = '';
      const otherNodes = (this.currentGraph.nodes || []).filter(n => n.id !== node.id);
      for (const n of otherNodes) {
        const opt = document.createElement('option');
        opt.value = n.id;
        opt.textContent = `${n.id} — ${n.title ? n.title.slice(0, 22) : n.type}`;
        this.selectHudConnectTarget.appendChild(opt);
      }
    }

    this.hudDrawer.classList.remove('closed');
  }

  closeInspector() {
    this.hudDrawer.classList.add('closed');
  }

  handleSearch(query) {
    if (!this.currentGraph) return;
    const q = (query || '').toLowerCase().trim();

    const matchingNodeIds = new Set();
    for (const node of this.currentGraph.nodes) {
      const mesh = this.vault3D.nodeMeshMap.get(node.id);
      const label = this.vault3D.nodeLabelMap.get(node.id);
      const matches = !q || node.id.toLowerCase().includes(q) || (node.title && node.title.toLowerCase().includes(q));
      if (matches) {
        matchingNodeIds.add(node.id);
      }
      if (mesh && label) {
        mesh.material.opacity = matches ? 1.0 : 0.2;
        label.material.opacity = matches ? 1.0 : 0.2;
      }
    }

    if (this.vault3D.edgeObjectList) {
      for (const item of this.vault3D.edgeObjectList) {
        if (!item.line || !item.line.material) continue;
        const defaultOpacity = item.isCircular ? 1.0 : 0.65;
        if (!q) {
          item.line.material.opacity = defaultOpacity;
        } else {
          const edgeMatches = matchingNodeIds.has(item.edge.source) && matchingNodeIds.has(item.edge.target);
          item.line.material.opacity = edgeMatches ? defaultOpacity : 0.1;
        }
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new VaultApp();
  app.init().catch(err => console.error('Error starting VaultApp:', err));
});
