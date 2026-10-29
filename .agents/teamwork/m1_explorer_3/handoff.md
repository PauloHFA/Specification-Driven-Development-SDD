# Handoff Report: Graph Core & Cycle Detection Modules (Milestone 1)

**Agent**: `m1_explorer_3`  
**Working Directory**: `c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\m1_explorer_3`  
**Milestone**: Milestone 1 (M1) — Core 3D Math, Cycle Detection & Physics Engine  
**Target Files Specified**:
- `src/vault/core/graph-model.js` (Graph schema, nodes, edges, enums, integrity tags)
- `src/vault/core/cycle-detector.js` (Tarjan SCC + 3-color DFS cycle detector)
- `test/vault/cycle-detector.test.js` (Automated verification suite)  
**Date**: 2026-10-28T15:45:00Z  

---

## 1. Observation

### 1.1 Direct Quotes from Authoritative Requirements

1. **`ORIGINAL_REQUEST.md`**:
   - **Line 5**: `"Construir o Cofre 3D de Documentação & Diagramas (Spatial Knowledge Graph), uma ferramenta interativa para visualização e navegação espacial de anotações técnicas, componentes de software e especificações do framework de SDD do projeto em um espaço vetorial 3D contínuo, servindo como uma vitrine de alto impacto visual com física elástica e detecção de dependências."`
   - **Lines 14-16 (R2)**: `"Conectar nós conceituais e dependências entre componentes (ex: "Serviço A chama API B") por linhas elásticas com simulação física em tempo real. As conexões devem reagir visualmente às regras de integridade do grafo: linhas estáveis com cor padrão em conexões normais, e linhas que mudam de cor e vibram fisicamente ao detectar erro de validação ou dependência circular."`
   - **Lines 32-33**:
     - `"Em grafos válidos sem erros de ciclo, as linhas conectivas permanecem estáveis com cor normal e sem vibração."`
     - `"Em cenários com dependência circular ou falha de validação, as conexões envolvidas no ciclo mudam de cor para indicar estado de erro e executam animação contínua de vibração física."`
   - **Line 40**: `"A suíte de testes automatizados executa e passa com sucesso, validando a detecção e o isolamento de dependências circulares em grafos de teste sintéticos."`

2. **`PROJECT.md` Interface Contract**:
   - **Lines 5-8**: `"Headless Core Engine (src/vault/): Pure ES Modules runnable directly in Node.js >= 18 with zero external runtime dependencies. Encompasses 3D vector math, camera kinematics with smooth lerp interpolation, damped Hooke's law spring-damper physics, $O(V+E)$ Tarjan SCC + 3-color DFS cycle detector, standing wave harmonic vibration generator, and SDD specification adapter."`
   - **Lines 80-84**:
     ```javascript
     // Contract for src/vault/core/cycle-detector.js:
     detectCycles(nodes, edges)
     // Input: nodes: Array<{id: string}>, edges: Array<{id: string, source: string, target: string}>
     // Output: {
     //   hasCycles: boolean,
     //   cycleCount: number,
     //   cycles: Array<Array<string>>,
     //   cyclicNodeIds: Set<string>,
     //   cyclicEdgeIds: Set<string>,
     //   nodeStatusMap: Map<string, 'valid'|'circular'|'broken'|'orphan'>,
     //   edgeStatusMap: Map<string, 'valid'|'circular'|'error'>
     // }
     ```

3. **Incoming Dispatch Mission**:
   - `"Perform technical exploration and detailed implementation planning for the Graph Core & Cycle Detection modules of Milestone 1:`
     - `src/vault/core/graph-model.js`: pure ESM classes/factories for `VaultGraphNode` and `VaultGraphEdge`, status enums (`valid`, `circular`, `broken`, `orphan`), integrity tags.
     - `src/vault/core/cycle-detector.js`: pure ESM function `detectCycles(nodes, edges)` implementing linear-time $O(V+E)$ Tarjan's Strongly Connected Components algorithm combined with 3-color DFS to enumerate elementary directed cycles, identify all cyclic nodes and edges, and classify graph integrity.
     `Specify exact return signatures, edge cases (self-loops A->A, 2-node cycles A<->B, figure-8 cycles, disconnected DAGs), and unit testing strategy."`

4. **Repository Architecture Constraints (`package.json`, `ARQUITETURA.md`)**:
   - Native Node.js >= 18 with `"type": "module"`.
   - Zero external dependencies in `package.json` (`node:test`, `node:assert/strict`).
   - Pure ESM syntax with explicit `.js` import specifiers.

---

## 2. Logic Chain

### 2.1 Graph Core Domain & Model Design (`src/vault/core/graph-model.js`)

#### 2.1.1 Status Enums & Integrity Tags
The graph model must provide canonical immutable enums to classify graph components:

```javascript
export const NodeStatus = Object.freeze({
  VALID: 'valid',       // Healthy, connected node in an acyclic subgraph
  CIRCULAR: 'circular', // Participating in at least one directed cycle
  BROKEN: 'broken',     // Referenced by an edge but missing or corrupted
  ORPHAN: 'orphan'      // Isolated node with 0 degree (no incoming or outgoing edges)
});

export const EdgeStatus = Object.freeze({
  VALID: 'valid',       // Acyclic valid directed connection
  CIRCULAR: 'circular', // Involved in at least one directed cycle (triggers red vibration)
  BROKEN: 'broken',     // Endpoint node is missing or nonexistent in graph
  ERROR: 'error'        // Validation error or broken reference (alias / category for UI)
});

export const IntegrityTag = Object.freeze({
  CLEAN: 'CLEAN',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  SELF_LOOP: 'SELF_LOOP',
  ORPHAN_NODE: 'ORPHAN_NODE',
  BROKEN_REFERENCE: 'BROKEN_REFERENCE',
  MISSING_SOURCE: 'MISSING_SOURCE',
  MISSING_TARGET: 'MISSING_TARGET',
  DUPLICATE_EDGE: 'DUPLICATE_EDGE'
});

export const NodeType = Object.freeze({
  FEATURE: 'feature',
  STORY: 'story',
  CRITERION: 'criterion',
  TASK: 'task',
  PRINCIPLE: 'principle',
  ASSUMPTION: 'assumption',
  QUESTION: 'question',
  FILE: 'file',
  TEST: 'test',
  COMPONENT: 'component',
  SERVICE: 'service',
  GENERIC: 'generic'
});

export const EdgeType = Object.freeze({
  CONTAINS: 'contains',
  IMPLEMENTS: 'implements',
  MODIFIES: 'modifies',
  VERIFIES: 'verifies',
  CONSTRAINS: 'constrains',
  CALLS: 'calls',
  DEPENDS_ON: 'depends_on',
  GENERIC: 'generic'
});
```

#### 2.1.2 Class Design: `VaultGraphNode`
The node represents an entity in the 3D space:
- Properties:
  - `id: string` (Globally unique identifier, e.g. `'US-001'`, `'OrderService'`)
  - `title: string` (Human-readable label)
  - `type: string` (One of `NodeType`)
  - `status: string` (One of `NodeStatus`, default `'valid'`)
  - `snippet: string` (Given/When/Then text, markdown or code snippet)
  - `position: { x: number, y: number, z: number }` (Continuous 3D spatial vector)
  - `velocity: { x: number, y: number, z: number }` (Physical velocity for spring simulation)
  - `mass: number` (Physical mass, default 1.0)
  - `tags: Set<string>` (Integrity tags)
  - `auditFindings: Array<object>` (Findings mapped from `src/core/audit.js`)
  - `metadata: object` (Arbitrary properties: feature, file, line, effort, model)
- Methods:
  - `setStatus(status)`: Validates and sets status.
  - `addTag(tag)`, `removeTag(tag)`, `hasTag(tag)`: Tag manipulation.
  - `addAuditFinding(finding)`: Records audit issue.
  - `setPosition(x, y, z)`: Updates 3D coordinates.
  - `clone()`: Deep clone.
  - `toJSON()`: Plain serializable JS object.
  - `static fromJSON(data)`: Factory constructor from plain object.

#### 2.1.3 Class Design: `VaultGraphEdge`
The edge represents a directed connection between two nodes:
- Properties:
  - `id: string` (Defaults to `${source}->${target}`)
  - `source: string` (Source node id)
  - `target: string` (Target node id)
  - `type: string` (One of `EdgeType`, default `'depends_on'`)
  - `directed: boolean` (Default `true`)
  - `status: string` (One of `EdgeStatus`, default `'valid'`)
  - `tags: Set<string>` (Integrity tags)
  - `metadata: object`
  - `visualStyle: object`:
    - `color: string` (`'#38bdf8'` for valid, `'#ef4444'` for circular crimson, `'#f59e0b'` for error)
    - `stiffness: number` (Elastic constant $k$, default $0.25$)
    - `damping: number` (Damping ratio $\zeta$, default $0.85$)
    - `restLength: number` (Natural rest length $L_0$, default $80.0$)
    - `amplitude: number` (Vibration amplitude, default $5.0$)
    - `frequency: number` (Vibration frequency, default $12.0\text{ Hz}$)
  - `isVibrating: boolean` (Getter/setter returning `status === EdgeStatus.CIRCULAR`)
- Methods:
  - `setStatus(status)`: Automatically adjusts `visualStyle.color` and vibration flag.
  - `getKey()`: Returns `${source}->${target}`.
  - `clone()`, `toJSON()`, `static fromJSON(data)`.

#### 2.1.4 Container Class: `VaultGraph`
A container facilitating indexed node and edge queries:
- Stores `nodes: Map<string, VaultGraphNode>` and `edges: Map<string, VaultGraphEdge>`.
- Indexes incoming and outgoing adjacency lists.
- Provides `addNode(node)`, `addEdge(edge)`, `getNode(id)`, `getEdge(id)`, `getOutgoing(id)`, `getIncoming(id)`, `getDegree(id)`.

---

### 2.2 Mathematical Modeling for Cycle Detection (`src/vault/core/cycle-detector.js`)

#### 2.2.1 Problem Formulation & Algorithmic Optimality
A directed graph $G = (V, E)$ consists of vertices $V$ and directed edges $E \subseteq V \times V$.
A directed cycle is a sequence of vertices $\langle v_0, v_1, \dots, v_k \rangle$ where:
1. $k \ge 1$
2. For all $0 \le i < k$, $(v_i, v_{i+1}) \in E$
3. $v_0 = v_k$
4. If $k > 1$, vertices $v_0, v_1, \dots, v_{k-1}$ are pairwise distinct (elementary cycle). If $k=1$, $(v_0, v_0) \in E$ is a self-loop.

Naively detecting all cycles via plain backtracking DFS across the entire graph has exponential worst-case time complexity $O((V+E) \cdot (c+1))$ where $c$ is the number of cycles, which blows up if applied globally.

**Solution: The Two-Tiered Hybrid Tarjan SCC + 3-Color DFS Algorithm**:
1. **Tier 1: Tarjan's Strongly Connected Components Decomposition**:
   - Tarjan's algorithm partitions $V$ into disjoint maximal strongly connected components $S_1, S_2, \dots, S_m$ in guaranteed linear time:
     $$\mathcal{O}(|V| + |E|)$$
   - *Strong Connectivity Principle*: Any directed cycle in $G$ is strictly confined within a single SCC!
   - *Pruning Property*: Any SCC with $|S_i| = 1$ that contains no self-loop $(u, u) \notin E$ is mathematically provable to contain ZERO cycles and ZERO cyclic edges!
   - Therefore, cycle search and classification can be pruned to non-trivial SCCs ($|S_i| > 1$) and self-loops.

#### 2.2.2 The Fundamental Theorem of Cyclic Edges
*Theorem*: In a directed graph $G = (V, E)$, an edge $e = (u, v) \in E$ participates in at least one directed cycle if and only if $u$ and $v$ belong to the same Strongly Connected Component $S$ (and if $|S|=1$, $u=v$).

*Proof*:
1. $(\implies)$ Suppose $e = (u, v)$ is part of a directed cycle $C = \langle u, v, w_1, w_2, \dots, w_p, u \rangle$.
   Then there exists a directed path from $u$ to $v$ (the edge $e$), and a directed path from $v$ to $u$ (the subpath $v \to w_1 \dots \to u$).
   Since $u$ and $v$ are mutually reachable, they belong to the same Strongly Connected Component $S$.
2. $(\impliedby)$ Suppose $u$ and $v$ belong to the same SCC $S$.
   - If $u = v$, then $e = (u, u)$ is a self-loop, which is a directed cycle of length 1 containing $e$.
   - If $u \ne v$, by definition of strong connectivity, there exists a directed simple path $P$ in $S$ from $v$ to $u$.
   Combining edge $e = (u, v)$ with path $P$ yields a directed closed walk $u \to v \xrightarrow{P} u$, which contains an elementary directed cycle containing $e$.
   $\blacksquare$

**Impact of this Theorem**:
- We can determine **all cyclic nodes** and **all cyclic edges** in **exact $O(V+E)$ time** directly from the Tarjan SCC partitioning without having to enumerate an exponential number of cycle paths!
- `cyclicNodeIds`: Every node belonging to an SCC with $|S| > 1$, plus singletons with a self-loop.
- `cyclicEdgeIds`: Every edge $e = (u, v)$ where $u$ and $v$ share the same SCC ID (and for $|S|=1$, $u=v$).

#### 2.2.3 Tier 2: Elementary Cycle Enumeration via 3-Color DFS & Canonical Rotation
For user inspection, HUD drawer display, and automated tests, explicit cycle sequences (e.g. `['US-001', 'AC-001', 'T-001', 'US-001']`) must be extracted.
To extract elementary cycles within each non-trivial SCC:
1. **Self-Loops ($|S|=1$)**:
   - If edge $(u, u) \in E$, cycle is `[u, u]`.
2. **Non-Trivial SCCs ($|S| > 1$)**:
   - We run a bounded 3-color DFS within the subgraph induced by the SCC.
   - To prevent duplicate rotations (e.g. detecting `A -> B -> C -> A`, `B -> C -> A -> B`, and `C -> A -> B -> C` as 3 separate cycles):
     - **Canonical Rotation**: For any detected cycle $\langle c_0, c_1, \dots, c_{k-1}, c_0 \rangle$, find the lexicographically minimum vertex $c_{\min}$ at index $m$.
     - Rotate the sequence so $c_{\min}$ is the head:
       $$\text{canonical} = [c_m, c_{m+1}, \dots, c_{k-1}, c_0, \dots, c_{m-1}, c_m]$$
     - Key string: `canonical.join('->')`.
     - Insert into `cycles` array only if the canonical key has not been seen before.
   - **Combinatorial Budget Protection**:
     - To ensure worst-case bounded execution even on dense graphs (e.g. complete graphs $K_n$), the cycle extractor enforces:
       `maxCyclesPerScc = 50`, `maxCyclesTotal = 200`, and `maxDepth = 100`.
     - Note that even if path enumeration is capped, the exact sets `cyclicNodeIds` and `cyclicEdgeIds` remain 100% complete and accurate via the $O(V+E)$ SCC theorem!

#### 2.2.4 Integrity Classification Logic
1. **Broken Edges & Missing Nodes**:
   - An edge $e$ whose `source` or `target` is not in `nodes` is isolated into `brokenEdges`.
   - In `edgeStatusMap`: mapped to `'error'`.
   - In `nodeStatusMap`: the missing referenced ID is registered as `'broken'`.
   - Broken edges are excluded from Tarjan's SCC adjacency map to prevent undefined dereferences.
2. **Cyclic Nodes & Edges**:
   - Nodes in `cyclicNodeIds` are mapped to `'circular'`.
   - Edges in `cyclicEdgeIds` are mapped to `'circular'`.
3. **Orphan Nodes**:
   - Any node present in `nodes` with total degree 0 (in-degree = 0 and out-degree = 0 across all valid edges) is mapped to `'orphan'`.
4. **Valid Nodes & Edges**:
   - Non-cyclic, non-orphan existing nodes are mapped to `'valid'`.
   - Non-cyclic, non-broken edges are mapped to `'valid'`.

---

### 2.3 Detailed Edge Case Analysis

| # | Edge Case Topology | Graph Configuration | Algorithmic Behavior | Expected Output Invariants |
|---|---|---|---|---|
| 1 | **Self-Loop** | Node $A$, edge $e_1: A \to A$ | Tarjan produces SCC $\{A\}$. Singleton check finds $(A, A) \in E$. Flags SCC as non-trivial cycle. | `hasCycles: true`, `cycleCount: 1`, `cycles: [['A', 'A']]`, `cyclicNodeIds: {'A'}`, `cyclicEdgeIds: {e_1.id}`, `nodeStatusMap.get('A') === 'circular'`, `edgeStatusMap.get(e_1.id) === 'circular'`. |
| 2 | **2-Node Cycle (`A <-> B`)** | Nodes $A, B$, edges $e_1: A \to B$, $e_2: B \to A$ | Tarjan identifies SCC $\{A, B\}$ of size 2. Both nodes mutually reachable. Back-edge found in DFS. | `hasCycles: true`, `cycleCount: 1`, `cycles: [['A', 'B', 'A']]`, `cyclicNodeIds: {'A', 'B'}`, `cyclicEdgeIds: {e_1.id, e_2.id}`, both nodes and edges marked `'circular'`. |
| 3 | **Figure-8 Intersecting Cycles** | Cycle 1: $A \to B \to C \to A$<br>Cycle 2: $C \to D \to E \to C$<br>Node $C$ is shared articulation point | Since all 5 nodes are mutually reachable through $C$, Tarjan produces single SCC $\{A, B, C, D, E\}$. DFS extracts both elementary cycles and canonicalizes them. | `hasCycles: true`, `cycleCount: 2`, `cycles: [['A', 'B', 'C', 'A'], ['C', 'D', 'E', 'C']]` (or sorted), all 5 nodes in `cyclicNodeIds`, all 6 edges in `cyclicEdgeIds`. |
| 4 | **Disconnected DAGs** | Subgraph 1: $A \to B \to C$<br>Subgraph 2: $D \to E$<br>Subgraph 3: $F$ (isolated) | Tarjan produces 6 singleton SCCs with no self-loops. | `hasCycles: false`, `cycleCount: 0`, `cycles: []`, `cyclicNodeIds: Set(0)`, `cyclicEdgeIds: Set(0)`. Nodes $A, B, C, D, E$ marked `'valid'`, $F$ marked `'orphan'`. All edges marked `'valid'`. |
| 5 | **Disjoint Hybrid Graph** | Subgraph 1 (valid DAG): $A \to B \to C$<br>Subgraph 2 (cycle): $X \to Y \to X$<br>Subgraph 3 (orphan): $Z$ | Tarjan separates SCC $\{X, Y\}$ from $\{A\}$, $\{B\}$, $\{C\}$, $\{Z\}$. Strict isolation between valid and cyclic parts. | `hasCycles: true`, `cycleCount: 1`, `cycles: [['X', 'Y', 'X']]`. $X, Y$ marked `'circular'`, $A, B, C$ marked `'valid'`, $Z$ marked `'orphan'`. Edges in Subgraph 1 marked `'valid'`, edges in Subgraph 2 marked `'circular'`. |
| 6 | **Parallel / Multigraph Edges** | Nodes $A, B$, edges $e_1: A \to B$, $e_2: A \to B$ (e.g. `calls` and `depends_on`), $e_3: B \to A$ | Multi-edge indexing groups $e_1$ and $e_2$ under key `A->B`. When cycle $A \to B \to A$ is detected, ALL edges connecting $A \to B$ and $B \to A$ are flagged. | `cyclicEdgeIds` contains $e_1.id, e_2.id, e_3.id$. All 3 edges marked `'circular'`. |
| 7 | **Dangling / Broken References** | Edge $e_1: A \to \text{MISSING}$, Node $A$ exists, $\text{MISSING}$ not in `nodes` | Edge validation isolates $e_1$ into `brokenEdges`. Tarjan is executed only on valid endpoint subgraph. | `brokenEdges.length === 1`, `edgeStatusMap.get(e_1.id) === 'error'`, `nodeStatusMap.get('MISSING') === 'broken'`, $A$ remains `'valid'` or `'orphan'`. |
| 8 | **Empty Graph** | `nodes: []`, `edges: []` | Guard clause returns immediately. | `hasCycles: false`, `cycleCount: 0`, empty sets and maps. |
| 9 | **Single Isolated Node** | `nodes: [{id: 'A'}]`, `edges: []` | 0 in-degree, 0 out-degree. | `hasCycles: false`, `cyclicNodeIds.size === 0`, `nodeStatusMap.get('A') === 'orphan'`. |
| 10 | **Large Deep Ring ($N=100$)** | $N_1 \to N_2 \to \dots \to N_{100} \to N_1$ | Linear $O(V+E)$ Tarjan processes in $< 1\text{ ms}$. Stack depth 100 is within Node.js limits. | `hasCycles: true`, `cycleCount: 1`, `cyclicNodeIds.size === 100`, `cyclicEdgeIds.size === 100`. |

---

## 3. Caveats & Assumptions

1. **Worst-Case Elementary Cycle Combinatorics**:
   - In arbitrary directed graphs, the total number of elementary cycles can grow exponentially (e.g., a complete directed clique $K_N$ has $\sum_{k=1}^N \binom{N}{k} \frac{(k-1)!}{2}$ cycles).
   - *Mitigation*: Our cycle detector implements strict limits (`maxCyclesPerScc = 50`, `maxCyclesTotal = 200`). Crucially, because **cyclic node and edge identification relies on Tarjan SCC** rather than path enumeration, 100% of cyclic nodes and edges are guaranteed to be flagged even when the number of elementary cycle paths hits the cap.
2. **Directed vs Undirected Cycle Semantics**:
   - In SDD, dependencies (`depends_on`, `calls`) are directed. A diamond pattern $A \to B \to D$ and $A \to C \to D$ is a valid directed acyclic graph (DAG) and is NOT a cycle. The algorithm strictly checks for directed cycles.
3. **Immutability vs In-Place Mutation**:
   - The cycle detector is a pure function that does NOT mutate the input `nodes` or `edges` arrays. It returns new `Map` and `Set` collections (`nodeStatusMap`, `edgeStatusMap`, `cyclicNodeIds`, `cyclicEdgeIds`).
   - If callers pass `VaultGraphNode` or `VaultGraphEdge` instances, helper methods `graph.applyCycleReport(report)` can optionally update their status properties in-place.
4. **Serialization of `Map` and `Set`**:
   - JavaScript `JSON.stringify()` serializes `Map` and `Set` to `{}` and `[]` respectively. To support JSON API endpoints (e.g. `/api/graph`), the return object provides both native `Map`/`Set` instances and serializable plain object summaries (`summary`, `cycles`, `sccs`).

---

## 4. Conclusion & Technical Implementation Blueprints

### 4.1 Implementation Blueprint: `src/vault/core/graph-model.js`

```javascript
/**
 * @file src/vault/core/graph-model.js
 * @description Pure ESM classes, schemas, status enums, and integrity tags for the 3D Vault Spatial Knowledge Graph.
 * Zero external runtime dependencies. Node.js >= 18.
 */

export const NodeStatus = Object.freeze({
  VALID: 'valid',
  CIRCULAR: 'circular',
  BROKEN: 'broken',
  ORPHAN: 'orphan'
});

export const EdgeStatus = Object.freeze({
  VALID: 'valid',
  CIRCULAR: 'circular',
  BROKEN: 'broken',
  ERROR: 'error'
});

export const IntegrityTag = Object.freeze({
  CLEAN: 'CLEAN',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  SELF_LOOP: 'SELF_LOOP',
  ORPHAN_NODE: 'ORPHAN_NODE',
  BROKEN_REFERENCE: 'BROKEN_REFERENCE',
  MISSING_SOURCE: 'MISSING_SOURCE',
  MISSING_TARGET: 'MISSING_TARGET',
  DUPLICATE_EDGE: 'DUPLICATE_EDGE'
});

export const NodeType = Object.freeze({
  FEATURE: 'feature',
  STORY: 'story',
  CRITERION: 'criterion',
  TASK: 'task',
  PRINCIPLE: 'principle',
  ASSUMPTION: 'assumption',
  QUESTION: 'question',
  FILE: 'file',
  TEST: 'test',
  COMPONENT: 'component',
  SERVICE: 'service',
  GENERIC: 'generic'
});

export const EdgeType = Object.freeze({
  CONTAINS: 'contains',
  IMPLEMENTS: 'implements',
  MODIFIES: 'modifies',
  VERIFIES: 'verifies',
  CONSTRAINS: 'constrains',
  CALLS: 'calls',
  DEPENDS_ON: 'depends_on',
  GENERIC: 'generic'
});

/**
 * Node entity in the 3D Knowledge Graph.
 */
export class VaultGraphNode {
  constructor(options = {}) {
    if (!options.id || typeof options.id !== 'string') {
      throw new TypeError('VaultGraphNode requires a non-empty string "id".');
    }
    this.id = options.id;
    this.title = options.title || options.id;
    this.type = options.type || NodeType.GENERIC;
    this.status = options.status || NodeStatus.VALID;
    this.snippet = options.snippet || '';
    this.position = {
      x: options.position?.x ?? 0,
      y: options.position?.y ?? 0,
      z: options.position?.z ?? 0
    };
    this.velocity = {
      x: options.velocity?.x ?? 0,
      y: options.velocity?.y ?? 0,
      z: options.velocity?.z ?? 0
    };
    this.mass = typeof options.mass === 'number' && options.mass > 0 ? options.mass : 1.0;
    this.tags = new Set(Array.isArray(options.tags) ? options.tags : []);
    this.auditFindings = Array.isArray(options.auditFindings) ? [...options.auditFindings] : [];
    this.metadata = options.metadata ? { ...options.metadata } : {};
  }

  setStatus(status) {
    if (!Object.values(NodeStatus).includes(status)) {
      throw new Error(`Invalid NodeStatus: "${status}"`);
    }
    this.status = status;
    if (status === NodeStatus.CIRCULAR) {
      this.tags.add(IntegrityTag.CIRCULAR_DEPENDENCY);
    } else if (status === NodeStatus.ORPHAN) {
      this.tags.add(IntegrityTag.ORPHAN_NODE);
    } else if (status === NodeStatus.BROKEN) {
      this.tags.add(IntegrityTag.BROKEN_REFERENCE);
    }
    return this;
  }

  addTag(tag) {
    this.tags.add(tag);
    return this;
  }

  removeTag(tag) {
    this.tags.delete(tag);
    return this;
  }

  hasTag(tag) {
    return this.tags.has(tag);
  }

  addAuditFinding(finding) {
    if (finding && typeof finding === 'object') {
      this.auditFindings.push(finding);
      if (finding.severity === 'erro') {
        this.addTag(IntegrityTag.BROKEN_REFERENCE);
      }
    }
    return this;
  }

  setPosition(x, y, z) {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
    return this;
  }

  clone() {
    return new VaultGraphNode({
      id: this.id,
      title: this.title,
      type: this.type,
      status: this.status,
      snippet: this.snippet,
      position: { ...this.position },
      velocity: { ...this.velocity },
      mass: this.mass,
      tags: Array.from(this.tags),
      auditFindings: this.auditFindings.map(f => ({ ...f })),
      metadata: { ...this.metadata }
    });
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      type: this.type,
      status: this.status,
      snippet: this.snippet,
      position: { ...this.position },
      velocity: { ...this.velocity },
      mass: this.mass,
      tags: Array.from(this.tags),
      auditFindings: this.auditFindings,
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    return new VaultGraphNode(data);
  }
}

/**
 * Directed connection between two nodes in the 3D Knowledge Graph.
 */
export class VaultGraphEdge {
  constructor(options = {}) {
    if (!options.source || typeof options.source !== 'string') {
      throw new TypeError('VaultGraphEdge requires a non-empty string "source".');
    }
    if (!options.target || typeof options.target !== 'string') {
      throw new TypeError('VaultGraphEdge requires a non-empty string "target".');
    }
    this.source = options.source;
    this.target = options.target;
    this.id = options.id || `${this.source}->${this.target}`;
    this.type = options.type || EdgeType.DEPENDS_ON;
    this.directed = options.directed !== undefined ? Boolean(options.directed) : true;
    this.status = options.status || EdgeStatus.VALID;
    this.tags = new Set(Array.isArray(options.tags) ? options.tags : []);
    this.metadata = options.metadata ? { ...options.metadata } : {};

    // Visual & physical elastic parameters
    const vs = options.visualStyle || {};
    this.visualStyle = {
      color: vs.color || this._defaultColorForStatus(this.status),
      stiffness: typeof vs.stiffness === 'number' ? vs.stiffness : 0.25,
      damping: typeof vs.damping === 'number' ? vs.damping : 0.85,
      restLength: typeof vs.restLength === 'number' ? vs.restLength : 80.0,
      amplitude: typeof vs.amplitude === 'number' ? vs.amplitude : 5.0,
      frequency: typeof vs.frequency === 'number' ? vs.frequency : 12.0
    };
  }

  _defaultColorForStatus(status) {
    switch (status) {
      case EdgeStatus.CIRCULAR:
        return '#ef4444'; // Glowing neon crimson
      case EdgeStatus.BROKEN:
      case EdgeStatus.ERROR:
        return '#f59e0b'; // Warning amber
      case EdgeStatus.VALID:
      default:
        return '#38bdf8'; // Vibrant sky blue
    }
  }

  get isVibrating() {
    return this.status === EdgeStatus.CIRCULAR;
  }

  setStatus(status) {
    if (!Object.values(EdgeStatus).includes(status)) {
      throw new Error(`Invalid EdgeStatus: "${status}"`);
    }
    this.status = status;
    this.visualStyle.color = this._defaultColorForStatus(status);
    if (status === EdgeStatus.CIRCULAR) {
      this.tags.add(IntegrityTag.CIRCULAR_DEPENDENCY);
    } else if (status === EdgeStatus.BROKEN || status === EdgeStatus.ERROR) {
      this.tags.add(IntegrityTag.BROKEN_REFERENCE);
    }
    return this;
  }

  addTag(tag) {
    this.tags.add(tag);
    return this;
  }

  removeTag(tag) {
    this.tags.delete(tag);
    return this;
  }

  hasTag(tag) {
    return this.tags.has(tag);
  }

  getKey() {
    return `${this.source}->${this.target}`;
  }

  clone() {
    return new VaultGraphEdge({
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      directed: this.directed,
      status: this.status,
      tags: Array.from(this.tags),
      metadata: { ...this.metadata },
      visualStyle: { ...this.visualStyle }
    });
  }

  toJSON() {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      directed: this.directed,
      status: this.status,
      isVibrating: this.isVibrating,
      tags: Array.from(this.tags),
      metadata: this.metadata,
      visualStyle: { ...this.visualStyle }
    };
  }

  static fromJSON(data) {
    return new VaultGraphEdge(data);
  }
}

/**
 * High-level container graph maintaining index structures.
 */
export class VaultGraph {
  constructor(options = {}) {
    this.nodes = new Map();
    this.edges = new Map();
    this.outAdj = new Map();
    this.inAdj = new Map();

    if (Array.isArray(options.nodes)) {
      for (const n of options.nodes) this.addNode(n);
    }
    if (Array.isArray(options.edges)) {
      for (const e of options.edges) this.addEdge(e);
    }
  }

  addNode(node) {
    const n = node instanceof VaultGraphNode ? node : new VaultGraphNode(node);
    this.nodes.set(n.id, n);
    if (!this.outAdj.has(n.id)) this.outAdj.set(n.id, []);
    if (!this.inAdj.has(n.id)) this.inAdj.set(n.id, []);
    return n;
  }

  addEdge(edge) {
    const e = edge instanceof VaultGraphEdge ? edge : new VaultGraphEdge(edge);
    this.edges.set(e.id, e);
    if (!this.outAdj.has(e.source)) this.outAdj.set(e.source, []);
    if (!this.inAdj.has(e.target)) this.inAdj.set(e.target, []);
    this.outAdj.get(e.source).push(e);
    this.inAdj.get(e.target).push(e);
    return e;
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getEdge(id) {
    return this.edges.get(id);
  }

  hasNode(id) {
    return this.nodes.has(id);
  }

  getOutgoing(id) {
    return this.outAdj.get(id) || [];
  }

  getIncoming(id) {
    return this.inAdj.get(id) || [];
  }

  getDegree(id) {
    return (this.outAdj.get(id)?.length || 0) + (this.inAdj.get(id)?.length || 0);
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
      edges: Array.from(this.edges.values()).map(e => e.toJSON())
    };
  }
}
```

---

### 4.2 Implementation Blueprint: `src/vault/core/cycle-detector.js`

```javascript
/**
 * @file src/vault/core/cycle-detector.js
 * @description Linear-time O(V+E) Tarjan SCC + 3-color DFS cycle detector and graph integrity classifier.
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
 * @param {Array<{id: string}>} nodes - List of graph node objects
 * @param {Array<{id: string, source: string, target: string}>} edges - List of directed edges
 * @param {object} [options] - Configuration options
 * @param {number} [options.maxCyclesPerScc=50] - Guard against combinatorial blowup
 * @param {number} [options.maxCyclesTotal=200] - Global cycle collection limit
 * @param {number} [options.maxCycleDepth=100] - Recursion depth limit
 * @returns {{
 *   hasCycles: boolean,
 *   cycleCount: number,
 *   cycles: Array<Array<string>>,
 *   cyclicNodeIds: Set<string>,
 *   cyclicEdgeIds: Set<string>,
 *   nodeStatusMap: Map<string, 'valid'|'circular'|'broken'|'orphan'>,
 *   edgeStatusMap: Map<string, 'valid'|'circular'|'error'>,
 *   sccs: Array<Array<string>>,
 *   brokenEdges: Array<object>,
 *   orphanNodeIds: Set<string>,
 *   summary: object
 * }}
 */
export function detectCycles(nodes = [], edges = [], options = {}) {
  const maxCyclesPerScc = options.maxCyclesPerScc ?? 50;
  const maxCyclesTotal = options.maxCyclesTotal ?? 200;
  const maxCycleDepth = options.maxCycleDepth ?? 100;

  const nodeMap = new Map();
  for (const n of nodes) {
    if (n && n.id) nodeMap.set(n.id, n);
  }

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
  for (const e of edges) {
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

  // 2. Tarjan's Strongly Connected Components Algorithm - O(V + E)
  let index = 0;
  const indices = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];

  function strongConnect(u) {
    indices.set(u, index);
    lowlink.set(u, index);
    index++;
    stack.push(u);
    onStack.add(u);

    for (const v of adj.get(u) || []) {
      if (!indices.has(v)) {
        strongConnect(v);
        lowlink.set(u, Math.min(lowlink.get(u), lowlink.get(v)));
      } else if (onStack.has(v)) {
        lowlink.set(u, Math.min(lowlink.get(u), indices.get(v)));
      }
    }

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
  }

  for (const id of nodeMap.keys()) {
    if (!indices.has(id)) {
      strongConnect(id);
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

  // 5. Construct Status Maps complying with PROJECT.md Interface Contract
  const nodeStatusMap = new Map();
  const orphanNodeIds = new Set();

  for (const [id, n] of nodeMap.entries()) {
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
    if (e.source && !nodeMap.has(e.source)) {
      nodeStatusMap.set(e.source, NodeStatus.BROKEN);
    }
    if (e.target && !nodeMap.has(e.target)) {
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
  for (const e of brokenEdges) {
    const edgeId = e.id || `${e?.source}->${e?.target}`;
    edgeStatusMap.set(edgeId, EdgeStatus.ERROR);
  }

  return {
    hasCycles: cycles.length > 0,
    cycleCount: cycles.length,
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
      totalEdges: edges.length,
      validEdgesCount: validEdges.length,
      brokenEdgesCount: brokenEdges.length,
      cyclicNodesCount: cyclicNodeIds.size,
      cyclicEdgesCount: cyclicEdgeIds.size,
      orphanNodesCount: orphanNodeIds.size,
      cycleCount: cycles.length,
      sccCount: sccs.length
    }
  };
}
```

---

## 5. Verification Method

### 5.1 Verification Test Execution Commands
The test suite runs with native Node.js:
```powershell
# Run the specific cycle detector and graph model unit test suite:
node --test test/vault/cycle-detector.test.js

# Run all vault test suites:
node --test "test/vault/*.test.js"
```

### 5.2 Verification Test Matrix (`test/vault/cycle-detector.test.js`)

Below is the complete blueprint for the automated verification suite covering Tiers 1 through 5:

```javascript
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
  it('executes in < 30ms on 1000-node linear DAG', () => {
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
    assert.ok(duration < 30, `Expected <30ms execution, took ${duration.toFixed(2)}ms`);
  });

  it('detects a 100-node circular ring in < 20ms', () => {
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
    assert.ok(duration < 20, `Ring detection took ${duration.toFixed(2)}ms`);
  });
});
```

### 5.3 Invalidation Conditions
This technical report and blueprint are invalidated if:
1. `detectCycles` requires an external npm dependency, violating the project's zero-dependency standard.
2. The cycle detector fails to detect self-loops $A \to A$ or 2-node cycles $A \leftrightarrow B$.
3. The cycle detector algorithm runs in non-polynomial time on acyclic or partitioned graphs.
4. The return structure deviates from the contract specified in `PROJECT.md` line 80-84 (`hasCycles`, `cycleCount`, `cycles`, `cyclicNodeIds`, `cyclicEdgeIds`, `nodeStatusMap`, `edgeStatusMap`).
