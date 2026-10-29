/**
 * @file test/vault/test-helpers.js
 * @description Graph generators and mathematical assertion helpers for the 3D Vault test suite.
 * Pure Node.js >= 18, zero external dependencies.
 */

import assert from 'node:assert/strict';

/**
 * Asserts that two 3D vectors are equal within a specified numerical epsilon.
 * Works with Vector3 instances, {x, y, z} objects, or [x, y, z] arrays.
 *
 * @param {object|Array} actual
 * @param {object|Array} expected
 * @param {number} [epsilon=1e-5]
 * @param {string} [msg='']
 */
export function assertVector3Close(actual, expected, epsilon = 1e-5, msg = '') {
  assert.ok(actual, `Actual vector must be defined ${msg}`);
  assert.ok(expected, `Expected vector must be defined ${msg}`);

  const ax = Array.isArray(actual) ? actual[0] : (actual.x ?? 0);
  const ay = Array.isArray(actual) ? actual[1] : (actual.y ?? 0);
  const az = Array.isArray(actual) ? actual[2] : (actual.z ?? 0);

  const ex = Array.isArray(expected) ? expected[0] : (expected.x ?? 0);
  const ey = Array.isArray(expected) ? expected[1] : (expected.y ?? 0);
  const ez = Array.isArray(expected) ? expected[2] : (expected.z ?? 0);

  const dx = Math.abs(ax - ex);
  const dy = Math.abs(ay - ey);
  const dz = Math.abs(az - ez);

  const prefix = msg ? `[${msg}] ` : '';
  assert.ok(
    dx <= epsilon && dy <= epsilon && dz <= epsilon,
    `${prefix}Expected (${ex}, ${ey}, ${ez}) within ${epsilon}, but received (${ax}, ${ay}, ${az}). Deltas: dx=${dx}, dy=${dy}, dz=${dz}`
  );
}

/**
 * Asserts that a vector has unit length (norm === 1 within epsilon).
 *
 * @param {object|Array} v
 * @param {number} [epsilon=1e-5]
 * @param {string} [msg='']
 */
export function assertIsUnitVector(v, epsilon = 1e-5, msg = '') {
  const x = Array.isArray(v) ? v[0] : (v.x ?? 0);
  const y = Array.isArray(v) ? v[1] : (v.y ?? 0);
  const z = Array.isArray(v) ? v[2] : (v.z ?? 0);
  const len = Math.hypot(x, y, z);
  assert.ok(
    Math.abs(len - 1.0) <= epsilon,
    `${msg ? `[${msg}] ` : ''}Expected unit vector (norm 1.0), but got length ${len}`
  );
}

/**
 * Asserts that two sets contain identical values.
 *
 * @param {Set|Iterable} actualSet
 * @param {Set|Iterable} expectedSet
 * @param {string} [msg='']
 */
export function assertSetEquals(actualSet, expectedSet, msg = '') {
  const actual = actualSet instanceof Set ? actualSet : new Set(actualSet);
  const expected = expectedSet instanceof Set ? expectedSet : new Set(expectedSet);

  assert.equal(
    actual.size,
    expected.size,
    `${msg ? `[${msg}] ` : ''}Set size mismatch: actual size ${actual.size} (values: ${[...actual].join(', ')}) vs expected size ${expected.size} (values: ${[...expected].join(', ')})`
  );

  for (const item of expected) {
    assert.ok(
      actual.has(item),
      `${msg ? `[${msg}] ` : ''}Actual set missing expected value: ${item}`
    );
  }
}

/**
 * Normalizes an elementary cycle path to canonical rotational order:
 * minimum node ID first, followed by remaining path in cyclic order.
 * E.g., ['B', 'C', 'A', 'B'] -> ['A', 'B', 'C', 'A']
 *
 * @param {string[]} cycle
 * @returns {string[]}
 */
export function canonicalizeCycle(cycle) {
  if (!Array.isArray(cycle) || cycle.length <= 1) return cycle || [];
  // Strip repeated closing node
  const nodes = cycle[0] === cycle[cycle.length - 1] && cycle.length > 1
    ? cycle.slice(0, -1)
    : cycle.slice();

  let minIdx = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i] < nodes[minIdx]) {
      minIdx = i;
    }
  }

  const rotated = nodes.slice(minIdx).concat(nodes.slice(0, minIdx));
  rotated.push(rotated[0]);
  return rotated;
}

/**
 * Asserts that two collections of cycles are equivalent regardless of
 * cycle ordering or rotational starting point.
 *
 * @param {Array<string[]>} actualCycles
 * @param {Array<string[]>} expectedCycles
 * @param {string} [msg='']
 */
export function assertCyclesEquivalent(actualCycles, expectedCycles, msg = '') {
  assert.equal(
    actualCycles.length,
    expectedCycles.length,
    `${msg ? `[${msg}] ` : ''}Cycle count mismatch: actual ${actualCycles.length} vs expected ${expectedCycles.length}`
  );

  const canonActual = actualCycles.map(c => canonicalizeCycle(c).join('->')).sort();
  const canonExpected = expectedCycles.map(c => canonicalizeCycle(c).join('->')).sort();

  assert.deepEqual(
    canonActual,
    canonExpected,
    `${msg ? `[${msg}] ` : ''}Cycles mismatch: actual ${JSON.stringify(canonActual)} vs expected ${JSON.stringify(canonExpected)}`
  );
}

/**
 * Asserts Dirichlet boundary conditions on a polyline:
 * The start vertex must equal p1 and the end vertex must equal p2.
 *
 * @param {Array<object>} polyline
 * @param {object} p1
 * @param {object} p2
 * @param {number} [epsilon=1e-5]
 */
export function assertDirichletBoundaries(polyline, p1, p2, epsilon = 1e-5) {
  assert.ok(Array.isArray(polyline) && polyline.length >= 2, 'Polyline must have at least 2 vertices');
  assertVector3Close(polyline[0], p1, epsilon, 'Start vertex must match p1 (Dirichlet boundary)');
  assertVector3Close(polyline[polyline.length - 1], p2, epsilon, 'End vertex must match p2 (Dirichlet boundary)');
}

// =========================================================================
// GRAPH TOPOLOGY GENERATORS FOR TESTS
// =========================================================================

/**
 * Creates a linear DAG: N0 -> N1 -> N2 -> ... -> N(n-1)
 *
 * @param {number} [count=4]
 * @returns {{ nodes: Array<{id: string}>, edges: Array<{id: string, source: string, target: string}> }}
 */
export function createLinearDag(count = 4) {
  const nodes = [];
  const edges = [];
  for (let i = 0; i < count; i++) {
    nodes.push({ id: `N${i}` });
    if (i > 0) {
      edges.push({
        id: `e_${i - 1}_${i}`,
        source: `N${i - 1}`,
        target: `N${i}`
      });
    }
  }
  return { nodes, edges };
}

/**
 * Creates a single directed cycle: N0 -> N1 -> ... -> N(n-1) -> N0
 *
 * @param {number} [count=3]
 * @returns {{ nodes: Array<{id: string}>, edges: Array<{id: string, source: string, target: string}> }}
 */
export function createSingleCycle(count = 3) {
  const dag = createLinearDag(count);
  if (count > 0) {
    dag.edges.push({
      id: `e_${count - 1}_0`,
      source: `N${count - 1}`,
      target: `N0`
    });
  }
  return dag;
}

/**
 * Creates a 2-node cycle: A <-> B
 */
export function createTwoNodeCycle() {
  return {
    nodes: [{ id: 'A' }, { id: 'B' }],
    edges: [
      { id: 'e_AB', source: 'A', target: 'B' },
      { id: 'e_BA', source: 'B', target: 'A' }
    ]
  };
}

/**
 * Creates a self-loop: A -> A
 */
export function createSelfLoop(nodeId = 'A') {
  return {
    nodes: [{ id: nodeId }],
    edges: [{ id: `e_${nodeId}_${nodeId}`, source: nodeId, target: nodeId }]
  };
}

/**
 * Creates a Figure-8 multi-cycle graph with two cycles intersecting at node C:
 * Cycle 1: A -> B -> C -> A
 * Cycle 2: C -> D -> E -> C
 */
export function createFigure8Graph() {
  return {
    nodes: [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
      { id: 'E' }
    ],
    edges: [
      { id: 'e_AB', source: 'A', target: 'B' },
      { id: 'e_BC', source: 'B', target: 'C' },
      { id: 'e_CA', source: 'C', target: 'A' },
      { id: 'e_CD', source: 'C', target: 'D' },
      { id: 'e_DE', source: 'D', target: 'E' },
      { id: 'e_EC', source: 'E', target: 'C' }
    ]
  };
}

/**
 * Creates a star DAG with center node connecting to multiple leaves.
 */
export function createStarDag(centerId = 'Center', leafCount = 5) {
  const nodes = [{ id: centerId }];
  const edges = [];
  for (let i = 0; i < leafCount; i++) {
    const leafId = `Leaf_${i}`;
    nodes.push({ id: leafId });
    edges.push({
      id: `e_${centerId}_${leafId}`,
      source: centerId,
      target: leafId
    });
  }
  return { nodes, edges };
}

/**
 * Creates a disconnected graph with 3 components:
 * Component 1 (Valid DAG): D1 -> D2 -> D3
 * Component 2 (Cycle): C1 -> C2 -> C1
 * Component 3 (Isolated Orphan): O1
 */
export function createDisconnectedHybridGraph() {
  return {
    nodes: [
      { id: 'D1' }, { id: 'D2' }, { id: 'D3' },
      { id: 'C1' }, { id: 'C2' },
      { id: 'O1' }
    ],
    edges: [
      { id: 'e_D1_D2', source: 'D1', target: 'D2' },
      { id: 'e_D2_D3', source: 'D2', target: 'D3' },
      { id: 'e_C1_C2', source: 'C1', target: 'C2' },
      { id: 'e_C2_C1', source: 'C2', target: 'C1' }
    ]
  };
}

/**
 * Creates a graph with broken edge references (source or target node missing).
 */
export function createBrokenReferenceGraph() {
  return {
    nodes: [{ id: 'A' }, { id: 'B' }],
    edges: [
      { id: 'e_AB', source: 'A', target: 'B' },
      { id: 'e_A_Ghost', source: 'A', target: 'NON_EXISTENT_1' },
      { id: 'e_Ghost_B', source: 'NON_EXISTENT_2', target: 'B' }
    ]
  };
}

/**
 * Creates a multigraph with parallel edges between cyclic nodes:
 * Edge 1: A -> B (calls)
 * Edge 2: A -> B (depends_on)
 * Edge 3: B -> A (depends_on)
 */
export function createMultigraphWithCycle() {
  return {
    nodes: [{ id: 'A' }, { id: 'B' }],
    edges: [
      { id: 'e_AB_1', source: 'A', target: 'B', type: 'calls' },
      { id: 'e_AB_2', source: 'A', target: 'B', type: 'depends_on' },
      { id: 'e_BA_1', source: 'B', target: 'A', type: 'depends_on' }
    ]
  };
}

/**
 * Creates a deep linear chain with N nodes: N0 -> N1 -> ... -> N(N-1)
 */
export function createDeepChain(n = 100) {
  return createLinearDag(n);
}

/**
 * Creates a deep directed cycle with N nodes: N0 -> N1 -> ... -> N(N-1) -> N0
 */
export function createDeepCycle(n = 100) {
  return createSingleCycle(n);
}
