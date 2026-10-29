/**
 * @file src/vault/core/cycle-detector.js
 * @description Linear-time O(V+E) Tarjan SCC + 3-color DFS cycle detector and graph integrity classifier.
 * Detects all directed cycles, isolates cyclic nodes and cyclic edges, and classifies graph integrity.
 * Pure ESM, zero runtime dependencies. Node.js >= 18.
 */

import { NodeStatus, EdgeStatus } from './graph-model.js';

/**
 * Normalizes an elementary cycle into canonical rotational form:
 * starting and ending with the lexicographically smallest node ID.
 * @param {string[]} cycle - Raw cycle array [v0, v1, ..., vk, v0]
 * @returns {string[]} Canonicalized cycle array
 */
function canonicalizeCycle(cycle) {
  if (!cycle || cycle.length <= 1) return cycle;
  // Sequence of vertices without repeated closing vertex
  const seq = cycle.slice(0, cycle.length - 1);
  let minIdx = 0;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] < seq[minIdx]) {
      minIdx = i;
    }
  }
  const rotated = seq.slice(minIdx).concat(seq.slice(0, minIdx));
  return rotated.concat(rotated[0]);
}

/**
 * Detects all directed cycles and classifies node and edge integrity.
 *
 * @param {Array<{id: string}>} [nodes=[]] - List of graph node objects
 * @param {Array<{id?: string, source: string, target: string}>} [edges=[]] - List of directed edges
 * @param {Object} [options={}] - Configuration options
 * @param {number} [options.maxCyclesPerScc=50] - Guard against combinatorial blowup
 * @param {number} [options.maxCyclesTotal=200] - Global cycle collection limit
 * @param {number} [options.maxCycleDepth=100] - Recursion depth limit
 * @returns {{
 *   hasCycles: boolean,
 *   cycleCount: number,
 *   cycles: string[][],
 *   cyclicNodeIds: Set<string>,
 *   cyclicEdgeIds: Set<string>,
 *   nodeStatusMap: Map<string, 'valid'|'circular'|'broken'|'orphan'>,
 *   edgeStatusMap: Map<string, 'valid'|'circular'|'error'>,
 *   sccs: string[][],
 *   brokenEdges: Object[],
 *   orphanNodeIds: Set<string>,
 *   summary: Object
 * }}
 */
export function detectCycles(nodes = [], edges = [], options = {}) {
  const maxCyclesPerScc = options.maxCyclesPerScc ?? 50;
  const maxCyclesTotal = options.maxCyclesTotal ?? 200;
  const maxCycleDepth = options.maxCycleDepth ?? 1000;

  const nodeMap = new Map();
  if (Array.isArray(nodes)) {
    for (const n of nodes) {
      if (n && n.id) nodeMap.set(String(n.id), n);
    }
  } else if (nodes instanceof Map) {
    for (const [id, n] of nodes.entries()) {
      if (n && (n.id || id)) nodeMap.set(String(n.id || id), n);
    }
  }

  const rawEdges = Array.isArray(edges) ? edges : (edges instanceof Map ? Array.from(edges.values()) : []);

  const brokenEdges = [];
  const validEdges = [];
  const edgeLookup = new Map(); // key: "source->target" -> Array of edges
  const adj = new Map();        // key: source -> Array of target IDs
  const inDegree = new Map();
  const outDegree = new Map();

  for (const id of nodeMap.keys()) {
    adj.set(id, []);
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }

  // 1. Endpoint validation & Multi-edge indexing
  for (const e of rawEdges) {
    if (!e || typeof e.source !== 'string' || typeof e.target !== 'string') {
      brokenEdges.push(e);
      continue;
    }

    const hasSource = nodeMap.has(e.source);
    const hasTarget = nodeMap.has(e.target);

    if (!hasSource || !hasTarget) {
      brokenEdges.push(e);
      continue;
    }

    validEdges.push(e);
    adj.get(e.source).push(e.target);
    outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);

    const key = `${e.source}->${e.target}`;
    if (!edgeLookup.has(key)) edgeLookup.set(key, []);
    edgeLookup.get(key).push(e);
  }

  // 2. Tarjan's Strongly Connected Components Algorithm - Iterative O(V + E)
  let index = 0;
  const indices = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];

  for (const rootId of nodeMap.keys()) {
    if (indices.has(rootId)) continue;

    indices.set(rootId, index);
    lowlink.set(rootId, index);
    index++;
    stack.push(rootId);
    onStack.add(rootId);

    const callStack = [{
      u: rootId,
      neighbors: adj.get(rootId) || [],
      nextIdx: 0
    }];

    while (callStack.length > 0) {
      const top = callStack[callStack.length - 1];
      const u = top.u;

      if (top.nextIdx < top.neighbors.length) {
        const v = top.neighbors[top.nextIdx++];
        if (!indices.has(v)) {
          indices.set(v, index);
          lowlink.set(v, index);
          index++;
          stack.push(v);
          onStack.add(v);

          callStack.push({
            u: v,
            neighbors: adj.get(v) || [],
            nextIdx: 0
          });
        } else if (onStack.has(v)) {
          lowlink.set(u, Math.min(lowlink.get(u), indices.get(v)));
        }
      } else {
        if (lowlink.get(u) === indices.get(u)) {
          const scc = [];
          let w;
          do {
            w = stack.pop();
            onStack.delete(w);
            scc.push(w);
          } while (w !== u);
          sccs.push(scc);
        }

        callStack.pop();

        if (callStack.length > 0) {
          const parent = callStack[callStack.length - 1];
          lowlink.set(parent.u, Math.min(lowlink.get(parent.u), lowlink.get(u)));
        }
      }
    }
  }

  // 3. Map SCC membership and identify cyclic nodes/edges via Fundamental Theorem
  const nodeSccMap = new Map(); // node ID -> sccIndex
  const nonTrivialSccIndices = new Set();
  const cyclicNodeIds = new Set();
  const cyclicEdgeIds = new Set();

  for (let sccIdx = 0; sccIdx < sccs.length; sccIdx++) {
    const scc = sccs[sccIdx];
    for (const u of scc) {
      nodeSccMap.set(u, sccIdx);
    }

    if (scc.length > 1) {
      nonTrivialSccIndices.add(sccIdx);
      for (const u of scc) cyclicNodeIds.add(u);
    } else if (scc.length === 1) {
      const u = scc[0];
      // Check for self-loop (u -> u)
      if ((adj.get(u) || []).includes(u)) {
        nonTrivialSccIndices.add(sccIdx);
        cyclicNodeIds.add(u);
      }
    }
  }

  // Identify all cyclic edges: edge (u, v) where u and v belong to same non-trivial SCC
  for (const e of validEdges) {
    const sccU = nodeSccMap.get(e.source);
    const sccV = nodeSccMap.get(e.target);
    if (sccU !== undefined && sccU === sccV && nonTrivialSccIndices.has(sccU)) {
      cyclicEdgeIds.add(e.id || `${e.source}->${e.target}`);
    }
  }

  // 4. Elementary Cycle Enumeration via 3-Color DFS with Canonical Rotation
  const cycles = [];
  const seenCycleKeys = new Set();

  for (const sccIdx of nonTrivialSccIndices) {
    if (cycles.length >= maxCyclesTotal) break;
    const scc = sccs[sccIdx];
    const sccSet = new Set(scc);

    // Case A: Self-loop
    if (scc.length === 1) {
      const u = scc[0];
      const cycle = [u, u];
      const key = `${u}->${u}`;
      if (!seenCycleKeys.has(key)) {
        seenCycleKeys.add(key);
        cycles.push(cycle);
      }
      continue;
    }

    // Case B: Non-trivial SCC (|S| > 1)
    let sccCycleCount = 0;
    const activePath = new Set();
    const currentPath = [];

    function dfsCycle(curr, startNode) {
      if (cycles.length >= maxCyclesTotal || sccCycleCount >= maxCyclesPerScc) return;
      if (currentPath.length >= maxCycleDepth) return;

      activePath.add(curr);
      currentPath.push(curr);

      const neighbors = adj.get(curr) || [];
      for (const next of neighbors) {
        if (cycles.length >= maxCyclesTotal || sccCycleCount >= maxCyclesPerScc) break;
        if (!sccSet.has(next)) continue;

        if (next === startNode) {
          // Elementary cycle found starting and ending at startNode
          const rawCycle = [...currentPath, next];
          const canonical = canonicalizeCycle(rawCycle);
          const key = canonical.join('->');
          if (!seenCycleKeys.has(key)) {
            seenCycleKeys.add(key);
            cycles.push(canonical);
            sccCycleCount++;
            if (cycles.length >= maxCyclesTotal || sccCycleCount >= maxCyclesPerScc) break;
          }
        } else if (!activePath.has(next) && next > startNode) {
          // Lexicographic ordering constraint (Johnson trick) eliminates rotational duplicates
          dfsCycle(next, startNode);
          if (cycles.length >= maxCyclesTotal || sccCycleCount >= maxCyclesPerScc) break;
        }
      }

      currentPath.pop();
      activePath.delete(curr);
    }

    // Start DFS from each vertex in SCC
    for (const v of scc) {
      if (cycles.length >= maxCyclesTotal || sccCycleCount >= maxCyclesPerScc) break;
      dfsCycle(v, v);
    }
  }

  // Fallback: If DFS path collection was truncated but cyclicNodeIds exist
  if (cycles.length === 0 && cyclicNodeIds.size > 0) {
    for (const sccIdx of nonTrivialSccIndices) {
      const scc = sccs[sccIdx];
      if (!scc || scc.length === 0) continue;
      const sccSet = new Set(scc);

      const visitedIndex = new Map();
      const path = [];
      let curr = scc[0];

      while (curr && !visitedIndex.has(curr)) {
        visitedIndex.set(curr, path.length);
        path.push(curr);
        const nexts = (adj.get(curr) || []).filter(v => sccSet.has(v));
        if (nexts.length === 0) break;
        curr = nexts[0];
      }

      if (curr && visitedIndex.has(curr)) {
        const startIdx = visitedIndex.get(curr);
        const cycleNodes = path.slice(startIdx);
        cycleNodes.push(curr);
        const canonical = canonicalizeCycle(cycleNodes);
        const key = canonical.join('->');
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push(canonical);
        }
      }

      if (cycles.length >= maxCyclesTotal) break;
    }
  }

  // 5. Construct Status Maps complying with PROJECT.md Interface Contract
  const nodeStatusMap = new Map();
  const orphanNodeIds = new Set();

  for (const id of nodeMap.keys()) {
    if (cyclicNodeIds.has(id)) {
      nodeStatusMap.set(id, NodeStatus.CIRCULAR);
    } else if ((inDegree.get(id) || 0) === 0 && (outDegree.get(id) || 0) === 0) {
      nodeStatusMap.set(id, NodeStatus.ORPHAN);
      orphanNodeIds.add(id);
    } else {
      nodeStatusMap.set(id, NodeStatus.VALID);
    }
  }

  // Mark nonexistent nodes referenced by broken edges as 'broken'
  for (const e of brokenEdges) {
    if (e && e.source && !nodeMap.has(e.source)) {
      nodeStatusMap.set(e.source, NodeStatus.BROKEN);
    }
    if (e && e.target && !nodeMap.has(e.target)) {
      nodeStatusMap.set(e.target, NodeStatus.BROKEN);
    }
  }

  const edgeStatusMap = new Map();
  for (const e of validEdges) {
    const edgeId = e.id || `${e.source}->${e.target}`;
    if (cyclicEdgeIds.has(edgeId)) {
      edgeStatusMap.set(edgeId, EdgeStatus.CIRCULAR);
    } else {
      edgeStatusMap.set(edgeId, EdgeStatus.VALID);
    }
  }
  let brokenNullCounter = 0;
  for (const e of brokenEdges) {
    if (!e) {
      edgeStatusMap.set(`broken_null_${++brokenNullCounter}`, EdgeStatus.ERROR);
      continue;
    }
    const edgeId = e.id || `${e.source}->${e.target}`;
    edgeStatusMap.set(edgeId, EdgeStatus.ERROR);
  }

  const hasCycles = cyclicNodeIds.size > 0 || cycles.length > 0;
  const cycleCount = hasCycles ? Math.max(cycles.length, 1) : 0;

  return {
    hasCycles,
    cycleCount,
    cycles,
    cyclicNodeIds,
    cyclicEdgeIds,
    nodeStatusMap,
    edgeStatusMap,
    sccs,
    brokenEdges,
    orphanNodeIds,
    summary: {
      totalNodes: nodeMap.size,
      totalEdges: rawEdges.length,
      validEdgesCount: validEdges.length,
      brokenEdgesCount: brokenEdges.length,
      cyclicNodesCount: cyclicNodeIds.size,
      cyclicEdgesCount: cyclicEdgeIds.size,
      orphanNodesCount: orphanNodeIds.size,
      cycleCount,
      sccCount: sccs.length
    }
  };
}
