/**
 * @file test/vault/cycle-detector.test.js
 * @description Comprehensive unit tests for Vault Graph Model & Cycle Detector.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VaultGraphNode,
  VaultGraphEdge,
  VaultGraph,
  NodeStatus,
  EdgeStatus,
  IntegrityTag
} from '../../src/vault/core/graph-model.js';
import { detectCycles } from '../../src/vault/core/cycle-detector.js';

describe('Vault Graph Model', () => {
  it('instantiates VaultGraphNode with defaults and updates status', () => {
    const node = new VaultGraphNode({ id: 'US-001', title: 'Aluno se inscreve' });
    assert.equal(node.id, 'US-001');
    assert.equal(node.status, NodeStatus.VALID);
    assert.deepEqual(node.position, { x: 0, y: 0, z: 0 });

    node.setStatus(NodeStatus.CIRCULAR);
    assert.equal(node.status, NodeStatus.CIRCULAR);
    assert.ok(node.hasTag(IntegrityTag.CIRCULAR_DEPENDENCY));
  });

  it('instantiates VaultGraphEdge and reacts to circular status', () => {
    const edge = new VaultGraphEdge({ id: 'e1', source: 'A', target: 'B' });
    assert.equal(edge.status, EdgeStatus.VALID);
    assert.equal(edge.isVibrating, false);
    assert.equal(edge.visualStyle.color, '#38bdf8');

    edge.setStatus(EdgeStatus.CIRCULAR);
    assert.equal(edge.status, EdgeStatus.CIRCULAR);
    assert.equal(edge.isVibrating, true);
    assert.equal(edge.visualStyle.color, '#ef4444');
  });

  it('serializes and deserializes graph round-trip', () => {
    const g = new VaultGraph();
    g.addNode({ id: 'A', title: 'Node A' });
    g.addNode({ id: 'B', title: 'Node B' });
    g.addEdge({ id: 'e1', source: 'A', target: 'B' });

    const json = g.toJSON();
    assert.equal(json.nodes.length, 2);
    assert.equal(json.edges.length, 1);
  });
});

describe('Cycle Detector — Tier 1: Core Functional Topologies', () => {
  it('correctly passes a clean Directed Acyclic Graph (DAG)', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }];
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'A', target: 'D' }
    ];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, false);
    assert.equal(result.cycleCount, 0);
    assert.equal(result.cyclicNodeIds.size, 0);
    assert.equal(result.cyclicEdgeIds.size, 0);
    for (const [_, status] of result.nodeStatusMap) {
      assert.equal(status, NodeStatus.VALID);
    }
    for (const [_, status] of result.edgeStatusMap) {
      assert.equal(status, EdgeStatus.VALID);
    }
  });

  it('detects a simple 3-node cycle A -> B -> C -> A', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'A' }
    ];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, true);
    assert.equal(result.cycleCount, 1);
    assert.deepEqual(result.cycles[0], ['A', 'B', 'C', 'A']);
    assert.deepEqual(Array.from(result.cyclicNodeIds).sort(), ['A', 'B', 'C']);
    assert.deepEqual(Array.from(result.cyclicEdgeIds).sort(), ['e1', 'e2', 'e3']);
  });
});

describe('Cycle Detector — Tier 2: Boundary & Corner Cases', () => {
  it('handles empty graphs gracefully', () => {
    const result = detectCycles([], []);
    assert.equal(result.hasCycles, false);
    assert.equal(result.cycleCount, 0);
  });

  it('identifies isolated orphan node', () => {
    const nodes = [{ id: 'Solo' }];
    const edges = [];
    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, false);
    assert.equal(result.nodeStatusMap.get('Solo'), NodeStatus.ORPHAN);
    assert.ok(result.orphanNodeIds.has('Solo'));
  });

  it('detects a self-loop A -> A', () => {
    const nodes = [{ id: 'A' }];
    const edges = [{ id: 'loop1', source: 'A', target: 'A' }];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, true);
    assert.equal(result.cycleCount, 1);
    assert.deepEqual(result.cycles[0], ['A', 'A']);
    assert.ok(result.cyclicNodeIds.has('A'));
    assert.ok(result.cyclicEdgeIds.has('loop1'));
    assert.equal(result.nodeStatusMap.get('A'), NodeStatus.CIRCULAR);
    assert.equal(result.edgeStatusMap.get('loop1'), EdgeStatus.CIRCULAR);
  });

  it('detects a 2-node cycle A <-> B', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }];
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'A' }
    ];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, true);
    assert.equal(result.cycleCount, 1);
    assert.deepEqual(result.cycles[0], ['A', 'B', 'A']);
    assert.equal(result.nodeStatusMap.get('A'), NodeStatus.CIRCULAR);
    assert.equal(result.nodeStatusMap.get('B'), NodeStatus.CIRCULAR);
  });

  it('correctly flags parallel / multigraph edges in a cycle', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }];
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'B' }, // duplicate edge
      { id: 'e3', source: 'B', target: 'A' }
    ];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, true);
    assert.ok(result.cyclicEdgeIds.has('e1'));
    assert.ok(result.cyclicEdgeIds.has('e2'));
    assert.ok(result.cyclicEdgeIds.has('e3'));
  });

  it('isolates broken / dangling edges pointing to missing nodes', () => {
    const nodes = [{ id: 'A' }];
    const edges = [{ id: 'e_bad', source: 'A', target: 'MISSING' }];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, false);
    assert.equal(result.brokenEdges.length, 1);
    assert.equal(result.edgeStatusMap.get('e_bad'), EdgeStatus.ERROR);
    assert.equal(result.nodeStatusMap.get('MISSING'), NodeStatus.BROKEN);
  });
});

describe('Cycle Detector — Tier 3: Combinatorial & Complex Topologies', () => {
  it('accurately resolves Figure-8 intersecting cycles sharing node C', () => {
    // Cycle 1: A -> B -> C -> A
    // Cycle 2: C -> D -> E -> C
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }];
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'A' },
      { id: 'e4', source: 'C', target: 'D' },
      { id: 'e5', source: 'D', target: 'E' },
      { id: 'e6', source: 'E', target: 'C' }
    ];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, true);
    assert.equal(result.cycleCount, 2);
    assert.equal(result.cyclicNodeIds.size, 5);
    assert.equal(result.cyclicEdgeIds.size, 6);

    const serializedCycles = result.cycles.map(c => c.join('->')).sort();
    assert.deepEqual(serializedCycles, ['A->B->C->A', 'C->D->E->C']);
  });

  it('preserves strict isolation in disjoint hybrid graphs', () => {
    // Subgraph 1 (valid): A -> B -> C
    // Subgraph 2 (cyclic): X -> Y -> X
    // Subgraph 3 (orphan): Z
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'X' }, { id: 'Y' }, { id: 'Z' }];
    const edges = [
      { id: 'e_v1', source: 'A', target: 'B' },
      { id: 'e_v2', source: 'B', target: 'C' },
      { id: 'e_c1', source: 'X', target: 'Y' },
      { id: 'e_c2', source: 'Y', target: 'X' }
    ];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, true);
    assert.equal(result.nodeStatusMap.get('A'), NodeStatus.VALID);
    assert.equal(result.nodeStatusMap.get('B'), NodeStatus.VALID);
    assert.equal(result.nodeStatusMap.get('C'), NodeStatus.VALID);
    assert.equal(result.nodeStatusMap.get('X'), NodeStatus.CIRCULAR);
    assert.equal(result.nodeStatusMap.get('Y'), NodeStatus.CIRCULAR);
    assert.equal(result.nodeStatusMap.get('Z'), NodeStatus.ORPHAN);

    assert.equal(result.edgeStatusMap.get('e_v1'), EdgeStatus.VALID);
    assert.equal(result.edgeStatusMap.get('e_v2'), EdgeStatus.VALID);
    assert.equal(result.edgeStatusMap.get('e_c1'), EdgeStatus.CIRCULAR);
    assert.equal(result.edgeStatusMap.get('e_c2'), EdgeStatus.CIRCULAR);
  });
});

describe('Cycle Detector — Tier 5: Adversarial & Performance Stress', () => {
  it('executes in < 50ms on 1000-node linear DAG', () => {
    const nodes = [];
    const edges = [];
    for (let i = 0; i < 1000; i++) {
      nodes.push({ id: `N${i}` });
      if (i > 0) {
        edges.push({ id: `e${i}`, source: `N${i-1}`, target: `N${i}` });
      }
    }

    const t0 = performance.now();
    const result = detectCycles(nodes, edges);
    const duration = performance.now() - t0;

    assert.equal(result.hasCycles, false);
    assert.equal(result.summary.totalNodes, 1000);
    assert.ok(duration < 50, `Expected <50ms execution, took ${duration.toFixed(2)}ms`);
  });

  it('detects a 100-node circular ring in < 30ms', () => {
    const N = 100;
    const nodes = [];
    const edges = [];
    for (let i = 0; i < N; i++) {
      nodes.push({ id: `R${i}` });
      edges.push({ id: `e${i}`, source: `R${i}`, target: `R${(i + 1) % N}` });
    }

    const t0 = performance.now();
    const result = detectCycles(nodes, edges);
    const duration = performance.now() - t0;

    assert.equal(result.hasCycles, true);
    assert.equal(result.cycleCount, 1);
    assert.equal(result.cyclicNodeIds.size, N);
    assert.equal(result.cyclicEdgeIds.size, N);
    assert.ok(duration < 30, `Ring detection took ${duration.toFixed(2)}ms`);
  });

  it('safely handles null/undefined or corrupted elements in edges array', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }];
    const edges = [
      null,
      undefined,
      { id: 'corrupt1' },
      { id: 'corrupt2', source: null, target: 'B' },
      { id: 'corrupt3', source: 'A', target: null },
      { id: 'valid1', source: 'A', target: 'B' }
    ];

    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, false);
    assert.equal(result.summary.validEdgesCount, 1);
    assert.equal(result.summary.brokenEdgesCount, 5);
  });

  it('detects 500-node circular ring and guarantees hasCycles: true and cycleCount >= 1', () => {
    const N = 500;
    const nodes = [];
    const edges = [];
    for (let i = 0; i < N; i++) {
      nodes.push({ id: `Ring500_${i}` });
      edges.push({ id: `e_${i}`, source: `Ring500_${i}`, target: `Ring500_${(i + 1) % N}` });
    }

    // Default maxCycleDepth: 1000 naturally finds the 500-node ring
    const result = detectCycles(nodes, edges);
    assert.equal(result.hasCycles, true);
    assert.ok(result.cycleCount >= 1);
    assert.equal(result.cyclicNodeIds.size, 500);
    assert.equal(result.cyclicEdgeIds.size, 500);

    // Truncated maxCycleDepth: 50 still extracts a cycle via fallback and ensures hasCycles: true
    const resultTruncated = detectCycles(nodes, edges, { maxCycleDepth: 50 });
    assert.equal(resultTruncated.hasCycles, true);
    assert.ok(resultTruncated.cycleCount >= 1);
    assert.equal(resultTruncated.cyclicNodeIds.size, 500);
  });

  it('strictly bounds cycle extraction in dense cliques without exceeding maxCyclesPerScc', () => {
    // 8-node complete directed clique (K8) has 8 * 7 = 56 edges and thousands of elementary cycles
    const N = 8;
    const nodes = [];
    const edges = [];
    for (let i = 0; i < N; i++) nodes.push({ id: `K_${i}` });
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i !== j) edges.push({ id: `e_${i}_${j}`, source: `K_${i}`, target: `K_${j}` });
      }
    }

    const maxLimit = 25;
    const result = detectCycles(nodes, edges, { maxCyclesPerScc: maxLimit });
    assert.equal(result.hasCycles, true);
    assert.ok(result.cycles.length <= maxLimit, `Cycles (${result.cycles.length}) must not exceed limit ${maxLimit}`);
    assert.equal(result.cycleCount, result.cycles.length);
  });

  it('prevents call stack overflow on deep 15,000-node linear chain', () => {
    const N = 15000;
    const nodes = [];
    const edges = [];
    for (let i = 0; i < N; i++) {
      nodes.push({ id: `Chain_${i}` });
      if (i > 0) {
        edges.push({ id: `ec_${i}`, source: `Chain_${i-1}`, target: `Chain_${i}` });
      }
    }

    assert.doesNotThrow(() => {
      const result = detectCycles(nodes, edges);
      assert.equal(result.hasCycles, false);
      assert.equal(result.summary.totalNodes, N);
    });
  });
});
