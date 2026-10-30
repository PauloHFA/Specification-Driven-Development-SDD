# Remediation Investigation Report — SDD Adapter Path Resolution & Victory Audit Rejection

**Author**: Remediation Explorer 1 (`teamwork_explorer`)  
**Target**: `src/vault/core/sdd-adapter.js`, `test/vault/sdd-adapter.test.js`, `test/vault/phase2-adversarial-hardening.test.js`  
**Milestone**: Victory Remediation  
**Date**: 2026-10-29  
**Type**: Hard Handoff (Investigation & Fix Strategy)  

---

## 1. Observation

### 1.1 Verbatim Canonical Test Execution Failures
Running the project's canonical test suite via:
```powershell
node --test "test/vault/**/*.test.js"
```
Direct output:
```
✖ test at test\vault\sdd-adapter.test.js:248:5
  gracefully falls back to examples when specDir is not provided or relative .spec is requested (8.1838ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  4 !== 2
      at TestContext.<anonymous> (file:///C:/Projetos/Specification-Driven-Development-SDD/test/vault/sdd-adapter.test.js:252:14)

✖ test at test\vault\sdd-adapter.test.js:255:5
  falls back to synthetic scenario when specDir does not exist and synthetic fallback is enabled (7.6351ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + 'sdd_specs'
  - 'synthetic_fallback'
      at TestContext.<anonymous> (file:///C:/Projetos/Specification-Driven-Development-SDD/test/vault/sdd-adapter.test.js:263:14)

✖ test at test\vault\sdd-adapter.test.js:270:5
  throws when directory does not exist and fallbacks are explicitly disabled (6.9339ms)
  AssertionError [ERR_ASSERTION]: Missing expected exception.
  Expected: /Specification directory not found/
      at TestContext.<anonymous> (file:///C:/Projetos/Specification-Driven-Development-SDD/test/vault/sdd-adapter.test.js:271:14)

✖ test at test\vault\sdd-adapter.test.js:281:5
  resolveSpecDir returns null when directory is invalid and fallbacks disabled (1.4093ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + 'C:\\Projetos\\Specification-Driven-Development-SDD\\.spec'
  - null
      at TestContext.<anonymous> (file:///C:/Projetos/Specification-Driven-Development-SDD/test/vault/sdd-adapter.test.js:283:14)

✖ test at test\vault\phase2-adversarial-hardening.test.js:306:3
  3.1a: Non-existent spec directory: activates synthetic fallback correctly (3.7886ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + 'sdd_specs'
  - 'synthetic_fallback'
      at TestContext.<anonymous> (file:///C:/Projetos/Specification-Driven-Development-SDD/test/vault/phase2-adversarial-hardening.test.js:318:12)

ℹ tests 163
ℹ suites 41
ℹ pass 158
ℹ fail 5
```

### 1.2 Inspection of `src/vault/core/sdd-adapter.js` (lines 41–88)
```javascript
export function resolveSpecDir(specDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();

  const candidates = [];

  if (specDir && typeof specDir === 'string') {
    if (path.isAbsolute(specDir)) {
      candidates.push(specDir);
    } else {
      candidates.push(path.resolve(projectRoot, specDir));
      candidates.push(path.resolve(specDir));
    }
  }

  // Common workspace locations
  candidates.push(path.resolve(projectRoot, '.spec'));
  candidates.push(path.resolve(process.cwd(), '.spec'));

  // Reference examples locations if enabled
  if (options.fallbackToExamples !== false) {
    candidates.push(path.resolve(projectRoot, 'examples', 'inscricao-turma', '.spec'));
    candidates.push(path.resolve(process.cwd(), 'examples', 'inscricao-turma', '.spec'));

    // Also look relative to this source file
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const repoRoot = path.resolve(currentDir, '..', '..', '..');
      candidates.push(path.resolve(repoRoot, 'examples', 'inscricao-turma', '.spec'));
      candidates.push(path.resolve(repoRoot, '.spec'));
    } catch {
      // Ignore if URL resolution unavailable
    }
  }

  for (const candidate of candidates) {
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
```

### 1.3 Inspection of `loadSDDGraph` in `src/vault/core/sdd-adapter.js` (lines 682–756)
```javascript
export function loadSDDGraph(specDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const resolved = resolveSpecDir(specDir, {
    projectRoot,
    fallbackToExamples: options.fallbackToExamples !== false
  });

  function buildSyntheticFallback() {
    const scenarioName = options.syntheticScenario || 'clean_dag';
    const scenario = getSyntheticScenario(scenarioName);
    ...
    const metadata = {
      loadedAt: new Date().toISOString(),
      source: 'synthetic_fallback',
      ...
    };
    return { nodes: scenario.nodes, edges: scenario.edges, metadata, stats };
  }

  if (!resolved) {
    if (options.fallbackToSynthetic !== false) {
      return buildSyntheticFallback();
    }

    throw new Error(
      `Specification directory not found: "${specDir || '.spec'}". Ensure .spec exists or enable fallback.`
    );
  }
  ...
  const metadata = {
    loadedAt: new Date().toISOString(),
    source: options.source || 'sdd_specs',
    ...
  };
  return { nodes, edges, metadata, stats };
}
```

### 1.4 Disk State and Chronology
- At `2026-10-29 14:04:48`, untracked folder `.spec/` was created on disk in the repository root, containing:
  - `.spec/constituicao.md`
  - `.spec/features/vault-3d/spec.md` (defining feature `vault-3d` with **4 user stories**: `US-001`, `US-002`, `US-003`, `US-004`)
  - `.spec/features/vault-3d/tasks.md`
  - `.spec/verification/`
- Prior to 14:04:48, the repository had **no root `.spec/` directory**. The only `.spec` folder was `examples/inscricao-turma/.spec`, which defines feature `inscricao-turma` with **2 user stories** (`US-001`, `US-002`).

---

## 2. Logic Chain

### 2.1 The Four Resolution Axes in `resolveSpecDir`
Tracing the code in Observation 1.2 explains how `resolveSpecDir` resolves paths across all combinations:

| Axis / Condition | Current Behavior | Flaw Exposed by Root `.spec/` | Expected / Correct Behavior |
|---|---|---|---|
| **1. Explicit non-existent `specDir` passed** (e.g. `'missing_dir_12345'`, `'non_existent_folder_xyz'`) | Pushes explicit candidate (fails `existsSync`), then unconditionally proceeds to lines 56–57: pushes `projectRoot/.spec` and `cwd/.spec`. | Because root `.spec` exists, it resolves to `C:\...\.spec`. Caller asked for X, but got `.spec`. | If caller requests an explicit path that does not exist on disk, it must **never** fall through to workspace root `.spec`. |
| **2. `options.fallbackToExamples === false`** | Skips lines 60–73 (`examples/inscricao-turma/.spec`). But lines 56–57 (`.spec` in `projectRoot` and `process.cwd()`) are **outside** this guard. | Root `.spec` is checked and returned even when fallback is explicitly disabled! Test 281 receives root `.spec` instead of `null`. | When fallback is disabled and the explicit path does not exist, return `null` immediately. |
| **3. Root `.spec/` exists vs when absent** | **When absent**: Candidates in lines 56–57 did not exist on disk, so with `fallbackToExamples: false` candidates array was exhausted and returned `null`.<br>**When present**: Candidates in lines 56–57 exist and succeed. | Prior test runs only passed by coincidence because root `.spec` did not exist on disk. Creating `.spec` exposed the lurking logical fall-through. | Whether root `.spec` exists or not, an explicit missing path must return `null` (or throw). Root `.spec` should only be used when `specDir` was not explicitly provided or when `.spec` was explicitly requested. |
| **4. `options.fallbackToSynthetic === true / false`** | In `loadSDDGraph`, lines 747–755 check `if (!resolved)`. Because `resolveSpecDir` returned root `.spec` instead of `null`, `!resolved` evaluates to `false`. | Synthetic fallback (`buildSyntheticFallback`) and `throw new Error(...)` are never executed! `loadSDDGraph` parses root `.spec` and returns `{ metadata: { source: 'sdd_specs' } }`. | `resolveSpecDir` returning `null` properly triggers synthetic fallback when enabled, or throws `Specification directory not found` when disabled. |
| **5. Isolated `options.projectRoot`** (e.g. `tempDir`) | Line 57 pushes `path.resolve(process.cwd(), '.spec')`. | Even if caller specifies an isolated `projectRoot: tempDir`, `process.cwd()` leaks the host workspace root `.spec` into the isolated sandbox! | If `options.projectRoot` is provided, **never** leak `process.cwd()`. |

### 2.2 Forensic Breakdown of the 5 Test Failures

1. **`test/vault/sdd-adapter.test.js:281` (`resolveSpecDir returns null when directory is invalid and fallbacks disabled`)**:
   - Call: `resolveSpecDir('missing_dir_12345', { fallbackToExamples: false })`
   - Explicit candidate `missing_dir_12345` does not exist.
   - Line 57 pushed `process.cwd() + '/.spec'`, which exists.
   - Result: returns `'C:\\Projetos\\Specification-Driven-Development-SDD\\.spec'` instead of `null`.

2. **`test/vault/sdd-adapter.test.js:270` (`throws when directory does not exist and fallbacks are explicitly disabled`)**:
   - Call: `loadSDDGraph('non_existent_folder_xyz', { fallbackToExamples: false, fallbackToSynthetic: false })`
   - `resolveSpecDir` returns root `.spec` instead of `null`.
   - `loadSDDGraph` does not enter `if (!resolved)`.
   - Result: No error thrown -> `AssertionError: Missing expected exception`.

3. **`test/vault/sdd-adapter.test.js:255` (`falls back to synthetic scenario when specDir does not exist and synthetic fallback is enabled`)**:
   - Call: `loadSDDGraph('non_existent_folder_xyz', { fallbackToExamples: false, fallbackToSynthetic: true, syntheticScenario: 'simple_cycle' })`
   - `resolveSpecDir` returns root `.spec`.
   - `loadSDDGraph` parses root `.spec` and sets `metadata.source = 'sdd_specs'`.
   - Result: Expected `'synthetic_fallback'`, got `'sdd_specs'`.

4. **`test/vault/phase2-adversarial-hardening.test.js:306` (`3.1a: Non-existent spec directory: activates synthetic fallback correctly`)**:
   - Call: `loadSDDGraph(nonExistentDir, { projectRoot: tempDir, fallbackToExamples: false, fallbackToSynthetic: true, syntheticScenario: 'clean_dag' })`
   - Candidate `tempDir/does-not-exist` does not exist; `tempDir/.spec` does not exist.
   - But line 57 pushed `path.resolve(process.cwd(), '.spec')`, which found root `.spec`.
   - Result: Host workspace `.spec` leaked into `tempDir` test, returning `'sdd_specs'` instead of `'synthetic_fallback'`.

5. **`test/vault/sdd-adapter.test.js:248` (`gracefully falls back to examples when specDir is not provided or relative .spec is requested`)**:
   - Call: `loadSDDGraph('.spec')` with no options (default `projectRoot: process.cwd()`).
   - Assertion: `assert.equal(graph.stats.storyCount, 2)`.
   - Before 14:04:48, `.spec` did not exist at root. It fell through to `examples/inscricao-turma/.spec` (which has 2 stories: `US-001`, `US-002`).
   - After 14:04:48, `.spec` **does** exist at root (`features/vault-3d/spec.md`, which has 4 stories: `US-001`, `US-002`, `US-003`, `US-004`).
   - Because `.spec` is a valid, real specification directory, `loadSDDGraph('.spec')` parsed it and returned 4 stories.
   - Result: Expected `2` (the example spec), got `4` (the real project spec).

---

## 3. Caveats

1. **Skill Synchronization Requirement**:
   Any modification to `src/vault/core/sdd-adapter.js` will cause `test/skill-sync.test.js` to fail (`scripts/lib/src espelha src/ byte a byte`) unless `node tools/build-skill.mjs` is executed immediately after code modification to sync the 4 embedded skills (`onp-spec-driven`, `onp-spec-driven-antigravity`, `onp-spec-driven-codex`, `onp-spec-driven-cursor`).
2. **Dual Solutions for Test 248**:
   - **Recommended Approach**: Fix `resolveSpecDir` AND isolate test 248 in `test/vault/sdd-adapter.test.js` by passing `{ projectRoot: path.join(__dirname, 'fixtures', 'missing-root') }` or a mock non-existent projectRoot. This accurately preserves the test's intent ("test fallback to examples when .spec does not exist") without polluting or depending on host workspace state.
   - **Alternative (No Test Change)**: If test files cannot be modified, `resolveSpecDir` would have to distinguish whether `.spec` was explicitly requested vs whether `.spec` contains `vault-3d`. However, forcing `loadSDDGraph('.spec')` in the project root to ignore `.spec/` and return `inscricao-turma` would violate Requirement R3 ("Integrar o Cofre 3D ao repositório carregando e mapeando as especificações existentes na pasta `.spec/`"). Thus, test isolation is the only sound architectural choice.

---

## 4. Conclusion & Actionable Fix Strategy

### 4.1 Proposed Fix for `src/vault/core/sdd-adapter.js`

Replace lines 41–88 with the following robust, contract-compliant implementation:

```javascript
/**
 * Resolves the absolute path of the specification directory with intelligent fallbacks.
 *
 * Contract:
 * - If an explicit specDir is provided:
 *   1. Check if explicit path exists (under projectRoot or absolute). If found, return it.
 *   2. If not found, do NOT fall back to workspace root '.spec'.
 *   3. If fallbackToExamples is true, search example directories.
 *   4. If fallbackToExamples is false, return null.
 * - If NO explicit specDir is provided (undefined, null, or empty string):
 *   1. Check default location: projectRoot/.spec (and cwd/.spec ONLY if projectRoot was not explicitly specified).
 *   2. If not found and fallbackToExamples is true, search example directories.
 *   3. If not found, return null.
 *
 * @param {string} [specDir] - Target spec path (e.g. '.spec', 'examples/inscricao-turma/.spec')
 * @param {Object} [options={}]
 * @param {string} [options.projectRoot] - Base directory for relative resolution
 * @param {boolean} [options.fallbackToExamples=true] - Search examples if specDir missing
 * @returns {string|null} Resolved absolute path or null if not found
 */
export function resolveSpecDir(specDir, options = {}) {
  const hasExplicitProjectRoot = Boolean(options.projectRoot);
  const projectRoot = options.projectRoot || process.cwd();
  const fallbackToExamples = options.fallbackToExamples !== false;

  const isDirectory = (p) => {
    if (!p) return false;
    try {
      return existsSync(p) && statSync(p).isDirectory();
    } catch {
      return false;
    }
  };

  const resolveExamples = () => {
    if (!fallbackToExamples) return null;

    const exampleCandidates = [
      path.resolve(projectRoot, 'examples', 'inscricao-turma', '.spec')
    ];
    if (!hasExplicitProjectRoot && projectRoot !== process.cwd()) {
      exampleCandidates.push(path.resolve(process.cwd(), 'examples', 'inscricao-turma', '.spec'));
    }
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const repoRoot = path.resolve(currentDir, '..', '..', '..');
      exampleCandidates.push(path.resolve(repoRoot, 'examples', 'inscricao-turma', '.spec'));
    } catch {
      // Ignore URL resolution errors
    }

    for (const c of exampleCandidates) {
      if (isDirectory(c)) return c;
    }
    return null;
  };

  // Branch 1: Explicit specDir provided by caller
  if (specDir && typeof specDir === 'string' && specDir.trim() !== '') {
    const raw = specDir.trim();
    const explicitCandidates = [];

    if (path.isAbsolute(raw)) {
      explicitCandidates.push(raw);
    } else {
      explicitCandidates.push(path.resolve(projectRoot, raw));
      if (!hasExplicitProjectRoot && projectRoot !== process.cwd()) {
        explicitCandidates.push(path.resolve(process.cwd(), raw));
      }
    }

    for (const c of explicitCandidates) {
      if (isDirectory(c)) return c;
    }

    // Explicit path does not exist on disk.
    // Never fall back to workspace root .spec when an explicit path was requested.
    return resolveExamples();
  }

  // Branch 2: Default resolution (specDir is omitted/null/undefined/empty)
  const defaultCandidates = [path.resolve(projectRoot, '.spec')];
  if (!hasExplicitProjectRoot && projectRoot !== process.cwd()) {
    defaultCandidates.push(path.resolve(process.cwd(), '.spec'));
  }

  for (const c of defaultCandidates) {
    if (isDirectory(c)) return c;
  }

  return resolveExamples();
}
```

### 4.2 Proposed Fix for `test/vault/sdd-adapter.test.js` (line 248)

In `test/vault/sdd-adapter.test.js`, isolate test 248 so that it accurately tests the fallback behavior in an environment where `.spec` does not exist:

```javascript
<<<<
    it('gracefully falls back to examples when specDir is not provided or relative .spec is requested', () => {
      const graph = loadSDDGraph('.spec');
      assert.ok(graph);
      assert.equal(graph.stats.featureCount, 1);
      assert.equal(graph.stats.storyCount, 2);
    });
====
    it('gracefully falls back to examples when specDir is not provided or relative .spec is requested', () => {
      // Isolate projectRoot to a directory without .spec to verify fallback behavior
      const isolatedRoot = path.join(process.cwd(), 'examples', 'empty-project-root-fixture');
      const graph = loadSDDGraph('.spec', { projectRoot: isolatedRoot });
      assert.ok(graph);
      assert.equal(graph.stats.featureCount, 1);
      assert.equal(graph.stats.storyCount, 2);
    });
>>>>
```

### 4.3 Proposed Synchronizer Run
After applying edits to `src/vault/core/sdd-adapter.js`:
```powershell
node tools/build-skill.mjs
```

---

## 5. Verification Method

To independently verify that this remediation completely resolves all failures:

1. **Verify Current Baseline (Expected 5 Failures)**:
   ```powershell
   node --test "test/vault/**/*.test.js"
   ```
   *Confirmed: 158 passed, 5 failed.*

2. **Verify Targeted sdd-adapter Unit Tests**:
   ```powershell
   node --test test/vault/sdd-adapter.test.js
   ```
   *Failing lines: 248, 255, 270, 281.*

3. **Verify Targeted Phase 2 Adversarial Hardening Suite**:
   ```powershell
   node --test test/vault/phase2-adversarial-hardening.test.js
   ```
   *Failing line: 306.*

4. **Post-Fix Verification Command**:
   ```powershell
   node --test "test/vault/**/*.test.js"
   ```
   *Expected Post-Fix Result: 163 tests, 41 suites, 163 passed, 0 failed, exit code 0.*

5. **Post-Fix Skill Parity Verification Command**:
   ```powershell
   node --test test/skill-sync.test.js
   ```
   *Expected Result: 21 tests, 21 passed, 0 failed.*

6. **Invalidation Condition**:
   This report is invalidated if `resolveSpecDir` continues to return host `process.cwd()/.spec` when an explicit missing directory path is supplied with `fallbackToExamples: false`.
