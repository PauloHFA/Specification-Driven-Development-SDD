## 2026-10-29T16:22:47Z
You are M3 Worker 1.
Your working directory is: c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\m3_worker_1

MANDATORY FIRST STEP:
Read c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\ORIGINAL_REQUEST.md before doing anything else.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

READ BLUEPRINTS & CONTRACTS:
1. c:\Projetos\Specification-Driven-Development-SDD\PROJECT.md (Milestone 3 interface contracts, F8 and F9)
2. c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\survey_explorer_1\handoff.md (Three.js vendoring, offline requirements, CLI integration)
3. c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\survey_explorer_2\handoff.md (Camera lerp, orbit controls, standing wave vibration parameters)
4. M1 and M2 core modules in `src/vault/math/`, `src/vault/physics/`, and `src/vault/core/` (especially `sdd-adapter.js` and `synthetic-data.js`)

FILES YOU OWN:
- src/vault/server.js
- src/vault/public/index.html
- src/vault/public/style.css
- src/vault/public/app.js
- src/vault/public/vault-3d.js
- src/vault/public/vendor/* (three.module.js, OrbitControls.js)
- src/cli.js (add 'vault' command)
- test/vault/server.test.js

YOUR IMPLEMENTATION MISSION:
1. Implement `src/vault/server.js`:
   - Zero-dependency Node native `node:http` server.
   - Serve static files from `src/vault/public/` with correct MIME types (`.html`, `.js`, `.css`, `.json`, `.svg`, etc.).
   - Expose `/api/graph`: loads graph via `loadSDDGraph` (or query param `?scenario=<name>` via `getSyntheticScenario`).
   - Expose `/api/scenarios`: lists all available scenarios (`live_sdd`, `clean_dag`, `simple_cycle`, `multi_cycle_figure8`, `disjoint_hybrid`, `adversarial_drift`).
   - Expose `/api/health`.
   - Export `startVaultServer(options)` and `createServerInstance(options)`.

2. Implement `src/vault/public/index.html`, `style.css`, `app.js`, and `vault-3d.js`:
   - Vendor minimal offline ESM Three.js and OrbitControls in `src/vault/public/vendor/` (or lightweight self-contained WebGL/Three bundle) so it works 100% offline without internet.
   - Continuous 3D vector space viewport.
   - Nodes: 3D spheres with status/type color coding (Features, Stories, ACs, Tasks, Principles, Files).
   - Text/Billboard labels for node IDs (`US-001`, `AC-001`, `T-001`).
   - Elastic lines: stable standard color (sky-blue/slate) for normal edges.
   - Vibration: edges participating in circular dependencies or errors render as glowing crimson red lines physically vibrating with real-time transverse standing waves ($A \sin(\omega t)$).
   - Mouse navigation: Pan, Orbit, Zoom controls.
   - Smooth camera transition: Clicking a node smoothly lerps camera focus to the target node using mathematical interpolation (Slerp + Arc Lerp).
   - Side-panel inspection HUD: Slide-out panel displaying node details: ID, title, type, status badge, Given/When/Then clauses, linked files, audit findings.
   - Top toolbar: Scenario selector dropdown allowing instant switching between "Live SDD Repository (.spec/)" and the 5 synthetic test scenarios (`clean_dag`, `simple_cycle`, `multi_cycle_figure8`, `disjoint_hybrid`, `adversarial_drift`), physics toggle (play/pause), reset view button.

3. Integrate CLI in `src/cli.js`:
   - Add `vault` command: `onp-spec vault [--port 3333] [--open]` to launch the server and display link.
   - Export and handle gracefully.

4. Write comprehensive automated tests in `test/vault/server.test.js`:
   - Test server startup, shutdown, static file serving, MIME types, `/api/graph`, `/api/scenarios`, and scenario query parameters.

5. Verify:
   - Run `node --test "test/vault/**/*.test.js"` (all suites must pass).
   - Run `node tools/build-skill.mjs` and `node --test test/skill-sync.test.js` (skills must remain synced).

6. Output:
   Write your completion report to `c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\m3_worker_1\handoff.md`.
   Include test commands and verbatim passing output.
   Send a completion message to the orchestrator (caller) when done.
