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

    this.vault3D.onNodeClickCallback = (nodeData) => {
      if (nodeData) {
        this.openInspector(nodeData);
      }
    };
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
          this.statEnergy.textContent = `Ek: ${this.physics.getSimulationEnergy().toFixed(2)}`;
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

    this.hudDrawer.classList.remove('closed');
  }

  closeInspector() {
    this.hudDrawer.classList.add('closed');
  }

  handleSearch(query) {
    if (!this.currentGraph || !query) return;
    const q = query.toLowerCase();
    for (const node of this.currentGraph.nodes) {
      const mesh = this.vault3D.nodeMeshMap.get(node.id);
      const label = this.vault3D.nodeLabelMap.get(node.id);
      if (mesh && label) {
        const matches = node.id.toLowerCase().includes(q) || (node.title && node.title.toLowerCase().includes(q));
        mesh.material.opacity = matches ? 1.0 : 0.2;
        label.material.opacity = matches ? 1.0 : 0.2;
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new VaultApp();
  app.init().catch(err => console.error('Error starting VaultApp:', err));
});
