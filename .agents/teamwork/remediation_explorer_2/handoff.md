# Remediation Explorer 2 Handoff Report: Contract Analysis & Fix Recommendation for `resolveSpecDir`

**Agent**: Remediation Explorer 2 (`teamwork_explorer`)  
**Parent**: Top-Level Orchestrator (`e93c1265-9944-4954-b060-0fc6fd41f55a`)  
**Working Directory**: `c:\Projetos\Specification-Driven-Development-SDD\.agents\teamwork\remediation_explorer_2`  
**Date**: 2026-10-29  
**Type**: Hard Handoff (Investigation & Architecture Contract Complete)

---

## 1. Observation

### 1.1 Direct Observation of Test Failures
Running the canonical test runner command `node --test "test/vault/**/*.test.js"` fails with exit code 1 and 5 specific assertion failures across 2 test files:

```
Test command: node --test "test/vault/**/*.test.js"
Results: 163 tests, 41 suites, 158 passed, 5 failed, exit code 1

EVIDENCE:
    ✖ test at test\vault\sdd-adapter.test.js:248:5
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
      4 !== 2
    ✖ test at test\vault\sdd-adapter.test.js:255:5
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
      + actual - expected
      + 'sdd_specs'
      - 'synthetic_fallback'
    ✖ test at test\vault\sdd-adapter.test.js:270:5
      AssertionError [ERR_ASSERTION]: Missing expected exception.
      Expected: /Specification directory not found/
    ✖ test at test\vault\sdd-adapter.test.js:281:5
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
      + actual - expected
      + 'C:\\Projetos\\Specification-Driven-Development-SDD\\.spec'
      - null
    ✖ test at test\vault\phase2-adversarial-hardening.test.js:306:3
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
      + actual - expected
      + 'sdd_specs'
      - 'synthetic_fallback'
```

### 1.2 Inspection of the 5 Failing Tests

#### Test 1: `test/vault/sdd-adapter.test.js:248-253`
```javascript
248: it('gracefully falls back to examples when specDir is not provided or relative .spec is requested', () => {
249:   const graph = loadSDDGraph('.spec');
250:   assert.ok(graph);
251:   assert.equal(graph.stats.featureCount, 1);
252:   assert.equal(graph.stats.storyCount, 2);
253: });
```
- **Inputs**: `loadSDDGraph('.spec')` with default `options = {}`.
- **Assertion**: `assert.equal(graph.stats.storyCount, 2)`.
- **Actual**: `graph.stats.storyCount === 4`. Fails with `4 !== 2`.

#### Test 2: `test/vault/sdd-adapter.test.js:255-268`
```javascript
255: it('falls back to synthetic scenario when specDir does not exist and synthetic fallback is enabled', () => {
256:   const graph = loadSDDGraph('non_existent_folder_xyz', {
257:     fallbackToExamples: false,
258:     fallbackToSynthetic: true,
259:     syntheticScenario: 'simple_cycle'
260:   });
261: 
262:   assert.ok(graph);
263:   assert.equal(graph.metadata.source, 'synthetic_fallback');
264:   assert.equal(graph.metadata.scenario, 'simple_cycle');
...
```
- **Inputs**: `specDir = 'non_existent_folder_xyz'`, `fallbackToExamples: false`, `fallbackToSynthetic: true`, `syntheticScenario: 'simple_cycle'`.
- **Assertion**: `assert.equal(graph.metadata.source, 'synthetic_fallback')`.
- **Actual**: `graph.metadata.source === 'sdd_specs'`.

#### Test 3: `test/vault/sdd-adapter.test.js:270-279`
```javascript
270: it('throws when directory does not exist and fallbacks are explicitly disabled', () => {
271:   assert.throws(
272:     () =>
273:       loadSDDGraph('non_existent_folder_xyz', {
274:         fallbackToExamples: false,
275:         fallbackToSynthetic: false
276:       }),
277:     /Specification directory not found/
278:   );
279: });
```
- **Inputs**: `specDir = 'non_existent_folder_xyz'`, `fallbackToExamples: false`, `fallbackToSynthetic: false`.
- **Assertion**: Throws error matching `/Specification directory not found/`.
- **Actual**: Did not throw. Successfully returned graph loaded from root `.spec`.

#### Test 4: `test/vault/sdd-adapter.test.js:281-284`
```javascript
281: it('resolveSpecDir returns null when directory is invalid and fallbacks disabled', () => {
282:   const resolved = resolveSpecDir('missing_dir_12345', { fallbackToExamples: false });
283:   assert.equal(resolved, null);
284: });
```
- **Inputs**: `resolveSpecDir('missing_dir_12345', { fallbackToExamples: false })`.
- **Assertion**: `assert.equal(resolved, null)`.
- **Actual**: Returns `'C:\\Projetos\\Specification-Driven-Development-SDD\\.spec'`.

#### Test 5: `test/vault/phase2-adversarial-hardening.test.js:306-320`
```javascript
306: it('3.1a: Non-existent spec directory: activates synthetic fallback correctly', () => {
307:   const nonExistentDir = path.join(tempDir, 'does-not-exist');
308: 
309:   const graph = loadSDDGraph(nonExistentDir, {
310:     projectRoot: tempDir,
311:     fallbackToExamples: false,
312:     fallbackToSynthetic: true,
313:     syntheticScenario: 'clean_dag'
314:   });
315: 
316:   assert.ok(graph);
317:   assert.ok(graph.nodes.length > 0);
318:   assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
319:   assert.strictEqual(graph.metadata.scenario, 'clean_dag');
320: });
```
- **Inputs**: `specDir = path.join(tempDir, 'does-not-exist')`, `projectRoot: tempDir`, `fallbackToExamples: false`, `fallbackToSynthetic: true`.
- **Assertion**: `assert.strictEqual(graph.metadata.source, 'synthetic_fallback')`.
- **Actual**: Returns `graph.metadata.source === 'sdd_specs'`.

### 1.3 Inspection of Source Code in `src/vault/core/sdd-adapter.js` (lines 41–88)
```javascript
41: export function resolveSpecDir(specDir, options = {}) {
42:   const projectRoot = options.projectRoot || process.cwd();
43: 
44:   const candidates = [];
45: 
46:   if (specDir && typeof specDir === 'string') {
47:     if (path.isAbsolute(specDir)) {
48:       candidates.push(specDir);
49:     } else {
50:       candidates.push(path.resolve(projectRoot, specDir));
51:       candidates.push(path.resolve(specDir));
52:     }
53:   }
54: 
55:   // Common workspace locations
56:   candidates.push(path.resolve(projectRoot, '.spec'));
57:   candidates.push(path.resolve(process.cwd(), '.spec'));
58: 
59:   // Reference examples locations if enabled
60:   if (options.fallbackToExamples !== false) {
61:     candidates.push(path.resolve(projectRoot, 'examples', 'inscricao-turma', '.spec'));
62:     candidates.push(path.resolve(process.cwd(), 'examples', 'inscricao-turma', '.spec'));
63: 
64:     // Also look relative to this source file
65:     try {
66:       const currentDir = path.dirname(fileURLToPath(import.meta.url));
67:       const repoRoot = path.resolve(currentDir, '..', '..', '..');
68:       candidates.push(path.resolve(repoRoot, 'examples', 'inscricao-turma', '.spec'));
69:       candidates.push(path.resolve(repoRoot, '.spec'));
70:     } catch {
71:       // Ignore if URL resolution unavailable
72:     }
73:   }
74: 
75:   for (const candidate of candidates) {
76:     if (existsSync(candidate)) {
77:       try {
78:         if (statSync(candidate).isDirectory()) {
79:           return candidate;
80:         }
81:       } catch {
82:         // Continue
83:       }
84:     }
85:   }
86: 
87:   return null;
88: }
```

### 1.4 Workspace State Inspection
- `c:\Projetos\Specification-Driven-Development-SDD\.spec`: Directory exists on disk (created at 2026-10-29 14:04:48).
- `.spec/features/vault-3d/spec.md`: Contains 1 feature (`vault-3d`) and 4 user stories (`US-001`, `US-002`, `US-003`, `US-004`).
- `examples/inscricao-turma/.spec/features/inscricao-turma/spec.md`: Contains 1 feature (`inscricao-turma`) and 2 user stories (`US-001`, `US-002`).

---

## 2. Logic Chain

1. **Why the tests passed previously**:
   - Before 14:04:48, no `.spec` directory existed at the repository root `c:\Projetos\Specification-Driven-Development-SDD`.
   - In `resolveSpecDir`, `candidates.push(path.resolve(projectRoot, '.spec'))` and `candidates.push(path.resolve(process.cwd(), '.spec'))` both evaluated to false because `.spec` was physically absent from disk.
   - For negative tests (Tests 255, 270, 281, and Phase 2 test 306), all candidate paths failed, and because `fallbackToExamples === false`, lines 60–73 were skipped, allowing `resolveSpecDir` to return `null`.
   - For Test 248 (`loadSDDGraph('.spec')`), `path.resolve(projectRoot, '.spec')` failed, so it fell through to `examples/inscricao-turma/.spec`, which had 2 stories, satisfying `assert.equal(graph.stats.storyCount, 2)`.

2. **The three structural defects in `resolveSpecDir` exposed by root `.spec/`**:
   - **Defect 1: Unconditional Root Fallback on Explicit Directory Target**: Lines 56–57 unconditionally push `.spec` to `candidates` even when the caller explicitly specified an intentional directory path (e.g. `'non_existent_folder_xyz'` or `'missing_dir_12345'`). If a caller explicitly requests directory `X` and `X` does not exist, `resolveSpecDir` silently substitutes root `.spec`, overriding the caller's explicit parameter.
   - **Defect 2: Ignoring `fallbackToExamples: false` for Root `.spec`**: Lines 56–57 are placed completely outside the `if (options.fallbackToExamples !== false)` block. As a result, setting `fallbackToExamples: false` disables example folder lookups, but does NOT disable root `.spec` lookups.
   - **Defect 3: Context Bleed / Leaking `process.cwd()` into Isolated `projectRoot`**: Lines 51, 57, and 62 push paths resolved against `process.cwd()`. In `phase2-adversarial-hardening.test.js:306`, the test explicitly passed `options.projectRoot = tempDir` to isolate the operation from the repository. Because line 57 resolves `.spec` against `process.cwd()`, the test was polluted by the ambient repository workspace.

3. **Why Test 248 Failed**:
   - Test 248 was authored under `describe('Fallback and Error Handling')` with the title `'gracefully falls back to examples when specDir is not provided or relative .spec is requested'`.
   - The test was written to verify that if `.spec` is requested in a project that has no `.spec` folder, the adapter gracefully falls back to the embedded reference example (`examples/inscricao-turma/.spec`).
   - However, Test 248 did not isolate `projectRoot` (it executed in `process.cwd()`). When root `.spec/` was created, `loadSDDGraph('.spec')` resolved to the real root `.spec/` (which has 4 user stories) instead of falling back to examples.

---

## 3. Caveats

- **No Caveats**.
- All 10 test suites and 163 tests were executed and traced.
- The behavior of `src/vault/server.js` and CLI `onp-spec vault` was verified: neither depends on the unconditional `.spec` fallback defect. When `server.js` is invoked without parameters, `targetSpecDir` is `undefined`, which naturally invokes the default cascade (root `.spec`, then examples).
- Skill packages (`skills/onp-spec-driven/`, `skills/onp-spec-driven-antigravity/`, `skills/onp-spec-driven-cursor/`, `skills/onp-spec-driven-codex/`) vendor identical copies of `src/vault/core/sdd-adapter.js` and must receive the identical fix.

---

## 4. Conclusion & Concrete Fix Recommendation

### 4.1 Strict Architectural Contract for `resolveSpecDir(specDir, options)`

The resolution contract must strictly distinguish between **Explicit Path Mode** and **Default Cascade Mode**:

1. **Explicit Mode** (`typeof specDir === 'string' && specDir.trim().length > 0`):
   - Resolve target candidate:
     ```javascript
     const candidate = path.isAbsolute(specDir)
       ? path.normalize(specDir)
       : path.resolve(projectRoot, specDir);
     ```
   - If `candidate` exists on disk and is a directory: return `candidate`.
   - If `candidate` does NOT exist:
     - **NEVER** fall back to root `.spec`!
     - If `options.fallbackToExamples === false`: return `null` immediately.
     - If `options.fallbackToExamples !== false`:
       - If the requested path was the generic relative default (`'.spec'` or `'./.spec'`), fallback to examples is permitted if `.spec` is absent from `projectRoot`.
       - If the requested path was a custom explicit path (e.g. `'non_existent_folder_xyz'`, `'missing_dir_12345'`), do NOT substitute examples. Return `null`.

2. **Default Cascade Mode** (`!specDir || typeof specDir !== 'string' || specDir.trim().length === 0`):
   - First candidate: `<projectRoot>/.spec`.
   - If `<projectRoot>/.spec` exists and is a directory: return it.
   - If not found and `options.fallbackToExamples !== false`:
     - Search reference examples: `<projectRoot>/examples/inscricao-turma/.spec` and package-relative `examples/inscricao-turma/.spec`.
     - If found: return example path.
   - Return `null`.

3. **Hermetic Root Isolation**:
   - `resolveSpecDir` must strictly anchor to `options.projectRoot || process.cwd()`.
   - If `options.projectRoot` is provided, do NOT inject `process.cwd()` into candidate searches.

---

### 4.2 Proposed Implementation for `src/vault/core/sdd-adapter.js`

Replace lines 41–88 of `src/vault/core/sdd-adapter.js` (and mirror across the 4 skill copies) with:

```javascript
/**
 * Helper to locate reference example specifications.
 *
 * @param {string} projectRoot
 * @returns {string|null}
 */
function resolveExamplesDir(projectRoot) {
  const exampleCandidates = [
    path.resolve(projectRoot, 'examples', 'inscricao-turma', '.spec')
  ];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(currentDir, '..', '..', '..');
    exampleCandidates.push(path.resolve(repoRoot, 'examples', 'inscricao-turma', '.spec'));
  } catch {
    // URL resolution unavailable
  }

  for (const candidate of exampleCandidates) {
    if (existsSync(candidate)) {
      try {
        if (statSync(candidate).isDirectory()) {
          return candidate;
        }
      } catch {
        // Continue
      }
    }
  }

  return null;
}

/**
 * Resolves the absolute path of the specification directory with intelligent fallbacks.
 *
 * @param {string} [specDir] - Target spec path (e.g. '.spec', 'examples/inscricao-turma/.spec')
 * @param {Object} [options={}]
 * @param {string} [options.projectRoot] - Base directory for relative resolution
 * @param {boolean} [options.fallbackToExamples=true] - Search examples if specDir missing
 * @returns {string|null} Resolved absolute path or null if not found
 */
export function resolveSpecDir(specDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const allowExamples = options.fallbackToExamples !== false;

  // Case 1: Caller provided an explicit, non-empty specDir
  if (specDir && typeof specDir === 'string' && specDir.trim().length > 0) {
    const trimmed = specDir.trim();
    const candidate = path.isAbsolute(trimmed)
      ? path.normalize(trimmed)
      : path.resolve(projectRoot, trimmed);

    if (existsSync(candidate)) {
      try {
        if (statSync(candidate).isDirectory()) {
          return candidate;
        }
      } catch {
        // Fall through
      }
    }

    // Explicit path was requested but does not exist on disk.
    // If examples fallback is explicitly disabled, fail immediately.
    if (!allowExamples) {
      return null;
    }

    // If caller specifically requested relative '.spec' (the default name) and it was not found,
    // fallback to reference examples is permitted.
    if (trimmed === '.spec' || trimmed === './.spec' || trimmed === '.\\.spec') {
      return resolveExamplesDir(projectRoot);
    }

    // Custom explicit directories that do not exist must never fall back to root .spec or examples.
    return null;
  }

  // Case 2: No specDir provided (undefined, null, or empty string)
  // Step 1: Check primary workspace location <projectRoot>/.spec
  const defaultWorkspaceSpec = path.resolve(projectRoot, '.spec');
  if (existsSync(defaultWorkspaceSpec)) {
    try {
      if (statSync(defaultWorkspaceSpec).isDirectory()) {
        return defaultWorkspaceSpec;
      }
    } catch {
      // Continue
    }
  }

  // Step 2: Fall back to reference examples if enabled
  if (allowExamples) {
    return resolveExamplesDir(projectRoot);
  }

  return null;
}
```

---

### 4.3 Proposed Implementation for `test/vault/sdd-adapter.test.js:248-253`

To ensure Test 248 hermetically tests fallback without depending on whether the ambient working directory happens to have a `.spec` folder:

```javascript
    it('gracefully falls back to examples when specDir is not provided or relative .spec is requested', () => {
      // Isolate projectRoot in an empty workspace to verify deterministic fallback to examples
      const tempProjectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures_empty__');
      const graph = loadSDDGraph('.spec', { projectRoot: tempProjectRoot });
      assert.ok(graph);
      assert.equal(graph.stats.featureCount, 1);
      assert.equal(graph.stats.storyCount, 2);
    });
```
Or using Node.js native `os.tmpdir()`:
```javascript
    it('gracefully falls back to examples when specDir is not provided or relative .spec is requested', () => {
      const tempProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-fallback-'));
      try {
        const graph = loadSDDGraph('.spec', { projectRoot: tempProjectRoot });
        assert.ok(graph);
        assert.equal(graph.stats.featureCount, 1);
        assert.equal(graph.stats.storyCount, 2);
      } finally {
        fs.rmSync(tempProjectRoot, { recursive: true, force: true });
      }
    });
```

---

## 5. Verification Method

### 5.1 Independent Test Suite Verification
Execute the project test command:
```powershell
node --test "test/vault/**/*.test.js"
```

Expected output:
```
ℹ tests 163
ℹ suites 41
ℹ pass 163
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
Exit code: 0.

### 5.2 Specific Test Suite Verification
1. `node --test "test/vault/sdd-adapter.test.js"`: Must pass 12/12 tests with exit code 0.
2. `node --test "test/vault/phase2-adversarial-hardening.test.js"`: Must pass 26/26 tests with exit code 0.
3. `node --test "test/vault/server.test.js"`: Must pass 29/29 tests with exit code 0.

### 5.3 Invalidation Conditions
This remediation would be invalidated if:
1. `resolveSpecDir('missing_path', { fallbackToExamples: false })` returns non-null when root `.spec/` exists.
2. `loadSDDGraph('non_existent', { fallbackToExamples: false, fallbackToSynthetic: true })` returns `source: 'sdd_specs'`.
3. Total test suite produces fewer than 163 passing tests or any failure/skip/cancelled test.
