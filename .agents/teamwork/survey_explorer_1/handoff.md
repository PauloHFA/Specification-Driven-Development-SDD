# Handoff Report: Survey & Reconnaissance for 3D Vault (Spatial Knowledge Graph)

**Agent**: Survey Explorer 1  
**Working Directory**: `c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\survey_explorer_1`  
**Date**: 2026-10-28  
**Recipient**: Orchestrator (`e93c1265-9944-4954-b060-0fc6fd41f55a`)  

---

## 1. Observation

### 1.1 Project Root, Files and Directory Structure
The repository at `c:\Projetos\Specification-Driven-Development-SDD` is the **onp-spec-driven** framework (`@onovoprogramador/onp-spec` v0.9.0).
Direct inspection via `list_dir` revealed the following directory structure:
- Root files:
  - `package.json` (950 bytes, ESM project configuration)
  - `package-lock.json` (1968 bytes)
  - `README.md` (12,944 bytes, product documentation)
  - `ARQUITETURA.md` (21,771 bytes, architectural manifesto and specification)
  - `LICENSE` (MIT)
  - `.gitignore` (ignores `node_modules/`, `benchmark/.vendor/`, `*.log`, `.DS_Store`)
- Directories:
  - `bin/`: CLI binary entry point (`bin/onp-spec.js`)
  - `src/`: Core implementation files (`src/cli.js`, `src/config.js`, `src/index.js`, `src/core/`, `src/parsers/`, `src/util/`)
  - `test/`: 17 test files executing with native `node:test`
  - `templates/`: Markdown templates for specifications (`spec.md`, `tasks.md`, `constituicao-base.md`, `constituicao-lgpd-educacao.md`)
  - `examples/`: Full example project `examples/inscricao-turma/` with `.spec/`, `onpspec.config.json`, `src/`, `test/`
  - `skills/`: Agent skills for 4 AI agents (`onp-spec-driven` [Claude], `onp-spec-driven-antigravity`, `onp-spec-driven-codex`, `onp-spec-driven-cursor`)
  - `tools/`: Build script `tools/build-skill.mjs`
  - `benchmark/`: Benchmark suite comparing onp-spec with other frameworks
  - `docs/`: Technical TDD and regression findings (`TDD-skill-harness.md`, `ACHADOS-teste-exaustivo.md`)

*Note*: There is currently **no `.spec/` directory in the repository root**; the existing reference specification is located at `examples/inscricao-turma/.spec/`.

### 1.2 Tech Stack & Dependencies
- **Node & NPM Version**:
  Command: `node -v; npm -v`
  Output:
  ```
  v24.19.0
  11.19.0
  ```
- **Runtime Dependencies**:
  Inspection of `package.json` (lines 7–20):
  ```json
  "description": "Spec-anchored development: specs auditáveis contra o código, DoD executável, suposições explícitas e constituição verificável. Zero dependências.",
  "type": "module",
  "bin": {
    "onp-spec": "bin/onp-spec.js"
  },
  "main": "src/index.js",
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "test": "node --test \"test/*.test.js\"",
    "bench": "node benchmark/run.js",
    "prepublishOnly": "npm test"
  }
  ```
  There are **zero runtime dependencies** and **zero devDependencies** in `package.json`.
- **Frontend / 3D Graphics / Bundlers**:
  A file search for `*.html`, `*.css`, `*.ts`, `*.tsx`, `*.jsx`, `*.vue` returned **0 results** across the workspace.
  There is currently no frontend framework (React, Vue, Svelte), no 3D graphics library (Three.js, Babylon.js), and no bundler (Vite, Webpack, Rollup) installed.
- **Node Modules**:
  `Test-Path node_modules` returned `False`.

### 1.3 Test & Execution Scripts
- The test command is `npm test`, mapped to `node --test "test/*.test.js"`.
- Independent test executions directly via Node test runner:
  - `node --test test/audit.test.js`:
    ```
    ℹ tests 13 | pass 13 | fail 0 | duration_ms 341.2457
    ```
  - `node --test test/parsers.test.js`:
    ```
    ℹ tests 9 | pass 9 | fail 0 | duration_ms 118.3439
    ```
  - `node --test test/plano.test.js`:
    ```
    ℹ tests 37 | pass 37 | fail 0 | duration_ms 131.0773
    ```
- Global test execution (`npm test`):
  Fails on tests that expect Linux/bash or strict LF:
  - `test/agents-plano.e2e.test.js`: tests invoke `bash -n` on generated shell scripts; on this Windows system, running `bash --version` returned `Acesso negado. Código de erro: Bash/E_ACCESSDENIED`.
  - `test/skill-sync.test.js:60`: fails strictly comparing `readFileSync('...onp-spec.mjs')` with `ENTRY` due to Windows git CRLF conversion (`\r\n` vs `\n`).

### 1.4 Existing SDD Parsers & Architecture
- **`src/parsers/spec.js`**:
  - `parseSpec(content)` parses `spec.md` extracting:
    - User Stories: `RE_STORY = /^###\s+(US-\d{3,})\s*—\s*(.+?)\s*$/`
    - Acceptance Criteria: `RE_AC = /^####\s+(AC-\d{3,})\s*—\s*(.+?)\s*$/`
    - GWT clauses: `RE_GWT = /^\s*[-*]\s*\*\*(Dado|Quando|Então|Entao|E)\*\*\s*(.+?)\s*$/i`
    - Assumptions: `ASM-xxx` with status (`aberta | confirmada | invalidada`)
    - Questions: `Q-xxx` with status (`aberta | respondida`)
- **`src/parsers/tasks.js`**:
  - `parseTasks(content)` parses `tasks.md` extracting:
    - Task ID: `RE_TASK_ANY = /^##\s+(T-\d{3,})\s*—\s*(.+?)\s*$/`
    - Status: `[pendente | em-andamento | concluida]`
    - References: `Refs: US-xxx, AC-xxx`
    - Files: `Arquivos: path/to/file1, path/to/file2`
    - Execution metadata: `Modelo:` and `Esforço:`
- **`src/parsers/constitution.js`**:
  - `parseConstitution(content)` parses `constituicao.md` extracting `P-xxx` principles (`DEVE | RECOMENDADO | PODE`) and automated check rules.
- **`src/core/project.js`**:
  - `loadProject(config)` loads all specs, tasks, verification records, and annotations in the workspace into a consolidated JavaScript object.
- **`src/cli.js`**:
  - Contains CLI dispatcher for `init`, `new`, `plano`, `resumo`, `tarefa`, `audit`, `verify`, `scaffold`, `status`, `assumptions`, `licoes`.

---

## 2. Logic Chain

1. **Foundational Constraint (Zero-Dependency Ethos)**:
   - *Observation*: `package.json:7` states `"Zero dependências"` and `ARQUITETURA.md:35` defines `"Node.js >= 18, ESM puro, zero dependências"`.
   - *Inference*: Any solution integrated into the repository should not add bloated runtime dependencies to `package.json` that break publication to npm or require complex external native build tools.
   
2. **Environment & Sandbox Constraints**:
   - *Observation*: Running `npm ping` in sandbox mode was blocked/hung; bash execution failed due to Windows permissions (`E_ACCESSDENIED`).
   - *Inference*: The 3D Vault application and test suite must be **self-contained and offline-capable**. It must not depend on real-time internet CDN access or external npm downloads during automated test execution.

3. **Core Requirements from User Request (`ORIGINAL_REQUEST.md`)**:
   - **R1. 3D Vector Space & Navigation**: Continuous 3D vector space, mouse/drag controls (pan/orbit/zoom), smooth camera transitions between nodes via mathematical interpolation (`lerp`).
   - **R2. Conceptual Connections & Elastic Physics**: Real-time spring physics simulation connecting nodes; visual integrity feedback (normal edges are stable with default color; edges in circular dependencies or validation errors change color and trigger continuous physical harmonic vibration).
   - **R3. SDD Integration**: Read and map specifications (`.spec/`), extracting User Stories (US-xxx), Acceptance Criteria (AC-xxx), and Tasks (T-xxx) with relationships and audit/verification status, allowing inspection of node content and snippets.
   - **R4. Automated Test Suite & Validation Scenarios**: Unit tests with controlled synthetic graphs (valid graphs vs deliberate circular dependency cycles), testing cycle detection algorithm, SDD spec parser, and interactive browser verification.

4. **Architecture Derivation for the 3D Vault**:
   - **Data Layer (`src/vault/graph-data.js` & `src/vault/sdd-adapter.js`)**:
     Directly reuses `loadProject` and `src/parsers/spec.js`, `src/parsers/tasks.js` to convert `.spec/` into a standardized Graph model:
     - Nodes: `{ id, type: 'US'|'AC'|'TASK'|'COMPONENT', label, title, details, status, x, y, z, vx, vy, vz }`
     - Edges: `{ id, source, target, type: 'contains'|'implements'|'depends'|'calls', status: 'valid'|'cycle'|'error' }`
     - Synthetic Scenarios: Built-in synthetic datasets (clean DAG vs cyclic graphs such as `A -> B -> C -> A`).
   - **Algorithmic Engine (`src/vault/cycle-detector.js`)**:
     A robust directed cycle detection engine (Tarjan's Strongly Connected Components or DFS recursion stack) that flags every edge participating in a cycle as `status: 'cycle'`.
   - **Physics Engine (`src/vault/physics.js`)**:
     A 3D force-directed spring simulation:
     - Coulomb repulsive forces between all node pairs ($F_r = k_r / d^2$).
     - Hooke's elastic spring attraction between connected nodes ($F_s = k_s \times (d - L_0)$).
     - Velocity damping ($v \leftarrow v \times \text{damping}$) and centering force.
     - Vibration perturbation: Edges flagged as `cycle` compute a high-frequency sine-wave offset ($A \sin(\omega t)$) perpendicular to the edge direction, causing visible physical vibration.
   - **Rendering & Spatial UI (`src/vault/public/index.html`, `app.js`, `vault-3d.js`)**:
     A browser-based 3D scene using Three.js (vendored locally in `src/vault/public/vendor/three.module.js` and `OrbitControls.js` so it runs 100% offline).
     - 3D node meshes (spheres/cubes) with status-colored materials and glowing outlines.
     - Text/billboard sprites displaying node IDs (`US-001`, `AC-001`, etc.).
     - Camera navigation: OrbitControls for mouse pan/orbit/zoom, plus camera `lerp` animation targeting selected nodes on click.
     - Interactive HUD: Inspection drawer displaying node title, status, description, Given/When/Then, and linked files/tests.
     - Scenario selector: Switch between "Live SDD Repository", "Synthetic Valid Graph", and "Synthetic Circular Dependency".
   - **Server / Launcher (`src/vault/server.js` or `bin/onp-spec.js vault`)**:
     Zero-dependency Node native HTTP server (`node:http`) serving the vault web interface and exposing `/api/graph` (with fallback to synthetic data).
   - **Automated Verification Harness (`test/vault/*.test.js`)**:
     Native `node:test` suite verifying:
     - Cycle detection logic on synthetic graphs (DAGs, 2-node cycles, 3-node cycles, disconnected components).
     - SDD specification to graph node/edge mapping.
     - Physics simulation step calculation and vibrational offset logic.

---

## 3. Caveats

1. **Repository Root `.spec/` Directory**:
   - The root repository does not yet have a `.spec/` directory. An example exists at `examples/inscricao-turma/.spec`.
   - *Mitigation*: The Vault server and parser should default to looking for `.spec/` in the current working directory, fall back gracefully to `examples/inscricao-turma/.spec`, or load synthetic demo data if no `.spec/` directory exists.
2. **Headless Testing of WebGL**:
   - WebGL rendering contexts cannot run headlessly in pure Node.js without heavy native OpenGL wrappers (e.g. headless-gl).
   - *Mitigation*: Follow the proven industry pattern of **separating algorithmic logic from rendering**:
     - Graph structure, cycle detection, SDD parsing, and 3D physics math are 100% covered by automated tests using `node:test`.
     - 3D rendering, OrbitControls, and mouse interaction are verified interactively in the browser.
3. **Windows Environment Line Endings**:
   - Direct string comparisons against multi-line template literals must normalize line endings (`\r\n` $\rightarrow$ `\n`) to avoid Windows CRLF assertion failures.

---

## 4. Conclusion

The repository is a well-structured, zero-dependency Node.js ESM library with clean, modular parsers for SDD artifacts (`spec.md`, `tasks.md`, `constituicao.md`). Building the **Cofre 3D de Documentação & Diagramas** is completely feasible and cleanly aligns with the project's architecture:

1. **Keep Zero-Dependency Runtime**:
   Implement the 3D Vault as a self-contained feature within `src/vault/`, using Node's built-in `node:http` for the local server and vendored ESM Three.js (or lightweight WebGL) in `src/vault/public/vendor/` to ensure 100% offline functionality.
2. **Reuse Existing Parsers**:
   Integrate directly with `src/parsers/spec.js` and `src/parsers/tasks.js` to extract US, AC, Tasks, and code relationships into 3D graph nodes and edges.
3. **Implement Robust Cycle Detection**:
   Build a dedicated cycle detector (Tarjan/DFS) that flags cyclic dependencies and attaches vibrational physics states to error edges.
4. **Build Smooth Spatial Navigation**:
   Implement camera `lerp` interpolation, orbit/pan/zoom controls, raycasting selection, and a side-panel inspection HUD.
5. **Automated Test Coverage**:
   Create a dedicated test suite in `test/vault.test.js` or `test/vault-*.test.js` runnable with `node --test` that validates cycle detection and graph extraction with 100% pass rate.

---

## 5. Verification Method

To independently verify the observations and findings in this report:

1. **Verify Node & NPM Versions**:
   ```powershell
   node -v
   npm -v
   ```
   *Expected*: Node $\ge$ 18 (observed v24.19.0), npm $\ge$ 9 (observed 11.19.0).

2. **Verify Zero Runtime Dependencies**:
   Inspect `package.json`:
   ```powershell
   Get-Content package.json | Select-String "dependencies"
   ```
   *Expected*: No `"dependencies"` object in `package.json`.

3. **Verify Existing Tests**:
   Run core tests individually with Node's native test runner:
   ```powershell
   node --test test/parsers.test.js
   node --test test/audit.test.js
   node --test test/plano.test.js
   ```
   *Expected*: All pass with exit code 0.

4. **Verify SDD Specs in Examples**:
   Inspect the existing SDD feature files:
   ```powershell
   Get-ChildItem -Path "examples\inscricao-turma\.spec" -Recurse
   ```
   *Expected*: Contains `spec.md`, `tasks.md`, `constituicao.md`.

5. **Invalidation Conditions**:
   - If external npm dependencies are required for core execution, this would violate the zero-dependency contract.
   - If Three.js cannot run offline due to CDN-only dependencies, the sandbox/offline environment will fail. Vendoring the ESM bundle is required.
