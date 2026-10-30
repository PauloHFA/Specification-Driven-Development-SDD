/**
 * @file test/vault/synthetic-data.test.js
 * @description Comprehensive automated test suite for controlled synthetic SDD datasets.
 * Validates clean DAG, simple cycle, multi-cycle figure-8, disjoint hybrid, and adversarial drift scenarios.
 * Pure Node.js >= 18 native test runner. Zero external dependencies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getSyntheticScenario,
  getSyntheticScenarios,
  listSyntheticScenarios
} from '../../src/vault/core/synthetic-data.js';
import { detectCycles } from '../../src/vault/core/cycle-detector.js';
import {
  VaultGraphNode,
  VaultGraphEdge,
  NodeStatus,
  EdgeStatus,
  NodeType
} from '../../src/vault/core/graph-model.js';
import { assertCyclesEquivalent, assertSetEquals } from './test-helpers.js';

describe('Synthetic SDD Datasets (R4 Validation Topologies)', () => {
  describe('Registry and Factory Contract', () => {
    it('lists all 5 mandatory synthetic scenarios @spec:AC-004', () => {
      const scenarios = listSyntheticScenarios();
      assert.deepEqual(scenarios.sort(), [
        'adversarial_drift',
        'clean_dag',
        'disjoint_hybrid',
        'multi_cycle_figure8',
        'simple_cycle'
      ]);
    });

    it('retrieves scenarios map via getSyntheticScenarios()', () => {
      const map = getSyntheticScenarios();
      const keys = Object.keys(map).sort();
      assert.equal(keys.length, 5);
      assert.ok(map.clean_dag);
      assert.ok(map.simple_cycle);
      assert.ok(map.multi_cycle_figure8);
      assert.ok(map.disjoint_hybrid);
      assert.ok(map.adversarial_drift);
    });

    it('throws descriptive error on unknown scenario name', () => {
      assert.throws(
        () => getSyntheticScenario('non_existent_scenario'),
        /Unknown synthetic scenario: "non_existent_scenario"/
      );
    });

    it('guarantees fresh isolated instances on every invocation', () => {
      const s1 = getSyntheticScenario('clean_dag');
      const s2 = getSyntheticScenario('clean_dag');
      assert.notEqual(s1, s2);
      assert.notEqual(s1.nodes, s2.nodes);
      assert.notEqual(s1.nodes[0], s2.nodes[0]);

      // Mutate s1 and ensure s2 is unpolluted
      s1.nodes[0].title = 'MUTATED TITLE';
      assert.notEqual(s2.nodes[0].title, 'MUTATED TITLE');
    });
  });

  describe('Scenario 1: clean_dag', () => {
    it('produces a healthy, fully-connected layered DAG without cycles', () => {
      const scenario = getSyntheticScenario('clean_dag');
      assert.equal(scenario.name, 'clean_dag');
      assert.ok(scenario.nodes.length >= 10);
      assert.ok(scenario.edges.length >= 10);
      assert.deepEqual(scenario.expectedCycles, []);

      // Verify node types span full SDD hierarchy
      const types = new Set(scenario.nodes.map(n => n.type));
      assert.ok(types.has(NodeType.FEATURE));
      assert.ok(types.has(NodeType.STORY));
      assert.ok(types.has(NodeType.CRITERION));
      assert.ok(types.has(NodeType.TASK));
      assert.ok(types.has(NodeType.PRINCIPLE));
      assert.ok(types.has(NodeType.FILE));

      // Validate cycle detection result
      const cycleResult = detectCycles(scenario.nodes, scenario.edges);
      assert.equal(cycleResult.hasCycles, false);
      assert.equal(cycleResult.cycleCount, 0);
      assert.deepEqual(cycleResult.cycles, []);
      assert.equal(cycleResult.cyclicNodeIds.size, 0);
      assert.equal(cycleResult.cyclicEdgeIds.size, 0);
      assert.equal(cycleResult.brokenEdges.length, 0);

      // Verify all node spatial coordinates are valid finite numbers
      for (const node of scenario.nodes) {
        assert.ok(Number.isFinite(node.position.x));
        assert.ok(Number.isFinite(node.position.y));
        assert.ok(Number.isFinite(node.position.z));
      }

      // Verify all edges are valid and unperturbed
      for (const edge of scenario.edges) {
        assert.equal(edge.status, EdgeStatus.VALID);
        assert.equal(edge.isVibrating, false);
      }
    });
  });

  describe('Scenario 2: simple_cycle', () => {
    it('detects triangular circular dependency A -> B -> C -> A', () => {
      const scenario = getSyntheticScenario('simple_cycle');
      assert.equal(scenario.name, 'simple_cycle');
      assert.equal(scenario.nodes.length, 3);
      assert.equal(scenario.edges.length, 3);

      const cycleResult = detectCycles(scenario.nodes, scenario.edges);
      assert.equal(cycleResult.hasCycles, true);
      assert.equal(cycleResult.cycleCount, 1);
      assertCyclesEquivalent(cycleResult.cycles, scenario.expectedCycles);

      assertSetEquals(cycleResult.cyclicNodeIds, ['A', 'B', 'C']);
      assertSetEquals(cycleResult.cyclicEdgeIds, ['e_AB', 'e_BC', 'e_CA']);

      // Synchronize edge statuses and verify vibration trigger
      for (const edge of scenario.edges) {
        if (cycleResult.cyclicEdgeIds.has(edge.id)) {
          edge.setStatus(EdgeStatus.CIRCULAR);
          assert.equal(edge.isVibrating, true);
          assert.equal(edge.visualStyle.color, '#ef4444');
        }
      }
    });
  });

  describe('Scenario 3: multi_cycle_figure8', () => {
    it('accurately resolves intersecting cycles sharing articulation node C', () => {
      const scenario = getSyntheticScenario('multi_cycle_figure8');
      assert.equal(scenario.name, 'multi_cycle_figure8');
      assert.equal(scenario.nodes.length, 5);
      assert.equal(scenario.edges.length, 6);

      const cycleResult = detectCycles(scenario.nodes, scenario.edges);
      assert.equal(cycleResult.hasCycles, true);
      assert.equal(cycleResult.cycleCount, 2);
      assertCyclesEquivalent(cycleResult.cycles, scenario.expectedCycles);

      // Node C is in both cycles
      assert.ok(cycleResult.cyclicNodeIds.has('C'));
      assertSetEquals(cycleResult.cyclicNodeIds, ['A', 'B', 'C', 'D', 'E']);
      assert.equal(cycleResult.cyclicEdgeIds.size, 6);
    });
  });

  describe('Scenario 4: disjoint_hybrid', () => {
    it('preserves strict isolation between valid DAG and cyclic component', () => {
      const scenario = getSyntheticScenario('disjoint_hybrid');
      assert.equal(scenario.name, 'disjoint_hybrid');

      const cycleResult = detectCycles(scenario.nodes, scenario.edges);
      assert.equal(cycleResult.hasCycles, true);
      assert.equal(cycleResult.cycleCount, 1);
      assertCyclesEquivalent(cycleResult.cycles, scenario.expectedCycles);

      // Verify DAG nodes are valid
      const dagNodeIds = ['DAG:FEAT:reports', 'DAG:US:summary', 'DAG:AC:export', 'DAG:T:pdf'];
      for (const id of dagNodeIds) {
        assert.equal(cycleResult.nodeStatusMap.get(id), NodeStatus.VALID);
        assert.equal(cycleResult.cyclicNodeIds.has(id), false);
      }

      // Verify cyclic nodes are circular
      const cyclicIds = ['CYC:1', 'CYC:2', 'CYC:3'];
      for (const id of cyclicIds) {
        assert.equal(cycleResult.nodeStatusMap.get(id), NodeStatus.CIRCULAR);
        assert.ok(cycleResult.cyclicNodeIds.has(id));
      }

      // Verify DAG edges are valid and NOT vibrating
      const dagEdges = scenario.edges.filter(e => e.id.startsWith('EDGE:DAG:'));
      for (const e of dagEdges) {
        assert.equal(cycleResult.edgeStatusMap.get(e.id), EdgeStatus.VALID);
        assert.equal(e.isVibrating, false);
      }

      // Verify Cyclic edges are flagged
      const cycEdges = scenario.edges.filter(e => e.id.startsWith('EDGE:CYC:'));
      for (const e of cycEdges) {
        assert.equal(cycleResult.edgeStatusMap.get(e.id), EdgeStatus.CIRCULAR);
      }
    });
  });

  describe('Scenario 5: adversarial_drift', () => {
    it('detects cross-feature cycle, orphan node, and broken dangling edge', () => {
      const scenario = getSyntheticScenario('adversarial_drift');
      assert.equal(scenario.name, 'adversarial_drift');

      const cycleResult = detectCycles(scenario.nodes, scenario.edges);
      assert.equal(cycleResult.hasCycles, true);
      assertCyclesEquivalent(cycleResult.cycles, scenario.expectedCycles);

      // Verify cross-feature cycle participants
      const crossCycleNodes = ['T:bill_charge', 'T:notif_receipt', 'T:sub_renew'];
      for (const id of crossCycleNodes) {
        assert.ok(cycleResult.cyclicNodeIds.has(id));
        assert.equal(cycleResult.nodeStatusMap.get(id), NodeStatus.CIRCULAR);
      }

      // Verify orphan node detection
      assert.ok(cycleResult.orphanNodeIds.has('ASM:orphan_question'));
      assert.equal(cycleResult.nodeStatusMap.get('ASM:orphan_question'), NodeStatus.ORPHAN);

      // Verify broken edge pointing to nonexistent node is caught
      assert.equal(cycleResult.brokenEdges.length, 1);
      assert.equal(cycleResult.brokenEdges[0].target, 'NON_EXISTENT_AC');
      assert.equal(cycleResult.edgeStatusMap.get('EDGE:BROKEN:missing_target'), EdgeStatus.ERROR);
    });
  });
});
