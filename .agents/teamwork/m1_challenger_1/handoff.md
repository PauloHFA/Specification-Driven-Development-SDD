# Milestone 1 Empirical Challenge & Adversarial Stress Report

**Agent**: `m1_challenger_1`
**Roles**: `critic`, `specialist`
**Target Modules**: `src/vault/core/cycle-detector.js`, `src/vault/math/vector3.js`
**Date**: 2026-10-28T16:12:00Z
**Gate Verdict**: **REJECT**

---

## 1. Observation

Direct empirical observations obtained via executing the native Node test harness `test/vault/adversarial-stress.test.js` against the core engine implementation:

Command executed:
```powershell
node --test test/vault/adversarial-stress.test.js
```

Verbatim execution output:
```
▶ Adversarial Stress Harness: Cycle Detector Engine
  ✖ ADV-1.1: Deep circular chains — 500-node circular ring must report hasCycles=true (14.8957ms)
  ✖ ADV-1.2: Degenerate inputs — null and undefined elements in edges array must not throw TypeError (1.1402ms)
  ✖ ADV-1.3: High-density clique subgraphs — K20 complete graph execution and cycle bounding (3.135ms)
  ✔ ADV-1.4: Intersecting multi-cycles — Cloverleaf topology (4 petals sharing central node C) (0.7828ms)
  ✔ ADV-1.5: Intersecting multi-cycles — Nested loops sharing edge A->B (0.1834ms)
  ✔ ADV-1.6: Multigraph with cyclic duplicate parallel edges (0.3598ms)
  ✖ ADV-1.7: Deep linear chain stack safety — 5000-node chain must not exceed call stack (21.0457ms)
✖ Adversarial Stress Harness: Cycle Detector Engine (43.9951ms)
▶ Adversarial Stress Harness: Vector3 Math
  ✔ ADV-2.1: Non-finite coordinates and operations sanitize cleanly (0.5114ms)
  ✔ ADV-2.2: Extreme scalar division guards (0, -0, 1e-13, 1e-150) (0.2897ms)
  ✔ ADV-2.3: Extreme magnitude vectors (1e150) and normalization (0.2763ms)
  ✖ ADV-2.4: Vector3 equality rejects non-finite or empty objects (0.2548ms)
✖ Adversarial Stress Harness: Vector3 Math (1.7899ms)
ℹ tests 11
ℹ suites 2
ℹ pass 6
ℹ fail 5
```

### Specific Defect Observations:

#### Defect 1: Contract Contradiction & False Negative in Deep Circular Chains
- **File**: `src/vault/core/cycle-detector.js`
- **Lines 56, 213, 290**:
  ```javascript
  56:  const maxCycleDepth = options.maxCycleDepth ?? 100;
  ...
  213: if (currentPath.length >= maxCycleDepth) return;
  ...
  290: return {
  291:   hasCycles: cycles.length > 0,
  292:   cycleCount: cycles.length,
  293:   cycles,
  294:   cyclicNodeIds,
  295:   cyclicEdgeIds,
  ...
  ```
- **Observed Behavior**:
  For a 500-node circular ring (`R0 -> R1 -> ... -> R499 -> R0`), `detectCycles(nodes, edges)` produces:
  - `hasCycles: false`
  - `cycleCount: 0`
  - `cycles: []`
  - `cyclicNodeIds.size: 500`
  - `cyclicEdgeIds.size: 500`
  - `nodeStatusMap`: all 500 nodes marked `'circular'`
  - `edgeStatusMap`: all 500 edges marked `'circular'`
- **Failure**: Line 291 couples `hasCycles` strictly to `cycles.length > 0` instead of the SCC classification `cyclicNodeIds.size > 0`. Because DFS enumeration terminates at depth 100 (`maxCycleDepth`), no elementary cycle is collected in `cycles`, resulting in a false-negative `hasCycles: false` while simultaneously classifying all 500 nodes and edges as circular.

#### Defect 2: Unhandled TypeError Crash on Null / Undefined Edge Elements
- **File**: `src/vault/core/cycle-detector.js`
- **Lines 86-88, 267, 285**:
  ```javascript
  86: for (const e of rawEdges) {
  87:   if (!e || typeof e.source !== 'string' || typeof e.target !== 'string') {
  88:     brokenEdges.push(e);
  ...
  267: for (const e of brokenEdges) {
  268:   if (e.source && !nodeMap.has(e.source)) {
  ...
  285: for (const e of brokenEdges) {
  286:   const edgeId = e.id || `${e?.source}->${e?.target}`;
  ```
- **Observed Error**:
  ```
  TypeError: Cannot read properties of null (reading 'source')
      at detectCycles (src/vault/core/cycle-detector.js:267:11)
  ```
- **Failure**: When `edges` contains `null` or `undefined` elements, they are pushed into `brokenEdges`. In subsequent loops at lines 267 and 285, property access `e.source` and `e.id` lack null guards (`e?.source`, `e?.id`), causing a fatal crash.

#### Defect 3: Maximum Call Stack Exhaustion on Chains >= 4600 Nodes
- **File**: `src/vault/core/cycle-detector.js`
- **Lines 117-132**:
  ```javascript
  function strongConnect(u) {
    indices.set(u, index);
    ...
    for (const v of adj.get(u) || []) {
      if (!indices.has(v)) {
        strongConnect(v);
  ```
- **Observed Error**:
  ```
  RangeError: Maximum call stack size exceeded
      at strongConnect (src/vault/core/cycle-detector.js:126:9)
  ```
- **Failure**: Tarjan's SCC algorithm is implemented via unbounded JavaScript call stack recursion. In Node.js (V8 on Windows), any path $\ge 4600$ nodes exhausts the execution stack frame budget and crashes the process.

#### Defect 4: Cycle Limit Overshoot in Dense Cliques
- **File**: `src/vault/core/cycle-detector.js`
- **Lines 207-236**:
  In a complete directed graph $K_{20}$ with `options = { maxCyclesPerScc: 50, maxCyclesTotal: 50 }`, `result.cycles.length` returns `56`.
- **Failure**: Unwinding the recursive DFS call stack does not break the parent neighbor iterations immediately when the cycle cap is reached, allowing up to 6 extra cycles to be collected.

#### Defect 5: Vector3 Semantic Equality Defect
- **File**: `src/vault/math/vector3.js`
- **Lines 393-395**:
  ```javascript
  const vx = Number.isFinite(v.x) ? Number(v.x) : 0;
  const vy = Number.isFinite(v.y) ? Number(v.y) : 0;
  const vz = Number.isFinite(v.z) ? Number(v.z) : 0;
  ```
- **Observed Behavior**:
  `new Vector3(0, 0, 0).equals({}) === true`
  `new Vector3(0, 0, 0).equals({ x: NaN, y: NaN, z: NaN }) === true`
- **Failure**: Any object lacking valid numeric coordinates is coerced to `(0, 0, 0)` during equality comparison, falsely claiming mathematical equivalence between the zero vector and corrupt/empty objects.

---

## 2. Logic Chain

1. **Step 1 (Observation 1.1 -> Logical Deduction)**:
   - In `PROJECT.md` Feature F4 and `ORIGINAL_REQUEST.md` R2/R4, cycle detection is the primary integrity signal driving 3D cable color change and elastic vibration.
   - If `hasCycles` evaluates to `false` for deep cycles (> 100 nodes), any downstream application logic inspecting `if (result.hasCycles)` will assume the graph is clean, disabling cycle visual cues and reporting false health.
   - The contract is internally contradictory: `hasCycles` is `false` and `cycleCount` is `0`, while `cyclicNodeIds.size` is 500 and `nodeStatusMap` marks all nodes as `circular`.
   - Therefore, `hasCycles` must be decoupled from DFS path enumeration depth and anchored in the SCC membership: `hasCycles: cyclicNodeIds.size > 0`.

2. **Step 2 (Observation 1.2 -> Logical Deduction)**:
   - The dispatch mission specifically mandates resilience to degenerate inputs ("degenerate inputs (null nodes, cyclic duplicate edges, empty graphs)").
   - Passing `null` in the edge list causes an unhandled `TypeError` at runtime.
   - This invalidates the zero-crash boundary invariant required for production headless core engines.

3. **Step 3 (Observation 1.3 -> Logical Deduction)**:
   - In recursive Tarjan DFS, call stack growth is proportional to graph depth.
   - A graph of 5000 nodes crashes with `RangeError: Maximum call stack size exceeded`.
   - While realistic SDD specification graphs may rarely reach 5000 sequential dependency hops, a robust engine should either employ an iterative explicit stack or enforce a defensive recursion depth guard.

4. **Step 4 (Observation 1.5 -> Logical Deduction)**:
   - Equality testing in numerical primitives must preserve identity: non-numeric or missing properties should return `false`, not coerce to zero.

---

## 3. Caveats

1. **Camera Kinematics & Elastic Physics**:
   - `src/vault/math/camera-kinematics.js` and `src/vault/physics/spring-damper.js` were evaluated under standard suites (64/64 passing) and were not the primary target of this adversarial challenge.
2. **Path Truncation Tradeoff**:
   - For combinatorial graphs, enumerating all elementary cycles is NP-hard. Capping DFS depth via `maxCycleDepth` is valid and necessary to prevent combinatorial explosion; the bug is strictly that `hasCycles` was derived from the truncated cycle array rather than from the completed $O(V+E)$ SCC decomposition.

---

## 4. Adversarial Review

### Challenge Summary
**Overall Risk Assessment**: **HIGH**

### Challenges

#### Challenge 1 (CRITICAL): False-Negative Cycle Detection on Large Topologies
- **Assumption Challenged**: "Elementary cycle enumeration depth is sufficient to determine graph cyclicity (`hasCycles: cycles.length > 0`)."
- **Attack Scenario**: 500-node circular ring topology.
- **Blast Radius**: Full failure of cycle alerting in the 3D Web UI for any architecture containing cycles spanning more than 100 nodes.
- **Mitigation**: Change line 290 to `hasCycles: cyclicNodeIds.size > 0 || cycles.length > 0`. If `cyclicNodeIds.size > 0 && cycles.length === 0`, ensure `summary.cycleCount` indicates presence of deep cycle or set `cycleCount: nonTrivialSccIndices.size`.

#### Challenge 2 (HIGH): Unhandled Crash on Degenerate Null Edges
- **Assumption Challenged**: "Broken edges always contain defined objects."
- **Attack Scenario**: Edges array containing `null` or `undefined`.
- **Blast Radius**: Unhandled process crash on malformed inputs from external JSON/parsers.
- **Mitigation**: Add null checks in `brokenEdges` iterations: `if (e?.source && !nodeMap.has(e.source))` and `e?.id || (e ? `${e.source}->${e.target}` : `broken_edge_${idx}`)`.

#### Challenge 3 (MEDIUM): Call Stack Overflow in Recursive Tarjan
- **Assumption Challenged**: "V8 call stack can handle arbitrary graph depth."
- **Attack Scenario**: Linear dependency chain of $\ge 4600$ nodes.
- **Blast Radius**: Server/worker process crash with `RangeError: Maximum call stack size exceeded`.
- **Mitigation**: Convert `strongConnect` to an iterative loop with an explicit array stack.

#### Challenge 4 (LOW): Inexact Cycle Cap in Cliques
- **Assumption Challenged**: "DFS cycle count strictly respects `maxCyclesPerScc`."
- **Attack Scenario**: Dense $K_{20}$ complete graph.
- **Blast Radius**: Minor memory/time overshoot.
- **Mitigation**: Add loop break checks in caller frames after `dfsCycle` returns.

#### Challenge 5 (LOW): False-Positive Vector Equality
- **Assumption Challenged**: "Coercing non-finite properties to zero is safe in `equals()`."
- **Attack Scenario**: Comparing `Vector3(0,0,0)` to `{}` or `{ x: NaN }`.
- **Blast Radius**: Logic bugs in spatial deduplication.
- **Mitigation**: Require `Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)` in `equals()`.

### Stress Test Results Matrix
| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| 500-Node Circular Ring | `hasCycles: true`, `cyclicNodes: 500` | `hasCycles: false`, `cyclicNodes: 500` | **FAIL** |
| Null elements in `edges` | Graceful classification into `brokenEdges` | `TypeError: Cannot read properties of null` | **FAIL** |
| $K_{20}$ Complete Graph (Cap 50) | Capped at $\le 50$ cycles | 56 cycles collected | **FAIL** |
| Cloverleaf (4 petals, central node) | 4 cycles detected, 9 cyclic nodes | 4 cycles detected, 9 cyclic nodes | **PASS** |
| Nested Loops (sharing edge A->B) | 2 cycles detected, 4 cyclic nodes | 2 cycles detected, 4 cyclic nodes | **PASS** |
| Multigraph duplicate cyclic edges | All 4 duplicate edges flagged cyclic | All 4 duplicate edges flagged cyclic | **PASS** |
| 5000-Node Linear Chain | Clean pass without recursion crash | `RangeError: Maximum call stack size exceeded` | **FAIL** |
| Vector3 Non-finite Coercion | Coerced to 0 without NaN propagation | Coerced to 0 without NaN propagation | **PASS** |
| Vector3 Zero/Sub-epsilon Division | Resets to (0,0,0) without NaN | Resets to (0,0,0) without NaN | **PASS** |
| Vector3 Extreme Magnitudes (1e150) | Finite length, normalized to unit vector | Finite length, normalized to unit vector | **PASS** |
| Vector3 Equality with `{}` | Returns `false` | Returns `true` | **FAIL** |

### Unchallenged Areas
- WebGL / Three.js shader rendering (M3 scope).
- SDD file parsing (M2 scope).

---

## 5. Conclusion

**Gate Verdict**: **REJECT**

Milestone 1 Core Engine cannot be approved in its current state due to two high-severity defects that violate basic contract integrity:
1. **Critical Contract Inconsistency**: `detectCycles` returns `hasCycles: false` for deep cycles (500 nodes), directly contradicting its own `nodeStatusMap` and `cyclicNodeIds`.
2. **Unhandled Exception**: `detectCycles` crashes with a fatal `TypeError` when given null edges in degenerate inputs.

**Remediation Required Before Approval**:
1. Fix `src/vault/core/cycle-detector.js` line 290 to define `hasCycles: cyclicNodeIds.size > 0 || cycles.length > 0`.
2. Add null-safe property access in `brokenEdges` processing at lines 266-288.
3. Fix `src/vault/math/vector3.js` `equals()` to return `false` if `v` coordinates are not finite.
4. Pass 100% of the 11 tests in `test/vault/adversarial-stress.test.js`.

---

## 6. Verification Method

To independently reproduce and verify every finding in this report:

```powershell
# Run the adversarial stress test suite:
node --test test/vault/adversarial-stress.test.js

# Reproduce the 500-node ring false negative:
node -e "import('./src/vault/core/cycle-detector.js').then(({ detectCycles }) => { const N=500, nodes=Array.from({length:N},(_,i)=>({id:'R'+i})), edges=nodes.map((n,i)=>({source:n.id,target:'R'+((i+1)%N)})); const r=detectCycles(nodes,edges); console.log('hasCycles:', r.hasCycles, 'cyclicNodes:', r.cyclicNodeIds.size); });"

# Reproduce the null edge TypeError crash:
node -e "import('./src/vault/core/cycle-detector.js').then(({ detectCycles }) => detectCycles([{id:'A'}], [null]));"
```
