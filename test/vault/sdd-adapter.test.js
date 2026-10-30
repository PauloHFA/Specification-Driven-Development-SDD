/**
 * @file test/vault/sdd-adapter.test.js
 * @description Comprehensive automated test suite for the SDD 3D Graph Adapter.
 * Validates spec parsing, node/edge generation, GWT clauses, verification statuses,
 * task file references, 3D orbital layouts, cycle detection, and fallback behaviors.
 * Pure Node.js >= 18 native test runner. Zero external dependencies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadSDDGraph,
  convertProjectToGraph,
  resolveSpecDir,
  computeOrbitalLayout
} from '../../src/vault/core/sdd-adapter.js';
import {
  VaultGraphNode,
  VaultGraphEdge,
  NodeType,
  EdgeType,
  NodeStatus,
  EdgeStatus
} from '../../src/vault/core/graph-model.js';

describe('SDD Graph Adapter (F6 Specification Parser & 3D Bridge)', () => {
  const exampleSpecDir = 'examples/inscricao-turma/.spec';

  describe('Real Specification Ingestion (examples/inscricao-turma/.spec)', () => {
    it('loads and constructs a complete SDD knowledge graph from example specs @spec:AC-003', () => {
      const graph = loadSDDGraph(exampleSpecDir);

      assert.ok(graph);
      assert.ok(Array.isArray(graph.nodes));
      assert.ok(Array.isArray(graph.edges));
      assert.ok(graph.metadata);
      assert.ok(graph.stats);

      // Verify node counts match specification
      assert.equal(graph.stats.featureCount, 1);
      assert.equal(graph.stats.storyCount, 2);
      assert.equal(graph.stats.criterionCount, 3);
      assert.equal(graph.stats.taskCount, 3);
      assert.equal(graph.stats.assumptionCount, 2);
      assert.equal(graph.stats.questionCount, 1);
      assert.equal(graph.stats.principleCount, 8);
      assert.equal(graph.stats.fileCount, 1);
      assert.equal(graph.nodes.length, 21);

      // Verify graph is acyclic
      assert.equal(graph.stats.hasCycles, false);
      assert.equal(graph.stats.cycleCount, 0);
      assert.deepEqual(graph.stats.cycles, []);
    });

    it('creates correct node types, identifiers, and titles', () => {
      const graph = loadSDDGraph(exampleSpecDir);
      const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

      // Feature node
      const featNode = nodeMap.get('FEAT:inscricao-turma');
      assert.ok(featNode);
      assert.equal(featNode.type, NodeType.FEATURE);
      assert.equal(featNode.title, 'Spec: Inscrição na turma');
      assert.equal(featNode.status, 'implementada');

      // Stories
      const us1 = nodeMap.get('US-001');
      assert.ok(us1);
      assert.equal(us1.type, NodeType.STORY);
      assert.equal(us1.title, 'Aluno se inscreve em turma aberta');

      const us2 = nodeMap.get('US-002');
      assert.ok(us2);
      assert.equal(us2.type, NodeType.STORY);
      assert.equal(us2.title, 'Menor de idade exige consentimento');

      // Acceptance Criteria
      const ac1 = nodeMap.get('AC-001');
      assert.ok(ac1);
      assert.equal(ac1.type, NodeType.CRITERION);
      assert.equal(ac1.title, 'Inscrição em turma com vaga');

      const ac2 = nodeMap.get('AC-002');
      assert.ok(ac2);
      assert.equal(ac2.type, NodeType.CRITERION);
      assert.equal(ac2.title, 'Turma lotada recusa inscrição');

      const ac3 = nodeMap.get('AC-003');
      assert.ok(ac3);
      assert.equal(ac3.type, NodeType.CRITERION);
      assert.equal(ac3.title, 'Inscrição de menor sem consentimento é bloqueada');

      // Tasks
      const t1 = nodeMap.get('T-001');
      assert.ok(t1);
      assert.equal(t1.type, NodeType.TASK);
      assert.equal(t1.title, 'Registrar inscrição e decrementar vaga');
      assert.equal(t1.status, 'concluida');

      // Principles
      const p1 = nodeMap.get('P-001');
      assert.ok(p1);
      assert.equal(p1.type, NodeType.PRINCIPLE);
      assert.equal(p1.metadata.obligationLevel, 'DEVE');

      // Assumptions & Questions
      const asm1 = nodeMap.get('ASM-001');
      assert.ok(asm1);
      assert.equal(asm1.type, NodeType.ASSUMPTION);
      assert.equal(asm1.status, 'confirmada');

      const q1 = nodeMap.get('Q-001');
      assert.ok(q1);
      assert.equal(q1.type, NodeType.QUESTION);
      assert.equal(q1.status, 'respondida');

      // File
      const fileNode = nodeMap.get('FILE:src/inscricao.js');
      assert.ok(fileNode);
      assert.equal(fileNode.type, NodeType.FILE);
      assert.equal(fileNode.title, 'inscricao.js');
    });

    it('extracts and formats Given/When/Then (GWT) clauses in Acceptance Criteria', () => {
      const graph = loadSDDGraph(exampleSpecDir);
      const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

      const ac1 = nodeMap.get('AC-001');
      assert.ok(ac1.metadata.given.length > 0);
      assert.ok(ac1.metadata.when.length > 0);
      assert.ok(ac1.metadata.then.length > 0);

      assert.equal(ac1.metadata.given[0], 'uma turma aberta com vagas disponíveis');
      assert.equal(ac1.metadata.when[0], 'o visitante envia nome, e-mail e telefone válidos');
      assert.equal(ac1.metadata.then[0], 'a inscrição é registrada e o número de vagas é decrementado');

      // Verify snippet contains formatted clauses
      assert.ok(ac1.snippet.includes('Dado uma turma aberta'));
      assert.ok(ac1.snippet.includes('Quando o visitante envia'));
      assert.ok(ac1.snippet.includes('Então a inscrição é registrada'));
    });

    it('associates verification records and sets audit status', () => {
      const graph = loadSDDGraph(exampleSpecDir);
      const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

      // AC verification verdicts from inscricao-turma.json
      const ac1 = nodeMap.get('AC-001');
      assert.equal(ac1.status, 'pass');
      assert.ok(ac1.metadata.verification);
      assert.equal(ac1.metadata.verification.status, 'pass');
      assert.equal(ac1.metadata.auditStatus, 'clean');

      const ac2 = nodeMap.get('AC-002');
      assert.equal(ac2.status, 'pass');

      const ac3 = nodeMap.get('AC-003');
      assert.equal(ac3.status, 'pass');

      // Principle verification verdicts
      const p1 = nodeMap.get('P-001');
      assert.equal(p1.status, 'pass');
      assert.equal(p1.metadata.auditStatus, 'clean');
    });

    it('generates correct directed edges and relation types', () => {
      const graph = loadSDDGraph(exampleSpecDir);
      const edgeLookup = new Map(graph.edges.map(e => [`${e.source}->${e.target}`, e]));

      // Containment edges: Feature -> Story
      assert.ok(edgeLookup.has('FEAT:inscricao-turma->US-001'));
      assert.equal(edgeLookup.get('FEAT:inscricao-turma->US-001').type, EdgeType.CONTAINS);

      // Containment edges: Story -> AC
      assert.ok(edgeLookup.has('US-001->AC-001'));
      assert.equal(edgeLookup.get('US-001->AC-001').type, EdgeType.CONTAINS);
      assert.ok(edgeLookup.has('US-001->AC-002'));
      assert.ok(edgeLookup.has('US-002->AC-003'));

      // Implementation edges: Task -> AC / US
      assert.ok(edgeLookup.has('T-001->US-001'));
      assert.equal(edgeLookup.get('T-001->US-001').type, EdgeType.IMPLEMENTS);
      assert.ok(edgeLookup.has('T-001->AC-001'));
      assert.ok(edgeLookup.has('T-002->AC-002'));
      assert.ok(edgeLookup.has('T-003->AC-003'));

      // Touches edges: Task -> File
      assert.ok(edgeLookup.has('T-001->FILE:src/inscricao.js'));
      assert.equal(edgeLookup.get('T-001->FILE:src/inscricao.js').type, 'touches');
      assert.ok(edgeLookup.has('T-002->FILE:src/inscricao.js'));
      assert.ok(edgeLookup.has('T-003->FILE:src/inscricao.js'));

      // Constraint edges: Principle -> Feature
      assert.ok(edgeLookup.has('P-001->FEAT:inscricao-turma'));
      assert.equal(edgeLookup.get('P-001->FEAT:inscricao-turma').type, EdgeType.CONSTRAINS);

      // None of the edges in example specs should be circular or vibrating
      for (const edge of graph.edges) {
        assert.equal(edge.status, EdgeStatus.VALID);
        assert.equal(edge.isVibrating, false);
      }
    });

    it('positions all nodes in valid 3D space with hierarchical clustering', () => {
      const graph = loadSDDGraph(exampleSpecDir);
      const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

      // All nodes have finite 3D coordinates
      for (const n of graph.nodes) {
        assert.ok(Number.isFinite(n.position.x), `Node ${n.id} x must be finite`);
        assert.ok(Number.isFinite(n.position.y), `Node ${n.id} y must be finite`);
        assert.ok(Number.isFinite(n.position.z), `Node ${n.id} z must be finite`);
      }

      // Feature is at center
      const feat = nodeMap.get('FEAT:inscricao-turma');
      assert.equal(feat.position.x, 0);
      assert.equal(feat.position.y, 0);
      assert.equal(feat.position.z, 0);

      // Principles are elevated in celestial ring (y > 150)
      for (let i = 1; i <= 8; i++) {
        const p = nodeMap.get(`P-00${i}`);
        assert.ok(p.position.y > 150, `Principle ${p.id} must be elevated in Y`);
      }

      // Stories are in orbital layer 1 (radius ~135)
      const us1 = nodeMap.get('US-001');
      const rStory = Math.hypot(us1.position.x, us1.position.z);
      assert.ok(rStory > 100 && rStory < 180, `Story radius ${rStory} should be in layer 1`);

      // ACs are in orbital layer 2 (radius ~240)
      const ac1 = nodeMap.get('AC-001');
      const rAc = Math.hypot(ac1.position.x, ac1.position.z);
      assert.ok(rAc > 180 && rAc < 300, `AC radius ${rAc} should be in layer 2`);

      // Tasks are in orbital layer 3 (radius ~345)
      const t1 = nodeMap.get('T-001');
      const rTask = Math.hypot(t1.position.x, t1.position.z);
      assert.ok(rTask > 300 && rTask < 420, `Task radius ${rTask} should be in layer 3`);
    });
  });

  describe('Fallback and Error Handling', () => {
    it('gracefully falls back to examples when specDir is not provided or relative .spec is requested', () => {
      const tempProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-fallback-'));
      try {
        const graph = loadSDDGraph('.spec', { projectRoot: tempProjectRoot });
        assert.ok(graph);
        assert.equal(graph.stats.featureCount, 1);
        assert.equal(graph.stats.storyCount, 2);
      } finally {
        fs.rmSync(tempProjectRoot, { recursive: true, force: true });
      }
    });

    it('falls back to synthetic scenario when specDir does not exist and synthetic fallback is enabled', () => {
      const graph = loadSDDGraph('non_existent_folder_xyz', {
        fallbackToExamples: false,
        fallbackToSynthetic: true,
        syntheticScenario: 'simple_cycle'
      });

      assert.ok(graph);
      assert.equal(graph.metadata.source, 'synthetic_fallback');
      assert.equal(graph.metadata.scenario, 'simple_cycle');
      assert.equal(graph.stats.hasCycles, true);
      assert.equal(graph.stats.cycleCount, 1);
      assert.equal(graph.nodes.length, 3);
    });

    it('throws when directory does not exist and fallbacks are explicitly disabled', () => {
      assert.throws(
        () =>
          loadSDDGraph('non_existent_folder_xyz', {
            fallbackToExamples: false,
            fallbackToSynthetic: false
          }),
        /Specification directory not found/
      );
    });

    it('resolveSpecDir returns null when directory is invalid and fallbacks disabled', () => {
      const resolved = resolveSpecDir('missing_dir_12345', { fallbackToExamples: false });
      assert.equal(resolved, null);
    });
  });

  describe('convertProjectToGraph Utility', () => {
    it('converts in-memory project data into a fully analyzed VaultGraph', () => {
      const mockProject = {
        features: [
          {
            name: 'mock-feature',
            spec: {
              title: 'Mock Feature',
              status: 'pronta',
              stories: [
                {
                  id: 'US-101',
                  title: 'Mock Story 1',
                  line: 10,
                  description: ['Description line'],
                  acs: [
                    {
                      id: 'AC-101',
                      title: 'Mock AC 1',
                      line: 20,
                      given: ['condição A'],
                      when: ['ação B'],
                      then: ['resultado C']
                    }
                  ]
                }
              ],
              assumptions: [{ id: 'ASM-101', text: 'Hipótese', status: 'confirmada', line: 30 }],
              questions: [{ id: 'Q-101', text: 'Dúvida', status: 'aberta', line: 40 }]
            },
            tasks: {
              tasks: [
                {
                  id: 'T-101',
                  title: 'Mock Task 1',
                  status: 'concluida',
                  refs: ['AC-101'],
                  files: ['src/mock.js'],
                  line: 50
                }
              ]
            }
          }
        ],
        constitution: {
          principles: [
            {
              id: 'P-101',
              title: 'Princípio Mock',
              level: 'DEVE',
              line: 5,
              body: ['Regra estrita']
            }
          ]
        },
        verifications: {
          'mock-feature': {
            results: { 'AC-101': { status: 'pass' } },
            principles: { 'P-101': { status: 'pass' } }
          }
        }
      };

      const graph = convertProjectToGraph(mockProject);
      assert.equal(graph.stats.nodeCount, 8); // FEAT, US, AC, ASM, Q, T, P, FILE = 8 nodes
      assert.equal(graph.stats.hasCycles, false);

      const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
      assert.equal(nodeMap.get('AC-101').status, 'pass');
      assert.equal(nodeMap.get('P-101').status, 'pass');
      assert.equal(nodeMap.get('T-101').status, 'concluida');
    });

    it('detects circular dependencies introduced in SDD tasks and triggers edge vibration', () => {
      const cyclicProject = {
        features: [
          {
            name: 'cyclic-feature',
            spec: {
              title: 'Cyclic Spec',
              status: 'em-implementacao',
              stories: []
            },
            tasks: {
              tasks: [
                { id: 'T-901', title: 'Task 1', status: 'pendente', refs: ['T-902'], files: [] },
                { id: 'T-902', title: 'Task 2', status: 'pendente', refs: ['T-903'], files: [] },
                { id: 'T-903', title: 'Task 3', status: 'pendente', refs: ['T-901'], files: [] }
              ]
            }
          }
        ]
      };

      const graph = convertProjectToGraph(cyclicProject);
      assert.equal(graph.stats.hasCycles, true);
      assert.equal(graph.stats.cycleCount, 1);

      // Verify circular nodes and edges are tagged
      const t901 = graph.nodes.find(n => n.id === 'T-901');
      assert.equal(t901.status, NodeStatus.CIRCULAR);

      for (const edge of graph.edges) {
        if (['T-901', 'T-902', 'T-903'].includes(edge.source)) {
          assert.equal(edge.status, EdgeStatus.CIRCULAR);
          assert.equal(edge.isVibrating, true);
          assert.equal(edge.visualStyle.color, '#ef4444');
        }
      }
    });
  });
});
