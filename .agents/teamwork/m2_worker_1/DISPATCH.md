## 2026-10-29T16:08:57Z
You are M2 Worker 1.
Your working directory is: c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\m2_worker_1

MANDATORY FIRST STEP:
Read c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\ORIGINAL_REQUEST.md before doing anything else.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

READ BLUEPRINTS:
1. c:\Projetos\Specification-Driven-Development-SDD\PROJECT.md (Milestone 2 interface contracts)
2. c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\survey_spec_miner_1\handoff.md (Detailed SDD schemas, GWT clauses, task refs, audit findings)
3. Existing parsers in `src/parsers/spec.js`, `src/parsers/tasks.js`, `src/parsers/constitution.js`, `src/core/project.js`
4. Milestone 1 modules in `src/vault/core/graph-model.js` and `src/vault/core/cycle-detector.js`

FILES YOU OWN EXCLUSIVELY:
- src/vault/core/sdd-adapter.js
- src/vault/core/synthetic-data.js
- test/vault/sdd-adapter.test.js
- test/vault/synthetic-data.test.js

YOUR IMPLEMENTATION MISSION:
1. Implement `src/vault/core/sdd-adapter.js`:
   - `loadSDDGraph(specDir, options={})`:
     - Discovers and loads spec files from `specDir` (support `.spec/`, `examples/inscricao-turma/.spec/`, or custom path; if not found, gracefully fall back to examples or synthetic).
     - Ingests User Stories (`US-xxx`), Acceptance Criteria (`AC-xxx`), Tasks (`T-xxx`), Assumptions (`ASM-xxx`), Questions (`Q-xxx`), and Principles (`P-xxx`).
     - Extracts GWT clauses (`Dado`, `Quando`, `Então`/`Entao`, `E`), status, descriptions, task file references (`Arquivos:`).
     - Generates `VaultGraphNode` instances with initial 3D positions clustered logically (e.g. specs at center, stories in orbital layer 1, ACs in layer 2, tasks in layer 3).
     - Generates `VaultGraphEdge` instances with appropriate relation types (`contains`, `implements`, `touches`, `depends`).
     - Invokes `detectCycles(nodes, edges)` from `src/vault/core/cycle-detector.js` to evaluate graph integrity and flag any circular dependencies.
     - Returns `{ nodes, edges, metadata, stats }`.
   - Also export utility functions like `convertProjectToGraph(projectData)`.

2. Implement `src/vault/core/synthetic-data.js`:
   - Implement `getSyntheticScenario(name)` and `listSyntheticScenarios()`.
   - Scenarios to provide (strictly matching R4):
     - `clean_dag`: Clean layered DAG with no circular dependencies.
     - `simple_cycle`: Triangular circular dependency (`A -> B -> C -> A`).
     - `multi_cycle_figure8`: Two cycles intersecting at a shared articulation node (`A -> B -> C -> A` and `C -> D -> E -> C`).
     - `disjoint_hybrid`: Disconnected graph with one cyclic component and one valid DAG component.
     - `adversarial_drift`: Complex multi-feature graph with intentional circular cross-feature dependencies.
   - Each scenario returns `{ nodes, edges, name, description, expectedCycles }`.

3. Author comprehensive automated tests:
   - `test/vault/sdd-adapter.test.js`: test parsing real `examples/inscricao-turma/.spec/`, mapping US/AC/T nodes, GWT clauses, audit statuses, file refs, and fallback behavior.
   - `test/vault/synthetic-data.test.js`: test all 5 synthetic scenarios with cycle detector validation.
   - Ensure all tests pass with `node --test "test/vault/**/*.test.js"`.
   - Ensure embedded skills stay synced with `node tools/build-skill.mjs` and `node --test test/skill-sync.test.js`.

4. Output:
   Write your completion report to `c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\m2_worker_1\handoff.md`.
   Include test commands and verbatim passing output.
   Send a completion message to the orchestrator (caller) when done.
