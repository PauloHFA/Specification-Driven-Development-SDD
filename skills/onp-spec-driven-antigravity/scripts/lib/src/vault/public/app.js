/**
 * @file src/vault/public/app.js
 * @description Main Web Application Coordinator for the 3D Vault.
 * Bridges backend API endpoints, SpringSimulation elastic physics,
 * Vault3D WebGL renderer, interactive legend filters, 3D node dragging/pinning,
 * bidirectional persistence (.spec/vault-custom.json + localStorage + Markdown export),
 * and real-time Server-Sent Events (SSE) hot-reload.
 * Pure ESM, zero external runtime dependencies. Runs 100% offline.
 */

import { Vault3D } from './vault-3d.js';
import { SpringSimulation } from '/physics/spring-damper.js';

const STORAGE_KEY = 'sdd_vault_custom_graph_v1';

class VaultApp {
  constructor() {
    this.canvas = document.getElementById('vault-canvas');
    this.vault3D = new Vault3D(this.canvas);
    this.physics = null;
    this.isPhysicsEnabled = true;

    this.currentGraph = null;
    this.currentScenario = 'live_sdd';
    this.hiddenTypes = new Set();
    this.customNodes = [];
    this.customEdges = [];
    this.deletedNodeIds = new Set();

    // UI Elements
    this.scenarioSelect = document.getElementById('scenario-select');
    this.btnTogglePhysics = document.getElementById('btn-toggle-physics');
    this.btnResetView = document.getElementById('btn-reset-view');
    this.btnExportGraph = document.getElementById('btn-export-graph');
    this.inputSearch = document.getElementById('input-search');
    this.integrityBadge = document.getElementById('integrity-badge');
    this.integrityText = document.getElementById('integrity-text');

    this.statNodes = document.getElementById('stat-nodes');
    this.statEdges = document.getElementById('stat-edges');
    this.statEnergy = document.getElementById('stat-energy');

    // Toast Notification
    this.toastBanner = document.getElementById('toast-notification');
    this.toastText = document.getElementById('toast-text');
    this._toastTimer = null;

    // Legend Filter Elements
    this.legendPills = document.querySelectorAll('.filter-pill[data-filter-type]');
    this.btnLegendReset = document.getElementById('btn-legend-reset');

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

    // HUD Action Buttons
    this.btnHudInteractiveConnect = document.getElementById('btn-hud-interactive-connect');
    this.selectHudConnectTarget = document.getElementById('select-hud-connect-target');
    this.btnHudQuickConnect = document.getElementById('btn-hud-quick-connect');
    this.btnHudPinNode = document.getElementById('btn-hud-pin-node');
    this.btnHudDeleteNode = document.getElementById('btn-hud-delete-node');

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

    // Connection Mode Banner
    this.connectModeBanner = document.getElementById('connect-mode-banner');
    this.connectSourceName = document.getElementById('connect-source-name');
    this.btnCancelConnect = document.getElementById('btn-cancel-connect');

    this.isConnectingMode = false;
    this.connectSourceNode = null;
    this.inspectedNode = null;
    this._lastPhysicsTime = performance.now();
    this.eventSource = null;
  }

  async init() {
    this.vault3D.init();

    this.bindEvents();
    await this.loadCustomState();
    await this.loadScenario(this.currentScenario);
    this.initLiveHotReload();

    // Physics step loop
    this.runPhysicsLoop();
  }

  showToast(message, durationMs = 2800) {
    if (!this.toastBanner || !this.toastText) return;
    this.toastText.textContent = message;
    this.toastBanner.classList.remove('hidden');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastBanner.classList.add('hidden');
    }, durationMs);
  }

  async loadCustomState() {
    // 1. Load from localStorage fallback
    try {
      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (Array.isArray(parsed.nodes)) this.customNodes = parsed.nodes;
        if (Array.isArray(parsed.edges)) this.customEdges = parsed.edges;
      }
    } catch {
      // Ignore storage error
    }

    // 2. Sync from disk (.spec/vault-custom.json) via API
    try {
      const res = await fetch('/api/graph/custom');
      if (res.ok) {
        const diskData = await res.json();
        if (Array.isArray(diskData.nodes) && diskData.nodes.length > 0) {
          this.customNodes = diskData.nodes;
        }
        if (Array.isArray(diskData.edges) && diskData.edges.length > 0) {
          this.customEdges = diskData.edges;
        }
      }
    } catch {
      // Offline fallback uses localStorage
    }
  }

  async persistCustomState() {
    const payload = {
      nodes: this.customNodes,
      edges: this.customEdges
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore localStorage quota
    }

    try {
      await fetch('/api/graph/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      // Ignore network error if offline
    }
  }

  initLiveHotReload() {
    if (typeof EventSource === 'undefined') return;
    try {
      this.eventSource = new EventSource('/api/events');
      this.eventSource.addEventListener('spec-changed', async (e) => {
        if (this.currentScenario !== 'live_sdd') return;
        try {
          const info = JSON.parse(e.data || '{}');
          // Avoid self-triggering reload when vault-custom.json is written by us
          if (info.filename && info.filename.includes('vault-custom.json')) return;
          await this.loadScenario('live_sdd', { preserveCamera: true });
          this.showToast(`⚡ Hot-Reload: ${info.filename || '.spec/'} atualizado em tempo real!`);
        } catch {
          // Ignore parse error
        }
      });
    } catch {
      // SSE optional
    }
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
        if (this.physics) this.physics.wake();
      } else {
        textSpan.textContent = 'Retomar Física';
        iconSpan.textContent = '▶';
      }
    });

    this.btnResetView.addEventListener('click', () => {
      this.vault3D.resetView();
    });

    if (this.btnExportGraph) {
      this.btnExportGraph.addEventListener('click', () => {
        this.exportAndSaveGraph();
      });
    }

    // Interactive Legend Filter Pills
    for (const pill of this.legendPills) {
      pill.addEventListener('click', () => {
        const type = pill.getAttribute('data-filter-type');
        if (!type) return;
        if (this.hiddenTypes.has(type)) {
          this.hiddenTypes.delete(type);
          pill.classList.remove('filter-off');
        } else {
          this.hiddenTypes.add(type);
          pill.classList.add('filter-off');
        }
        this.vault3D.setTypeFilter(this.hiddenTypes);
      });
    }

    if (this.btnLegendReset) {
      this.btnLegendReset.addEventListener('click', () => {
        this.hiddenTypes.clear();
        for (const pill of this.legendPills) {
          pill.classList.remove('filter-off');
        }
        this.vault3D.setTypeFilter(this.hiddenTypes);
        this.showToast('🎯 Todos os filtros de camadas ativados');
      });
    }

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

    // Connection & Node Control Handlers
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
    if (this.btnHudPinNode) {
      this.btnHudPinNode.addEventListener('click', () => {
        this.togglePinInspectedNode();
      });
    }
    if (this.btnHudDeleteNode) {
      this.btnHudDeleteNode.addEventListener('click', () => {
        if (this.inspectedNode) {
          this.deleteNode(this.inspectedNode.id);
        }
      });
    }

    // 3D Node Click & Drag Callbacks
    this.vault3D.onNodeClickCallback = (nodeData) => {
      if (!nodeData) return;

      if (this.isConnectingMode && this.connectSourceNode) {
        if (nodeData.id === this.connectSourceNode.id) {
          this.showToast('⚠ Clique em um nó diferente para conectar');
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

    this.vault3D.onNodeDragCallback = (nodeId, newPos) => {
      if (this.physics) {
        this.physics.setNodePosition(nodeId, newPos);
        this.physics.pinNode(nodeId, true);
      }
      const node = this.currentGraph?.nodes.find(n => n.id === nodeId);
      if (node) {
        node.position = { x: newPos.x, y: newPos.y, z: newPos.z };
      }
    };

    this.vault3D.onNodeDragEndCallback = (nodeId, finalPos) => {
      const node = this.currentGraph?.nodes.find(n => n.id === nodeId);
      if (node) {
        node.position = { x: finalPos.x, y: finalPos.y, z: finalPos.z };
        if (this.physics && !node.pinned) {
          this.physics.unpinNode(nodeId);
        }
      }
      this.showToast(`📌 Nó ${nodeId} reposicionado no espaço 3D`);
    };

    // Global Keyboard Navigation
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== this.inputSearch &&
          document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.inputSearch.focus();
        this.inputSearch.select();
        return;
      }

      if (e.key === 'Escape') {
        if (this.isConnectingMode) {
          this.stopInteractiveConnect();
          return;
        }
        if (this.modalAddNode && !this.modalAddNode.classList.contains('hidden')) {
          this.closeAddNodeModal();
          return;
        }
        if (this.hudDrawer && !this.hudDrawer.classList.contains('closed')) {
          this.closeInspector();
          return;
        }
        if (document.activeElement === this.inputSearch) {
          this.inputSearch.blur();
          return;
        }
      }
    });
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

    this.newNodeTarget.innerHTML = '<option value="">(Nenhum - nó independente)</option>';
    for (const n of this.currentGraph.nodes) {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = `${n.id} — ${n.title ? n.title.slice(0, 30) : n.type}`;
      this.newNodeTarget.appendChild(opt);
    }

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

    const exists = this.currentGraph.edges.some(e =>
      (e.source === sourceId && e.target === targetId) ||
      (e.source === targetId && e.target === sourceId)
    );
    if (exists) {
      this.showToast(`⚠ Conexão entre ${sourceId} e ${targetId} já existe`);
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
    this.customEdges.push(newEdge);
    this.vault3D.addEdge(newEdge);
    this.syncPhysicsGraph();
    this.updateIntegrityStatus(this.currentGraph);
    this.persistCustomState();
    this.showToast(`🔗 Conexão criada: ${sourceId} → ${targetId}`);
    return true;
  }

  removeConnection(sourceId, targetId) {
    if (!this.currentGraph) return;
    this.currentGraph.edges = this.currentGraph.edges.filter(
      e => !(e.source === sourceId && e.target === targetId)
    );
    this.customEdges = this.customEdges.filter(
      e => !(e.source === sourceId && e.target === targetId)
    );
    this.vault3D.removeEdge(sourceId, targetId);
    if (this.physics) {
      this.physics.removeEdge(sourceId, targetId);
    }
    this.updateIntegrityStatus(this.currentGraph);
    this.persistCustomState();
    if (this.inspectedNode) {
      this.openInspector(this.inspectedNode);
    }
    this.showToast(`✂️ Conexão ${sourceId} → ${targetId} removida`);
  }

  deleteNode(nodeId) {
    if (!this.currentGraph || !nodeId) return;
    this.deletedNodeIds.add(nodeId);
    this.currentGraph.nodes = this.currentGraph.nodes.filter(n => n.id !== nodeId);
    this.currentGraph.edges = this.currentGraph.edges.filter(
      e => e.source !== nodeId && e.target !== nodeId
    );
    this.customNodes = this.customNodes.filter(n => n.id !== nodeId);
    this.customEdges = this.customEdges.filter(
      e => e.source !== nodeId && e.target !== nodeId
    );

    this.vault3D.removeNode(nodeId);
    if (this.physics) {
      this.physics.removeNode(nodeId);
    }

    this.closeInspector();
    this.updateIntegrityStatus(this.currentGraph);
    this.persistCustomState();
    this.showToast(`🗑️ Nó ${nodeId} excluído do grafo`);
  }

  togglePinInspectedNode() {
    if (!this.inspectedNode) return;
    this.inspectedNode.pinned = !this.inspectedNode.pinned;
    const isPinned = Boolean(this.inspectedNode.pinned);

    if (this.physics) {
      this.physics.pinNode(this.inspectedNode.id, isPinned);
    }
    this.vault3D.setNodePinnedVisual(this.inspectedNode.id, isPinned);
    this.updatePinButtonUI(isPinned);
    this.persistCustomState();
    this.showToast(isPinned
      ? `📌 Posição de ${this.inspectedNode.id} fixada no espaço 3D`
      : `🔓 Posição de ${this.inspectedNode.id} liberada para física elástica`
    );
  }

  updatePinButtonUI(isPinned) {
    if (!this.btnHudPinNode) return;
    if (isPinned) {
      this.btnHudPinNode.textContent = '📌 Posição Fixada';
      this.btnHudPinNode.classList.add('btn-pinned');
    } else {
      this.btnHudPinNode.textContent = '📌 Fixar Posição';
      this.btnHudPinNode.classList.remove('btn-pinned');
    }
  }

  async exportAndSaveGraph() {
    if (!this.currentGraph) return;
    await this.persistCustomState();

    // Build Markdown SDD summary
    const lines = [
      `# Exportação do Cofre 3D — Spatial Knowledge Graph`,
      ``,
      `- **Gerado em:** ${new Date().toISOString()}`,
      `- **Cenário:** ${this.currentScenario}`,
      `- **Total de Nós:** ${this.currentGraph.nodes.length}`,
      `- **Total de Arestas:** ${this.currentGraph.edges.length}`,
      ``,
      `## Nós do Grafo`,
      ``
    ];

    for (const n of this.currentGraph.nodes) {
      lines.push(`### [${n.id}] ${n.title || '(sem título)'} (\`${n.type}\`)`);
      if (n.snippet) {
        lines.push(`${n.snippet}`);
      }
      lines.push(``);
    }

    lines.push(`## Conexões Direcionadas (DAG / Relações)`);
    lines.push(``);
    for (const e of this.currentGraph.edges) {
      lines.push(`- \`${e.source}\` ➔ \`${e.target}\` (${e.type || 'ref'})`);
    }

    const mdContent = lines.join('\n');
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vault-sdd-graph-${this.currentScenario}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('💾 Salvo em .spec/vault-custom.json e exportado em Markdown (.md)!');
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

    if (this.currentGraph.nodes.some(n => n.id === id)) {
      this.newNodeId.value = this.generateNextId(type);
      return;
    }

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
      metadata: { custom: true }
    };

    this.currentGraph.nodes.push(newNode);
    this.customNodes.push(newNode);
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
      this.customEdges.push(newEdge);
      this.vault3D.addEdge(newEdge);
    }

    this.syncPhysicsGraph();
    this.updateIntegrityStatus(this.currentGraph);
    this.persistCustomState();
    this.closeAddNodeModal();

    this.vault3D.focusNode(id);
    this.openInspector(newNode);
    this.showToast(`🚀 Nó ${id} criado e salvo no Cofre 3D`);
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

  async loadScenario(scenarioName, options = {}) {
    try {
      this.integrityText.textContent = 'Carregando...';
      const url = scenarioName === 'live_sdd'
        ? '/api/graph'
        : `/api/graph?scenario=${encodeURIComponent(scenarioName)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const data = await res.json();

      // Merge persisted custom nodes & edges when viewing live_sdd
      if (scenarioName === 'live_sdd') {
        const existingIds = new Set(data.nodes.map(n => n.id));
        for (const cn of this.customNodes) {
          if (!existingIds.has(cn.id) && !this.deletedNodeIds.has(cn.id)) {
            data.nodes.push(cn);
            existingIds.add(cn.id);
          }
        }
        for (const ce of this.customEdges) {
          if (existingIds.has(ce.source) && existingIds.has(ce.target)) {
            const dup = data.edges.some(e => e.source === ce.source && e.target === ce.target);
            if (!dup) data.edges.push(ce);
          }
        }
      }

      this.currentGraph = data;

      this.physics = new SpringSimulation(data, {
        kRepulsion: 3500.0,
        softening: 25.0,
        kSpring: 0.22,
        dampingRatio: 0.88,
        restLength: 75.0,
        velocityDamping: 0.15
      });

      this.vault3D.loadGraph(data);
      if (this.hiddenTypes.size > 0) {
        this.vault3D.setTypeFilter(this.hiddenTypes);
      }
      this.vault3D._onResize();
      this.updateIntegrityStatus(data);
      if (!options.preserveCamera) {
        this.closeInspector();
      }
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

    this.statNodes.textContent = `${data.nodes.length} nós`;
    this.statEdges.textContent = `${data.edges.length} arestas`;
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
    this.updatePinButtonUI(Boolean(node.pinned));

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

    // Connections with inline Disconnect (✕) action
    const incoming = (this.currentGraph.edges || []).filter(e => e.target === node.id);
    const outgoing = (this.currentGraph.edges || []).filter(e => e.source === node.id);

    this.hudIncomingList.innerHTML = incoming.length > 0 ? '' : '<li style="cursor:default; opacity:0.6;">(nenhuma)</li>';
    for (const e of incoming) {
      const li = document.createElement('li');
      const labelSpan = document.createElement('span');
      labelSpan.textContent = `← ${e.source} [${e.type || 'ref'}]`;
      labelSpan.addEventListener('click', () => {
        this.vault3D.focusNode(e.source);
        const targetNode = this.currentGraph.nodes.find(n => n.id === e.source);
        if (targetNode) this.openInspector(targetNode);
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-edge';
      removeBtn.textContent = '✕';
      removeBtn.title = `Desfazer conexão ${e.source} → ${node.id}`;
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.removeConnection(e.source, node.id);
      });

      li.appendChild(labelSpan);
      li.appendChild(removeBtn);
      this.hudIncomingList.appendChild(li);
    }

    this.hudOutgoingList.innerHTML = outgoing.length > 0 ? '' : '<li style="cursor:default; opacity:0.6;">(nenhuma)</li>';
    for (const e of outgoing) {
      const li = document.createElement('li');
      const labelSpan = document.createElement('span');
      labelSpan.textContent = `→ ${e.target} [${e.type || 'ref'}]`;
      labelSpan.addEventListener('click', () => {
        this.vault3D.focusNode(e.target);
        const targetNode = this.currentGraph.nodes.find(n => n.id === e.target);
        if (targetNode) this.openInspector(targetNode);
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove-edge';
      removeBtn.textContent = '✕';
      removeBtn.title = `Desfazer conexão ${node.id} → ${e.target}`;
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.removeConnection(node.id, e.target);
      });

      li.appendChild(labelSpan);
      li.appendChild(removeBtn);
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
    if (q.length > 0) {
      for (const node of this.currentGraph.nodes) {
        if (
          node.id.toLowerCase().includes(q) ||
          (node.title && node.title.toLowerCase().includes(q)) ||
          (node.snippet && node.snippet.toLowerCase().includes(q))
        ) {
          matchingNodeIds.add(node.id);
        }
      }
    }

    for (const [id, mesh] of this.vault3D.nodeMeshMap.entries()) {
      const label = this.vault3D.nodeLabelMap.get(id);
      if (q.length === 0) {
        mesh.scale.set(1, 1, 1);
        if (label) label.visible = mesh.visible;
      } else if (matchingNodeIds.has(id)) {
        mesh.scale.set(1.45, 1.45, 1.45);
        if (label) label.visible = true;
      } else {
        mesh.scale.set(0.45, 0.45, 0.45);
        if (label) label.visible = false;
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new VaultApp();
  app.init();
});
