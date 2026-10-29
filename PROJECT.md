# Project: Cofre 3D de Documentação & Diagramas (Spatial Knowledge Graph)

## Architecture
A decoupled dual-target architecture adhering to the project's zero-dependency standard:
1. **Headless Core Engine (`src/vault/`)**: Pure ES Modules runnable directly in Node.js >= 18 with zero external runtime dependencies. Encompasses 3D vector math, camera kinematics with smooth lerp interpolation, damped Hooke's law spring-damper physics, $O(V+E)$ Tarjan SCC + 3-color DFS cycle detector, standing wave harmonic vibration generator, and SDD specification adapter.
2. **Interactive 3D Web UI (`src/vault/public/`)**: High-impact, responsive 3D visualization running in modern browsers. Employs vendored offline ESM Three.js + OrbitControls, rendering nodes as glowing status-coded spheres, elastic springs, crimson vibrating cables for circular dependencies, raycasting selection, camera lerp transitions, and a slide-out HUD for inspecting US/AC/Task details and GWT clauses.
3. **Local Dev Server & CLI (`src/vault/server.js`, `bin/onp-spec.js`)**: Native `node:http` server serving the 3D application and `/api/graph` endpoints, invokable via `onp-spec vault`.
4. **Automated Verification Harness (`test/vault/`)**: Native `node:test` suite thoroughly validating mathematical invariants, cycle detection, SDD parsing, and synthetic graphs.

## Code Layout
```
c:\Projetos\Specification-Driven-Development-SDD\
├── bin/
│   └── onp-spec.js                       # CLI entry point (adds 'vault' command)
├── src/
│   └── vault/
│       ├── math/
│       │   ├── vector3.js                # Continuous 3D vector arithmetic
│       │   └── camera-kinematics.js      # Orbit math, clamp, Slerp & Arc Lerp
│       ├── physics/
│       │   ├── spring-damper.js          # Damped Hooke's law & Symplectic Euler
│       │   └── edge-vibrator.js          # Standing wave generator & Lissajous jitter
│       ├── core/
│       │   ├── cycle-detector.js         # Tarjan SCC + DFS cycle extraction
│       │   ├── graph-model.js            # Node and edge schemas & status types
│       │   ├── sdd-adapter.js            # Bridges .spec/ to 3D graph model
│       │   └── synthetic-data.js         # Controlled synthetic test topologies
│       ├── server.js                     # Zero-dependency HTTP server (node:http)
│       └── public/
│           ├── index.html                # Vault 3D single page application
│           ├── style.css                 # Spatial UI & HUD inspection drawer styling
│           ├── app.js                    # UI coordinator, controls, raycaster
│           ├── vault-3d.js               # Three.js scene, elastic lines, vibrating waves
│           └── vendor/
│               ├── three.module.js       # Vendored offline Three.js ESM
│               └── OrbitControls.js      # Vendored offline OrbitControls ESM
└── test/
    └── vault/                            # E2E and Unit test suites (node:test)
        ├── vector3.test.js
        ├── camera-kinematics.test.js
        ├── cycle-detector.test.js
        ├── spring-damper.test.js
        ├── edge-vibrator.test.js
        ├── sdd-adapter.test.js
        ├── synthetic-data.test.js
        ├── server.test.js
        └── e2e-vault.test.js
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Vector3 & 3D Math | Vector3 primitives, distance, normalization, continuous 3D coordinate space | M1 | Survey / R1 |
| F2 | Camera Navigation & Lerp Kinematics | Spherical orbit, gimbal-lock prevention, pan/orbit/zoom, Slerp + Arc Lerp camera transitions | M1 | Survey / R1 |
| F3 | Elastic Physics & Spring-Damper | Hooke's law, Coulomb repulsion, Symplectic Euler integration, velocity damping, kinetic rest state | M1 | Survey / R2 |
| F4 | Graph Cycle Detection Engine | $O(V+E)$ Tarjan SCC + 3-color DFS cycle extraction, node/edge integrity status (valid, circular, broken, orphan) | M1 | Survey / R2 |
| F5 | Dynamic Vibration & Wave Generator | Transverse standing wave polyline generation, dual-axis Lissajous oscillation + stochastic jitter for cyclic edges | M1 | Survey / R2 |
| F6 | SDD Specification Parser & Graph Adapter | Maps `.spec/` (US-xxx, AC-xxx, T-xxx) into SDDGraphNode / SDDGraphEdge, extracts GWT clauses, audit statuses, file refs | M2 | Survey / R3 |
| F7 | Synthetic SDD Test Datasets | 5 controlled synthetic graphs: Clean DAG, Single Cycle `A->B->C->A`, Multi-cycle Figure-8, Disjoint Hybrid, Adversarial Drift | M2 | Survey / R4 |
| F8 | 3D Vault Web Application & UI | Interactive browser view with 3D canvas, node spheres, elastic lines, vibrating cycle loops in red, inspection HUD, scenario selector | M3 | Survey / R1, R2, R3 |
| F9 | Local Vault HTTP Server & CLI Entry | Zero-dependency native `node:http` server serving public assets and `/api/graph`, integrated into `onp-spec vault` CLI | M3 | Survey / R1, R3 |
| F10 | Automated Test Suite & E2E Verification | Native `node:test` suite covering Tiers 1-4 (T1 Feature, T2 Boundary/Corner, T3 Combinatorial, T4 Real-World) + T5 Adversarial Hardening | M4 & E2E Track | Survey / R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core 3D Math, Cycle Detection & Physics Engine | F1, F2, F3, F4, F5 (`src/vault/math/`, `src/vault/physics/`, `src/vault/core/cycle-detector.js`, `src/vault/core/graph-model.js`) | none | PLANNED |
| M2 | SDD Graph Adapter & Synthetic Datasets | F6, F7 (`src/vault/core/sdd-adapter.js`, `src/vault/core/synthetic-data.js`) | M1 | PLANNED |
| M3 | Interactive 3D Web UI & Local HTTP Server | F8, F9 (`src/vault/server.js`, `src/vault/public/`, `bin/onp-spec.js` vault command) | M1, M2 | PLANNED |
| M4 | Final Milestone: 100% E2E Test Pass & Adversarial Hardening | F10 (Pass 100% E2E tests Tiers 1-4 from E2E Track, then Tier 5 Adversarial Coverage Hardening) | M1, M2, M3, TEST_READY.md | PLANNED |

## Interface Contracts

### 1. `src/vault/math/vector3.js`
- `Vector3`: `class Vector3 { constructor(x=0, y=0, z=0); clone(); copy(v); set(x, y, z); add(v); sub(v); multiplyScalar(s); divideScalar(s); dot(v); cross(v); length(); lengthSq(); distanceTo(v); normalize(); lerp(v, alpha); toArray(); static fromArray(arr); }`

### 2. `src/vault/math/camera-kinematics.js`
- `CameraController`: `class CameraController { constructor(config={}); setTarget(targetVec3); orbit(deltaX, deltaY); pan(deltaX, deltaY); zoom(deltaY); transitionTo(newTarget, newDistance, durationMs); update(deltaSec); getState(); }`

### 3. `src/vault/core/cycle-detector.js`
- `detectCycles(nodes, edges)`:
  - Input: `nodes: Array<{id: string}>`, `edges: Array<{id: string, source: string, target: string}>`
  - Output: `{ hasCycles: boolean, cycleCount: number, cycles: Array<Array<string>>, cyclicNodeIds: Set<string>, cyclicEdgeIds: Set<string>, nodeStatusMap: Map<string, 'valid'|'circular'|'broken'|'orphan'>, edgeStatusMap: Map<string, 'valid'|'circular'|'error'> }`

### 4. `src/vault/physics/spring-damper.js`
- `SpringSimulation`: `class SpringSimulation { constructor(graph, config={}); step(dtSec); getNodePositions(); getSimulationEnergy(); isResting(); }`

### 5. `src/vault/physics/edge-vibrator.js`
- `generateVibratingEdgePolyline(p1, p2, timeSec, options={})`:
  - Input: `p1: Vector3`, `p2: Vector3`, `timeSec: number`, `options: { segments: 16, amplitude: 0.8, frequency: 12.0, isVibrating: boolean }`
  - Output: `Array<Vector3>` (length = segments + 1)

### 6. `src/vault/core/sdd-adapter.js`
- `loadSDDGraph(specDir, options={})`:
  - Input: `specDir: string` (e.g. `examples/inscricao-turma/.spec` or `.spec`), `options: { projectRoot: string }`
  - Output: `{ nodes: SDDGraphNode[], edges: SDDGraphEdge[], metadata: object }`

### 7. `src/vault/core/synthetic-data.js`
- `getSyntheticScenarios()`:
  - Returns map of scenarios: `clean_dag`, `simple_cycle`, `multi_cycle_figure8`, `disjoint_hybrid`, `adversarial_drift`.
