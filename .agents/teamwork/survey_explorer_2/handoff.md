# Handoff Report: 3D Continuous Vector Space, Elastic Physics & Cycle Vibration (R1 & R2)

**Agent**: `survey_explorer_2`  
**Working Directory**: `c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\survey_explorer_2`  
**Milestone**: Milestone 0 — Survey & Architectural Investigation  
**Date**: 2026-10-28T15:35:00Z  

---

## 1. Observation

### 1.1 Requirements from `ORIGINAL_REQUEST.md`
Direct quotes from `c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\ORIGINAL_REQUEST.md`:
- **Line 5**: `"Construir o Cofre 3D de Documentação & Diagramas (Spatial Knowledge Graph), uma ferramenta interativa para visualização e navegação espacial de anotações técnicas, componentes de software e especificações do framework de SDD do projeto em um espaço vetorial 3D contínuo, servindo como uma vitrine de alto impacto visual com física elástica e detecção de dependências."`
- **Lines 11-12 (R1)**: `"Apresentar um ambiente 3D interativo e contínuo onde notas, componentes de software, snippets de código e especificações são dispostos espacialmente. O usuário deve conseguir navegar pelo espaço arrastando o plano 3D com o mouse/controles e alternar o foco entre elementos com transições de câmera suaves via interpolação matemática (lerp)."`
- **Lines 14-16 (R2)**: `"Conectar nós conceituais e dependências entre componentes (ex: "Serviço A chama API B") por linhas elásticas com simulação física em tempo real. As conexões devem reagir visualmente às regras de integridade do grafo: linhas estáveis com cor padrão em conexões normais, e linhas que mudam de cor e vibram fisicamente ao detectar erro de validação ou dependência circular."`
- **Lines 26-33 (Acceptance Criteria)**:
  - `"O ambiente 3D renderiza no navegador permitindo a visualização de nós distribuídos no espaço tridimensional."`
  - `"A navegação por arrasto (pan/orbit/zoom) responde fluidamente às interações do mouse."`
  - `"A seleção ou transição de foco entre nós aciona movimento de câmera suave via interpolação matemática (lerp)."`
  - `"Conexões entre nós são renderizadas como linhas dinâmicas com comportamento elástico."`
  - `"Em grafos válidos sem erros de ciclo, as linhas conectivas permanecem estáveis com cor normal e sem vibração."`
  - `"Em cenários com dependência circular ou falha de validação, as conexões envolvidas no ciclo mudam de cor para indicar estado de erro e executam animação contínua de vibração física."`
- **Lines 40-41 (Automated Verification)**:
  - `"A suíte de testes automatizados executa e passa com sucesso, validando a detecção e o isolamento de dependências circulares em grafos de teste sintéticos."`
  - `"Testes automatizados cobrem a extração e estruturação de dependências a partir dos arquivos de especificação SDD."`

### 1.2 Repository Architecture & Constraints
- `package.json` (lines 7-17):
  - `"type": "module"`, `"engines": { "node": ">=18" }`
  - Zero external npm dependencies: `"dependencies"` is absent.
  - Native Node.js test runner: `"test": "node --test \"test/*.test.js\""`
- `ARQUITETURA.md` (lines 33-36):
  - `"Node.js >= 18, ESM puro, zero dependências. Testes da própria lib: node:test nativo."`
- `src/parsers/spec.js` and `src/parsers/tasks.js`:
  - Entities parsed: Stories (`US-xxx`), Criteria (`AC-xxx`), Tasks (`T-xxx`), Assumptions (`ASM-xxx`), Questions (`Q-xxx`).
  - Tasks link to requirements via `- Refs: US-xxx, AC-xxx` and declare files via `- Arquivos: ...`.

---

## 2. Logic Chain & Mathematical Modeling

### 2.1 Decoupled Dual-Target Architecture
To comply with the project's zero-dependency standard and enable automated verification (`node:test`) while supporting high-impact 3D browser rendering:
1. **Headless Core Engine**: Pure ESM modules with zero DOM/WebGL dependencies containing:
   - Vector3 & Math primitives (`vector3.js`, `math-utils.js`)
   - 3D Camera kinematics & smooth Lerp interpolation (`camera-controller.js`)
   - Hooke's law & Symplectic Euler physics integrator (`spring-damper.js`)
   - Graph cycle detector using Tarjan's SCC + cycle path extraction (`cycle-detector.js`)
   - Real-time sinusoidal standing wave polyline generator (`edge-vibrator.js`)
2. **Interactive 3D Visualizer**: Standalone web visualizer (HTML5/Canvas/WebGL or Three.js bundle) that imports or compiles this headless engine to render the interactive 3D vault at 60 FPS.

```
┌─────────────────────────────────────────────────────────────┐
│                    Headless Core Engine                     │
│               (100% pure ESM, node:test tested)             │
├───────────────┬────────────────────────────┬────────────────┤
│ 3D Math &     │ Spring-Damper Physics &    │ Tarjan SCC &   │
│ Camera Lerp   │ Symplectic Euler Layout    │ Cycle Detector │
└───────┬───────┴─────────────┬──────────────┴────────┬───────┘
        │                     │                       │
        ▼                     ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Interactive 3D Vault UI                     │
│         (WebGL / Three.js / Canvas 3D in Browser)           │
│   • Orbit / Pan / Dolly Controls  • Smooth Camera Easing    │
│   • Elastic Spring Graph Lines    • Glowing Crimson Waves   │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.2 Mathematical Modeling for Camera Navigation (R1)

#### 2.2.1 Coordinate Frame & Camera State Vector
- Space: Continuous 3D Euclidean space $\mathbb{R}^3$, Right-Handed Cartesian frame:
  - $+X$ = Right, $+Y$ = Up, $+Z$ = Out of screen (towards viewer).
- Camera State Vector:
  $$\mathbf{S}_{\text{cam}} = \left( \mathbf{p}_{\text{cam}}, \mathbf{t}, \mathbf{u}, \text{FOV}_y, r \right)$$
  - $\mathbf{p}_{\text{cam}} = [x_c, y_c, z_c]^T$: Camera position in world space.
  - $\mathbf{t} = [x_t, y_t, z_t]^T$: Look-at target (focus pivot point).
  - $\mathbf{u} = [0, 1, 0]^T$: World Up reference vector.
  - Forward direction: $\hat{\mathbf{f}} = \frac{\mathbf{t} - \mathbf{p}_{\text{cam}}}{\|\mathbf{t} - \mathbf{p}_{\text{cam}}\|}$.
  - Camera Right: $\hat{\mathbf{r}} = \frac{\hat{\mathbf{f}} \times \mathbf{u}}{\|\hat{\mathbf{f}} \times \mathbf{u}\|}$.
  - Camera True Up: $\hat{\mathbf{u}} = \hat{\mathbf{r}} \times \hat{\mathbf{f}}$.
  - Radial distance: $r = \|\mathbf{p}_{\text{cam}} - \mathbf{t}\|$.

#### 2.2.2 Spherical Orbit Navigation
- Given target $\mathbf{t}$, offset vector $\mathbf{v} = \mathbf{p}_{\text{cam}} - \mathbf{t}$.
- Conversion to Spherical Coordinates $(r, \theta, \phi)$:
  $$\theta = \text{atan2}(v_x, v_z) \quad (\text{azimuth / yaw})$$
  $$\phi = \arccos\left(\text{clamp}\left(\frac{v_y}{r}, -1, 1\right)\right) \quad (\text{polar / pitch})$$
- **Singularity & Gimbal Lock Avoidance**:
  When $\phi \to 0$ or $\phi \to \pi$, $\hat{\mathbf{f}} \parallel \mathbf{u}$, producing a cross-product degenerate singularity.
  Clamp $\phi$ strictly:
  $$\phi \in [\epsilon_{\phi}, \pi - \epsilon_{\phi}], \quad \epsilon_{\phi} = 0.001\text{ rad } (\approx 0.057^\circ)$$
- Mouse Drag Orbit Update $(\Delta x_m, \Delta y_m)$:
  $$\theta \leftarrow \theta - \Delta x_m \cdot k_{\text{orbit}}$$
  $$\phi \leftarrow \text{clamp}(\phi - \Delta y_m \cdot k_{\text{orbit}}, \epsilon_{\phi}, \pi - \epsilon_{\phi})$$
  Sensitivity: $k_{\text{orbit}} = \frac{2\pi}{W_{\text{viewport}}}$.
- Inverse Cartesian Transformation:
  $$\mathbf{p}_{\text{cam}} = \mathbf{t} + \begin{bmatrix} r \sin\phi \sin\theta \\ r \cos\phi \\ r \sin\phi \cos\theta \end{bmatrix}$$

#### 2.2.3 Planar Pan Navigation
- Pans the camera and target simultaneously in the screen plane perpendicular to the viewing ray:
  $$\Delta \mathbf{p}_{\text{pan}} = - \Delta x_m \cdot s_{\text{pan}} \cdot \hat{\mathbf{r}} + \Delta y_m \cdot s_{\text{pan}} \cdot \hat{\mathbf{u}}$$
- **Perspective Scaling Factor** (for 1:1 pixel cursor tracking):
  $$s_{\text{pan}} = \frac{2 r \tan(\text{FOV}_y / 2)}{H_{\text{viewport}}}$$
  $$\mathbf{p}_{\text{cam}} \leftarrow \mathbf{p}_{\text{cam}} + \Delta \mathbf{p}_{\text{pan}}, \quad \mathbf{t} \leftarrow \mathbf{t} + \Delta \mathbf{p}_{\text{pan}}$$

#### 2.2.4 Logarithmic Dolly Zoom Navigation
- For mouse wheel delta $\Delta w$ or pinch distance:
  $$r \leftarrow \text{clamp}\left( r \cdot e^{\Delta w \cdot k_{\text{zoom}}}, r_{\min}, r_{\max} \right)$$
  where $r_{\min} = 10.0, r_{\max} = 5000.0, k_{\text{zoom}} \approx 0.0015$.
  $$\mathbf{p}_{\text{cam}} = \mathbf{t} - r \hat{\mathbf{f}}$$

#### 2.2.5 Smooth Lerp Transitions & Cinematic Focus Arc
When user clicks a node $j$ with position $\mathbf{p}_j$:
- Target transitions from $\mathbf{t}_0$ to $\mathbf{t}_1 = \mathbf{p}_j$.
- Camera destination position: $\mathbf{p}_1 = \mathbf{t}_1 - r_{\text{focus}} \hat{\mathbf{f}}_0$, preserving current viewing azimuth/pitch at an optimal distance $r_{\text{focus}} \approx 120.0$.
- Transition Duration: $T = 0.8\text{ seconds}$.
- Progress parameter: $u(t) = \text{clamp}\left(\frac{t - t_0}{T}, 0, 1\right)$.
- Non-linear Easing Function (Quintic Ease-Out for rapid response and silky smooth settling):
  $$E(u) = 1 - (1 - u)^5$$
  (Alternative: Smoothstep $S(u) = 3u^2 - 2u^3$ or Cubic Ease-In-Out).
- **Curved Trajectory (Slerp vs Vector3 Lerp)**:
  - *Problem with pure Vector3 Lerp*: $\mathbf{p}(u) = (1 - E(u))\mathbf{p}_0 + E(u)\mathbf{p}_1$ forms a straight line that penetrates directly through intermediate nodes and the center of the graph cluster.
  - *Arc Slerp Formula*:
    Let direction offsets be $\mathbf{v}_0 = \mathbf{p}_0 - \mathbf{t}_0$ and $\mathbf{v}_1 = \mathbf{p}_1 - \mathbf{t}_1$.
    Normalize unit directions: $\hat{\mathbf{d}}_0 = \frac{\mathbf{v}_0}{\|\mathbf{v}_0\|}$, $\hat{\mathbf{d}}_1 = \frac{\mathbf{v}_1}{\|\mathbf{v}_1\|}$.
    Angle between vectors: $\Omega = \arccos(\text{clamp}(\hat{\mathbf{d}}_0 \cdot \hat{\mathbf{d}}_1, -1, 1))$.
    Direction Slerp:
    $$\hat{\mathbf{d}}(u) = \begin{cases} (1 - E(u))\hat{\mathbf{d}}_0 + E(u)\hat{\mathbf{d}}_1 & \text{if } \sin\Omega < 10^{-4} \\ \frac{\sin((1 - E(u))\Omega)}{\sin\Omega}\hat{\mathbf{d}}_0 + \frac{\sin(E(u)\Omega)}{\sin\Omega}\hat{\mathbf{d}}_1 & \text{otherwise} \end{cases}$$
    Radius with Arc Lift:
    $$r(u) = (1 - E(u))\|\mathbf{v}_0\| + E(u)\|\mathbf{v}_1\| + A_{\text{arc}} \sin(\pi u), \quad A_{\text{arc}} \approx 25.0$$
    Target Interpolation:
    $$\mathbf{t}(u) = (1 - E(u))\mathbf{t}_0 + E(u)\mathbf{t}_1$$
    Camera Position:
    $$\mathbf{p}_{\text{cam}}(u) = \mathbf{t}(u) + r(u) \hat{\mathbf{d}}(u)$$
  This guarantees a sweeping cinematic curve that clears obstacles and never clips through the target.

---

### 2.3 Elastic Physics Simulation for Graph Edges (R2)

#### 2.3.1 Hooke's Law Spring-Damper Mechanical Model
For an edge $e = (i, j)$ connecting node $i$ (mass $m_i$, position $\mathbf{p}_i$, velocity $\mathbf{v}_i$) and node $j$ (mass $m_j$, position $\mathbf{p}_j$, velocity $\mathbf{v}_j$):
- Distance vector: $\mathbf{r}_{ij} = \mathbf{p}_j - \mathbf{p}_i$
- Current distance: $d_{ij} = \|\mathbf{r}_{ij}\|$
- Unit direction: $\hat{\mathbf{r}}_{ij} = \frac{\mathbf{r}_{ij}}{d_{ij} + \epsilon_{\text{dist}}}, \quad \epsilon_{\text{dist}} = 10^{-6}$
- Rest length: $L_{0, ij}$
  - Hierarchy edges (`US -> AC`): $L_0 = 80.0\text{ units}$
  - Task edges (`AC -> T`): $L_0 = 60.0\text{ units}$
  - Inter-service dependencies / calls: $L_0 = 140.0\text{ units}$
- Spring extension: $\Delta L = d_{ij} - L_{0, ij}$
- Hooke's Elastic Restoring Force:
  $$\mathbf{F}_{\text{spring}, ij} = k_s (d_{ij} - L_{0, ij}) \hat{\mathbf{r}}_{ij}, \quad k_s \approx 0.15 - 0.35\text{ N/m}$$
- Viscous Axial Damper Force:
  Relative velocity: $\mathbf{v}_{\text{rel}} = \mathbf{v}_j - \mathbf{v}_i$.
  $$\mathbf{F}_{\text{damper}, ij} = c_d (\mathbf{v}_{\text{rel}} \cdot \hat{\mathbf{r}}_{ij}) \hat{\mathbf{r}}_{ij}, \quad c_d = 2 \zeta \sqrt{k_s \mu_{ij}}$$
  where $\mu_{ij} = \frac{m_i m_j}{m_i + m_j}$ is the reduced mass, and damping ratio $\zeta \approx 0.85$ (near critical damping to prevent endless oscillation).
- Total Edge Force:
  $$\mathbf{F}_{ij}^{\text{edge}} = \mathbf{F}_{\text{spring}, ij} + \mathbf{F}_{\text{damper}, ij}$$
  $$\mathbf{F}_{ji}^{\text{edge}} = -\mathbf{F}_{ij}^{\text{edge}} \quad (\text{Newton's 3rd Law})$$

#### 2.3.2 3D Force-Directed Graph System
Every node $i \in V$ experiences the superposition of four physical forces:
$$\mathbf{F}_i^{\text{total}} = \mathbf{F}_i^{\text{springs}} + \mathbf{F}_i^{\text{repulsion}} + \mathbf{F}_i^{\text{center}} + \mathbf{F}_i^{\text{drag}}$$
1. **Spring Forces**: $\mathbf{F}_i^{\text{springs}} = \sum_{j \in \mathcal{N}(i)} \mathbf{F}_{ij}^{\text{edge}}$
2. **Coulomb Repulsion** (anti-collision and spatial distribution across all pairs $i \ne k$):
   $$\mathbf{F}_{ik}^{\text{repulsion}} = \frac{k_r \cdot m_i \cdot m_k}{\|\mathbf{p}_i - \mathbf{p}_k\|^2 + r_0^2} \frac{\mathbf{p}_i - \mathbf{p}_k}{\|\mathbf{p}_i - \mathbf{p}_k\| + \epsilon}$$
   where repulsion constant $k_r \approx 3000.0$ and softening radius $r_0 \approx 25.0$.
3. **Centering Gravity** (prevents unbounded drift of disconnected components):
   $$\mathbf{F}_i^{\text{center}} = -k_c \mathbf{p}_i, \quad k_c \approx 0.008$$
4. **Atmospheric Viscous Drag**:
   $$\mathbf{F}_i^{\text{drag}} = -\gamma_{\text{drag}} \mathbf{v}_i, \quad \gamma_{\text{drag}} \approx 0.12$$

#### 2.3.3 Symplectic Euler Numerical Integration
To guarantee numerical energy stability without positive-feedback energy explosion:
$$\mathbf{a}_i(t) = \frac{\mathbf{F}_i^{\text{total}}(t)}{m_i}$$
$$\mathbf{v}_i(t + \Delta t) = \mathbf{v}_i(t) + \mathbf{a}_i(t) \Delta t$$
$$\mathbf{p}_i(t + \Delta t) = \mathbf{p}_i(t) + \mathbf{v}_i(t + \Delta t) \Delta t$$
- **Stability Constraint**:
  Fixed sub-step $\Delta t = \min(\Delta t_{\text{frame}}, 0.02)\text{ s}$.
  Velocity clamping: $\|\mathbf{v}_i\| \le v_{\max} = 400.0\text{ units/s}$.
- **Kinetic Energy Sleep / Wake**:
  Total Kinetic Energy: $K(t) = \frac{1}{2} \sum_{i=1}^{N} m_i \|\mathbf{v}_i(t)\|^2$.
  When $K(t) < 10^{-3}$ for 30 consecutive ticks, the physics engine enters `SLEEP`, consuming 0 CPU cycles. Any user drag or graph mutation immediately transitions status to `AWAKE`.

---

### 2.4 Graph Cycle Detection & Validation Algorithms (R2)

#### 2.4.1 SDD Graph Formalization
- Directed Graph $G = (V, E)$.
- Nodes $V$: Identified by unique IDs (`US-xxx`, `AC-xxx`, `T-xxx`, or component names).
- Edges $E$: Directed edges $e = (u, v)$ with types:
  - `hierarchy`: $US \to AC$, $AC \to T$ (canonical parent-child tree).
  - `depends_on`: $T_a \to T_b$ (dependency between tasks).
  - `calls`: Component $A \to$ Component $B$ (architectural invocation).
- Integrity Problem:
  Any directed path $u \to v_1 \to v_2 \dots \to u$ is a cyclic dependency. In SDD, circular dependencies halt parallel execution lanes, generate deadlocks in execution plans, and invalidate architectural integrity.

#### 2.4.2 Algorithmic Design: Tarjan's SCC + Cycle Extraction
We specify a hybrid two-tier algorithm:
1. **Tier 1: Tarjan's Strongly Connected Components (SCC)**:
   - Computes all maximal strongly connected subgraphs in $O(|V| + |E|)$.
   - Identifies whether any SCC has $|S| > 1$ or a self-loop $(u, u) \in E$.
2. **Tier 2: Elementary Cycle Extraction via Depth-First Search**:
   - For every non-trivial SCC, run 3-color DFS (White = 0, Gray = 1, Black = 2) with path recording.
   - When a back-edge to a Gray node is hit, slice the active recursion path to reconstruct the exact directed cycle:
     $$C = [v_{\text{target}}, \dots, v_{\text{source}}, v_{\text{target}}]$$
   - Store exact cycle paths for reporting and UI inspector tooltips.

```javascript
// Algorithmic Structure for Cycle Detector (Pure ESM, Zero Dependency)
export class CycleDetector {
  /**
   * Analyzes graph G = (nodes, edges) and returns full integrity report
   */
  static analyze(nodes, edges) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adj = new Map();
    const edgeMap = new Map();

    for (const n of nodes) adj.set(n.id, []);
    
    const brokenEdges = [];
    const validCandidateEdges = [];

    for (const e of edges) {
      if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) {
        brokenEdges.push({ ...e, integrity: 'broken' });
        continue;
      }
      adj.get(e.source).push(e.target);
      const edgeKey = `${e.source}->${e.target}`;
      if (!edgeMap.has(edgeKey)) edgeMap.set(edgeKey, []);
      edgeMap.get(edgeKey).push(e);
      validCandidateEdges.push(e);
    }

    // Tarjan's SCC
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

    for (const n of nodes) {
      if (!indices.has(n.id)) strongConnect(n.id);
    }

    // Identify circular nodes and extract cycles
    const circularNodeIds = new Set();
    const circularEdgeKeys = new Set();
    const cycles = [];

    for (const scc of sccs) {
      if (scc.length > 1) {
        for (const id of scc) circularNodeIds.add(id);
        // Extract elementary cycles within SCC
        const sccSet = new Set(scc);
        extractCyclesInSCC(scc, adj, sccSet, cycles, circularEdgeKeys);
      } else if (scc.length === 1) {
        const u = scc[0];
        if ((adj.get(u) || []).includes(u)) {
          // Self-loop
          circularNodeIds.add(u);
          circularEdgeKeys.add(`${u}->${u}`);
          cycles.push([u, u]);
        }
      }
    }

    // Map integrity statuses
    const classifiedEdges = edges.map(e => {
      if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) {
        return { ...e, integrity: 'broken' };
      }
      const key = `${e.source}->${e.target}`;
      if (circularEdgeKeys.has(key)) {
        return { ...e, integrity: 'circular' };
      }
      return { ...e, integrity: 'valid' };
    });

    const classifiedNodes = nodes.map(n => {
      let status = 'valid';
      if (circularNodeIds.has(n.id)) status = 'in_cycle';
      else if ((adj.get(n.id) || []).length === 0 && !edges.some(e => e.target === n.id)) {
        status = 'orphan';
      }
      return { ...n, status };
    });

    return {
      hasCycle: cycles.length > 0,
      cycles,
      sccs: sccs.filter(s => s.length > 1 || (s.length === 1 && (adj.get(s[0]) || []).includes(s[0]))),
      nodes: classifiedNodes,
      edges: classifiedEdges,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        circularNodesCount: circularNodeIds.size,
        circularEdgesCount: circularEdgeKeys.size,
        brokenEdgesCount: brokenEdges.length,
      }
    };
  }
}
```

#### 2.4.3 Integrity Classification Matrix
| Entity | Status | Description | Action in 3D Vault |
|---|---|---|---|
| Edge | `valid` | Directed acyclic connection | Render normal stable line, standard cyan/blue glow |
| Edge | `circular` | Contained in directed cycle | Render crimson red, trigger continuous physical sinusoidal vibration |
| Edge | `broken` | Source or target does not exist | Render dashed amber line with slow flashing |
| Node | `valid` | Normal specification/component node | Standard spherical/capsule mesh with badge |
| Node | `in_cycle` | Participates in a cyclic dependency | High-contrast crimson halo / alert badge |
| Node | `orphan` | Completely disconnected from graph | Ghost/translucent desaturated styling |

---

### 2.5 Real-Time Visual Feedback & Physical Vibration (R2)

#### 2.5.1 Visual Style Specs
- `VALID` Connection:
  - Color: `#38bdf8` (Vibrant Sky Blue) or `#4ade80` (Green if verified).
  - Emissive glow: `0x0284c7`, opacity: 0.85, width: 2.0px.
  - Motion: Fully stable, zero vibration, smooth laminar particle stream along direction of flow.
- `CIRCULAR` Error Connection:
  - Color: `#ff0055` / `#ef4444` (Glowing Neon Crimson).
  - Emissive glow: `0xdc2626`, opacity: 1.0, width: 4.0px.
  - Motion: Active physical standing-wave sinusoidal vibration + high-frequency jitter.

#### 2.5.2 Standing Wave Harmonic Formulation
Let an edge connect node $\mathbf{p}_1(t)$ and node $\mathbf{p}_2(t)$ in $\mathbb{R}^3$:
- Span vector: $\mathbf{r} = \mathbf{p}_2 - \mathbf{p}_1$.
- Length: $L = \|\mathbf{r}\|$.
- Unit tangent vector: $\hat{\mathbf{t}} = \frac{\mathbf{r}}{L}$.
- Transverse Normal & Binormal Vectors:
  $$\hat{\mathbf{n}} = \frac{\hat{\mathbf{t}} \times [0, 1, 0]^T}{\|\hat{\mathbf{t}} \times [0, 1, 0]^T\|} \quad (\text{if } |\hat{t}_y| > 0.95, \text{ use } \hat{\mathbf{t}} \times [1, 0, 0]^T)$$
  $$\hat{\mathbf{b}} = \hat{\mathbf{t}} \times \hat{\mathbf{n}}$$
- **Spatial Envelope Function (Dirichlet Fixed-Ends)**:
  For normalized coordinate along the edge $s \in [0, 1]$:
  $$\mathcal{E}(s) = \sin(\pi s)$$
  This enforces zero displacement at the endpoints ($\mathcal{E}(0) = 0$ and $\mathcal{E}(1) = 0$), so the vibrating line stays firmly attached to its nodes.
- **Transverse Dual-Axis Temporal Oscillation (Lissajous Motion)**:
  $$\mathbf{w}(t) = \left[ A_n \sin(\omega_1 t) \right] \hat{\mathbf{n}} + \left[ A_b \cos(\omega_2 t + \phi_0) \right] \hat{\mathbf{b}}$$
  where:
  - $A_n = 5.0\text{ units}$, $A_b = 3.5\text{ units}$
  - Angular frequencies: $\omega_1 = 2\pi f_1$ with $f_1 = 11.0\text{ Hz}$, $\omega_2 = 2\pi f_2$ with $f_2 = 14.7\text{ Hz}$.
  The incommensurate frequency ratio ($14.7 / 11.0 \approx 1.336$) produces complex 3D orbital fluttering rather than a rigid 2D planar wobble.
- **Electric Buzz / Stochastic Jitter**:
  $$\mathbf{J}(t) = \sigma_J \left( \sin(73 t) \hat{\mathbf{n}} + \cos(91 t) \hat{\mathbf{b}} \right), \quad \sigma_J \approx 0.8\text{ units}$$
- **Displacement Vector at Point $s$ and Time $t$**:
  $$\mathbf{d}(s, t) = \mathcal{E}(s) \cdot \left( \mathbf{w}(t) + \mathbf{J}(t) \right)$$
- **Discretized Polyline Sampling**:
  Sample the edge at $K=16$ equidistant stations $s_k = \frac{k}{K}, k \in \{0, 1, \dots, K\}$:
  $$\mathbf{P}_k(t) = (1 - s_k) \mathbf{p}_1(t) + s_k \mathbf{p}_2(t) + \mathbf{d}(s_k, t)$$
  - Station $k = 0 \implies \mathbf{P}_0(t) = \mathbf{p}_1(t)$
  - Station $k = K \implies \mathbf{P}_K(t) = \mathbf{p}_2(t)$
  - Stations $1 \le k < K \implies$ actively vibrating 3D polyline.

```javascript
// Pure ESM Edge Vibrator Generator (Zero Dependency, Headless & Browser)
export class EdgeVibrator {
  constructor(options = {}) {
    this.segments = options.segments || 16;
    this.amplitude = options.amplitude || 5.0;
    this.freq1 = options.freq1 || 11.0;
    this.freq2 = options.freq2 || 14.7;
  }

  /**
   * Generates 3D vertices for an edge.
   * If edge is 'valid', returns a straight 2-point line [p1, p2].
   * If edge is 'circular', returns K+1 points of vibrating polyline.
   */
  sampleEdge(p1, p2, integrity, timeSec) {
    if (integrity !== 'circular') {
      return [
        [p1[0], p1[1], p1[2]],
        [p2[0], p2[1], p2[2]]
      ];
    }

    const rx = p2[0] - p1[0];
    const ry = p2[1] - p1[1];
    const rz = p2[2] - p1[2];
    const len = Math.hypot(rx, ry, rz) || 1e-6;
    const tx = rx / len, ty = ry / len, tz = rz / len;

    // Normal orthogonal to tangent
    let upX = 0, upY = 1, upZ = 0;
    if (Math.abs(ty) > 0.95) { upX = 1; upY = 0; upZ = 0; }
    
    // Cross product t x up
    let nx = ty * upZ - tz * upY;
    let ny = tz * upX - tx * upZ;
    let nz = tx * upY - ty * upX;
    const nLen = Math.hypot(nx, ny, nz) || 1e-6;
    nx /= nLen; ny /= nLen; nz /= nLen;

    // Binormal t x n
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;

    // Time oscillators
    const w1 = 2 * Math.PI * this.freq1 * timeSec;
    const w2 = 2 * Math.PI * this.freq2 * timeSec;
    const oscN = this.amplitude * Math.sin(w1);
    const oscB = (this.amplitude * 0.7) * Math.cos(w2 + 0.4);
    const jitter = 0.8 * Math.sin(73 * timeSec);

    const points = [];
    const K = this.segments;
    for (let k = 0; k <= K; k++) {
      const s = k / K;
      const envelope = Math.sin(Math.PI * s);
      const dispN = envelope * (oscN + jitter);
      const dispB = envelope * oscB;

      const x = (1 - s) * p1[0] + s * p2[0] + dispN * nx + dispB * bx;
      const y = (1 - s) * p1[1] + s * p2[1] + dispN * ny + dispB * by;
      const z = (1 - s) * p1[2] + s * p2[2] + dispN * nz + dispB * bz;
      points.push([x, y, z]);
    }
    return points;
  }
}
```

---

## 3. Caveats & Assumptions

1. **Browser WebGL / 3D Context**:
   - The repository strictly maintains zero external dependencies in `package.json` for the core CLI.
   - For browser rendering, Three.js or an ultra-lean Canvas 3D renderer can either be loaded via CDN (e.g. `unpkg` / `cdnjs` inside a generated standalone HTML file), bundled in a static assets directory, or rendered with pure HTML5 Canvas / WebGL context.
   - Automated testing in Node.js (`node:test`) does not need DOM or WebGL, as all mathematical, physics, and cycle algorithms are completely decoupled.
2. **N-Body Repulsion Scalability ($O(N^2)$)**:
   - For SDD graphs containing typical project sizes ($< 500$ specification nodes), direct pairwise $O(N^2)$ electrostatic repulsion is extremely fast ($< 1\text{ ms}$ per step).
   - If a repository contains thousands of tasks ($> 1,500$ nodes), Barnes-Hut 3D octree spatial partitioning should be added in a subsequent optimization phase.
3. **Directed vs Undirected Cycle Semantics**:
   - In SDD, cycle detection applies to directed dependencies (`depends_on` and `calls`).
   - Hierarchical relations (`US -> AC -> T`) are directed parent-child edges and should form a tree/forest without cycles. The algorithm treats the graph as a directed multigraph, strictly isolating back-edges and directed loops.

---

## 4. Conclusion & Architectural Recommendations

1. **Mathematical Navigation Model (R1)**:
   - Orbit via spherical coordinates with polar clamping $[\epsilon, \pi - \epsilon]$ completely eliminates gimbal lock.
   - Pan with focal-distance scaling guarantees 1:1 pixel drag fidelity.
   - Target focus transitions utilizing Slerp direction arc interpolation and quintic ease-out deliver smooth cinematic focus shifts that never clip through graph clusters.
2. **Elastic Physics Simulation (R2)**:
   - Symplectic Euler integration over damped Hooke's springs provides stable, energy-conserving elastic deformation.
   - Kinetic energy monitoring enables automatic simulation sleep ($E_k < 10^{-3}$), keeping CPU load minimal.
3. **Cycle Detection & Integrity Validation (R2)**:
   - Tarjan's SCC ($O(V + E)$) combined with bounded DFS back-edge path extraction guarantees linear-time identification and complete isolation of circular dependency loops.
   - Automatic classification categorizes elements into `valid`, `circular`, `broken`, and `orphan`.
4. **Vibration & Visual Feedback (R2)**:
   - Valid connections remain taut and calm in sky blue.
   - Circular connections light up in glowing neon crimson red and physically oscillate via dual-axis standing waves with Dirichlet boundary conditions, producing a striking mechanical vibration effect.
5. **Implementation Structure**:
   - Core files:
     - `src/vault/math/vector3.js`
     - `src/vault/camera/camera-controller.js`
     - `src/vault/physics/spring-damper.js`
     - `src/vault/physics/edge-vibrator.js`
     - `src/vault/graph/cycle-detector.js`
   - Test files:
     - `test/vault-camera.test.js`
     - `test/vault-physics.test.js`
     - `test/vault-cycles.test.js`
     - `test/vault-vibration.test.js`

---

## 5. Verification Method

To independently verify the mathematical models and algorithms:

### 5.1 Test Execution Command
Run the native test suite from repository root:
```powershell
node --test "test/vault-*.test.js"
```

### 5.2 Verification Test Matrix
1. **Camera Navigation & Interpolation Tests** (`test/vault-camera.test.js`):
   - **Spherical Orbit**: Assert spherical coordinates $(r, \theta, \phi)$ round-trip to Cartesian $[x, y, z]$ with numerical error $< 10^{-6}$.
   - **Gimbal Lock Protection**: Assert pitch clamp restricts $\phi$ to $[\epsilon, \pi - \epsilon]$ even under extreme mouse deltas.
   - **Lerp Boundaries**: Assert camera transition state at $u=0$ matches start position and at $u=1$ matches destination position.
   - **Slerp Normalization**: Assert $\|\hat{\mathbf{d}}(u)\| = 1.0 \pm 10^{-5}$ across all $u \in [0, 1]$.
2. **Elastic Physics Tests** (`test/vault-physics.test.js`):
   - **Hooke Restoring Force**: Assert that when stretched $d > L_0$, $\mathbf{F}_{\text{spring}}$ points directly toward opposite node.
   - **Equilibrium**: Assert that when $d = L_0$, $\|\mathbf{F}_{\text{spring}}\| = 0$.
   - **Newton's 3rd Law**: Assert $\mathbf{F}_{ij} = -\mathbf{F}_{ji}$ within floating point precision.
   - **Symplectic Energy Stability**: Run 1,000 steps on an oscillating spring; assert total energy remains bounded and does not explode.
3. **Cycle Detection Tests** (`test/vault-cycles.test.js`):
   - **Synthetic DAG**: Graph $A \to B \to C \to D \implies$ `hasCycle: false`, all edges marked `valid`.
   - **Direct 2-Cycle**: Graph $A \to B \to A \implies$ `hasCycle: true`, cycles include `[[A, B, A]]`, both edges marked `circular`.
   - **Triangle Cycle with Branch**: $A \to B \to C \to A$ and $C \to D \implies$ SCC $\{A, B, C\}$ isolated as `circular`; edge $C \to D$ remains `valid`.
   - **Self-Loop**: $A \to A \implies$ `hasCycle: true`, edge marked `circular`.
   - **Broken Reference**: $A \to \text{MISSING} \implies$ edge marked `broken`.
4. **Physical Vibration Tests** (`test/vault-vibration.test.js`):
   - **Valid Edge Invariant**: Edge with status `valid` returns exactly 2 points $[p_1, p_2]$ with zero vibration.
   - **Boundary Invariant**: Edge with status `circular` returns $K+1$ points where $\mathbf{P}_0(t) = \mathbf{p}_1(t)$ and $\mathbf{P}_K(t) = \mathbf{p}_2(t)$ for all $t$.
   - **Midpoint Oscillation**: At station $k = K/2$ ($s = 0.5$), displacement magnitude $\|\mathbf{P}_{K/2}(t) - \text{midpoint}\| > 0$ and oscillates periodically over time.

### 5.3 Invalidation Conditions
This report is invalidated if:
1. An algorithm requires external npm runtime dependencies conflicting with the project's zero-dependency baseline.
2. The camera interpolation causes pole singularities (gimbal lock) or straight-line clipping through the center of graph clusters.
3. The cycle detection algorithm fails to isolate circular loops from non-cyclic branches in a directed multigraph.
4. The vibrating edge fails Dirichlet boundary conditions ($\mathbf{d}(0, t) \ne \mathbf{0}$ or $\mathbf{d}(1, t) \ne \mathbf{0}$), causing visual detachment from connected nodes.
