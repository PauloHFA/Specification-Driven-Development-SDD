/**
 * @file test/stress-adversarial-sdd.mjs
 * @description Empirical Challenger stress test harness for SDD Adapter path resolution
 * and error handling logic.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  resolveSpecDir,
  loadSDDGraph
} from '../src/vault/core/sdd-adapter.js';

let passedCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    passedCount++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('=== SDD ADAPTER EMPIRICAL ADVERSARIAL STRESS HARNESS ===\n');

// -------------------------------------------------------------
// Fixture setup: Create isolated temp projects
// -------------------------------------------------------------
const emptyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-empty-'));
const projectWithSpecDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-with-spec-'));
const dummySpecDir = path.join(projectWithSpecDir, '.spec');
fs.mkdirSync(dummySpecDir, { recursive: true });

// Also create a dummy file to test file-as-specDir
const dummyFile = path.join(emptyTempDir, 'not-a-dir.txt');
fs.writeFileSync(dummyFile, 'hello', 'utf-8');

try {
  console.log('--- Suite 1: resolveSpecDir - Custom Non-Existent Paths ---');

  test('1.1: Relative custom non-existent dir with fallbackToExamples: false returns null', () => {
    const result = resolveSpecDir('non_existent_custom_dir_123', {
      projectRoot: emptyTempDir,
      fallbackToExamples: false
    });
    assert.strictEqual(result, null);
  });

  test('1.2: Relative custom non-existent dir with fallbackToExamples: true returns null (does not fall back to examples)', () => {
    const result = resolveSpecDir('non_existent_custom_dir_123', {
      projectRoot: emptyTempDir,
      fallbackToExamples: true
    });
    assert.strictEqual(result, null);
  });

  test('1.3: Absolute non-existent dir with fallbackToExamples: false returns null', () => {
    const fakeAbs = path.resolve(emptyTempDir, 'abs_missing_456');
    const result = resolveSpecDir(fakeAbs, {
      projectRoot: emptyTempDir,
      fallbackToExamples: false
    });
    assert.strictEqual(result, null);
  });

  test('1.4: Absolute non-existent dir with fallbackToExamples: true returns null', () => {
    const fakeAbs = path.resolve(emptyTempDir, 'abs_missing_456');
    const result = resolveSpecDir(fakeAbs, {
      projectRoot: emptyTempDir,
      fallbackToExamples: true
    });
    assert.strictEqual(result, null);
  });

  test('1.5: File path passed as specDir returns null', () => {
    const result = resolveSpecDir(dummyFile, {
      projectRoot: emptyTempDir,
      fallbackToExamples: true
    });
    assert.strictEqual(result, null);
  });

  console.log('\n--- Suite 2: resolveSpecDir - Ambient process.cwd() Isolation vs projectRoot ---');

  test('2.1: emptyTempDir projectRoot isolates from host repo .spec when specDir is undefined and fallbackToExamples: false', () => {
    const result = resolveSpecDir(undefined, {
      projectRoot: emptyTempDir,
      fallbackToExamples: false
    });
    assert.strictEqual(result, null, 'Must NOT resolve to host process.cwd()/.spec');
  });

  test('2.2: emptyTempDir projectRoot isolates from host repo .spec when specDir is ".spec" and fallbackToExamples: false', () => {
    const result = resolveSpecDir('.spec', {
      projectRoot: emptyTempDir,
      fallbackToExamples: false
    });
    assert.strictEqual(result, null, 'Must NOT resolve to host process.cwd()/.spec');
  });

  test('2.3: emptyTempDir projectRoot isolates from host repo .spec when specDir is "./.spec" and fallbackToExamples: false', () => {
    const result = resolveSpecDir('./.spec', {
      projectRoot: emptyTempDir,
      fallbackToExamples: false
    });
    assert.strictEqual(result, null);
  });

  test('2.4: emptyTempDir projectRoot resolves to examples when specDir is undefined and fallbackToExamples: true', () => {
    const result = resolveSpecDir(undefined, {
      projectRoot: emptyTempDir,
      fallbackToExamples: true
    });
    assert.ok(result, 'Expected examples path');
    assert.ok(result.includes('examples'), `Expected examples in path: ${result}`);
  });

  test('2.5: emptyTempDir projectRoot resolves to examples when specDir is ".spec" and fallbackToExamples: true', () => {
    const result = resolveSpecDir('.spec', {
      projectRoot: emptyTempDir,
      fallbackToExamples: true
    });
    assert.ok(result, 'Expected examples path');
    assert.ok(result.includes('examples'), `Expected examples in path: ${result}`);
  });

  console.log('\n--- Suite 3: resolveSpecDir - Behavior when projectRoot has a .spec directory ---');

  test('3.1: Resolves to projectRoot/.spec when specDir is undefined', () => {
    const result = resolveSpecDir(undefined, {
      projectRoot: projectWithSpecDir
    });
    assert.strictEqual(result, dummySpecDir);
  });

  test('3.2: Resolves to projectRoot/.spec when specDir is ".spec"', () => {
    const result = resolveSpecDir('.spec', {
      projectRoot: projectWithSpecDir
    });
    assert.strictEqual(result, dummySpecDir);
  });

  test('3.3: Returns null for non-existent subfolder even though projectRoot/.spec exists', () => {
    const result = resolveSpecDir('missing_folder', {
      projectRoot: projectWithSpecDir,
      fallbackToExamples: true
    });
    assert.strictEqual(result, null, 'Must not accidentally return dummySpecDir');
  });

  test('3.4: Returns null for non-existent subfolder with fallbackToExamples: false', () => {
    const result = resolveSpecDir('missing_folder', {
      projectRoot: projectWithSpecDir,
      fallbackToExamples: false
    });
    assert.strictEqual(result, null);
  });

  console.log('\n--- Suite 4: resolveSpecDir - Edge Cases & Unusual Inputs ---');

  test('4.1: Empty string "" behaves like undefined (checks projectRoot/.spec or examples)', () => {
    const resEmpty = resolveSpecDir('', { projectRoot: emptyTempDir, fallbackToExamples: false });
    assert.strictEqual(resEmpty, null);

    const resWithSpec = resolveSpecDir('', { projectRoot: projectWithSpecDir });
    assert.strictEqual(resWithSpec, dummySpecDir);
  });

  test('4.2: Whitespace-only string "   " behaves like undefined', () => {
    const resWs = resolveSpecDir('   \t\n', { projectRoot: emptyTempDir, fallbackToExamples: false });
    assert.strictEqual(resWs, null);

    const resWithSpec = resolveSpecDir('   ', { projectRoot: projectWithSpecDir });
    assert.strictEqual(resWithSpec, dummySpecDir);
  });

  test('4.3: Non-string inputs (null, number, object, boolean) fall into default cascade safely without throw', () => {
    assert.strictEqual(resolveSpecDir(null, { projectRoot: emptyTempDir, fallbackToExamples: false }), null);
    assert.strictEqual(resolveSpecDir(12345, { projectRoot: emptyTempDir, fallbackToExamples: false }), null);
    assert.strictEqual(resolveSpecDir({}, { projectRoot: emptyTempDir, fallbackToExamples: false }), null);
    assert.strictEqual(resolveSpecDir(true, { projectRoot: emptyTempDir, fallbackToExamples: false }), null);
  });

  console.log('\n--- Suite 5: loadSDDGraph Permutations & Fallbacks ---');

  test('5.1: Non-existent specDir + fallbackToExamples: false + fallbackToSynthetic: false -> THROWS', () => {
    assert.throws(
      () => loadSDDGraph('missing_dir_xyz', {
        projectRoot: emptyTempDir,
        fallbackToExamples: false,
        fallbackToSynthetic: false
      }),
      /Specification directory not found/
    );
  });

  test('5.2: Non-existent specDir + fallbackToExamples: false + fallbackToSynthetic: true -> SYNTHETIC_FALLBACK', () => {
    const graph = loadSDDGraph('missing_dir_xyz', {
      projectRoot: emptyTempDir,
      fallbackToExamples: false,
      fallbackToSynthetic: true
    });
    assert.ok(graph);
    assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
    assert.strictEqual(graph.metadata.scenario, 'clean_dag');
  });

  test('5.3: Custom non-existent specDir + fallbackToExamples: true + fallbackToSynthetic: false -> THROWS', () => {
    // Custom missing dir should not fall back to examples, and synthetic is false -> must throw
    assert.throws(
      () => loadSDDGraph('missing_dir_xyz', {
        projectRoot: emptyTempDir,
        fallbackToExamples: true,
        fallbackToSynthetic: false
      }),
      /Specification directory not found/
    );
  });

  test('5.4: Custom non-existent specDir + fallbackToExamples: true + fallbackToSynthetic: true -> SYNTHETIC_FALLBACK', () => {
    const graph = loadSDDGraph('missing_dir_xyz', {
      projectRoot: emptyTempDir,
      fallbackToExamples: true,
      fallbackToSynthetic: true
    });
    assert.ok(graph);
    assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
  });

  test('5.5: Relative ".spec" on empty projectRoot + fallbackToExamples: true + fallbackToSynthetic: false -> LOADS EXAMPLES (sdd_specs)', () => {
    const graph = loadSDDGraph('.spec', {
      projectRoot: emptyTempDir,
      fallbackToExamples: true,
      fallbackToSynthetic: false
    });
    assert.ok(graph);
    assert.strictEqual(graph.metadata.source, 'sdd_specs');
    assert.strictEqual(graph.stats.storyCount, 2);
  });

  test('5.6: Relative ".spec" on empty projectRoot + fallbackToExamples: false + fallbackToSynthetic: false -> THROWS', () => {
    assert.throws(
      () => loadSDDGraph('.spec', {
        projectRoot: emptyTempDir,
        fallbackToExamples: false,
        fallbackToSynthetic: false
      }),
      /Specification directory not found/
    );
  });

  test('5.7: Relative ".spec" on empty projectRoot + fallbackToExamples: false + fallbackToSynthetic: true -> SYNTHETIC_FALLBACK', () => {
    const graph = loadSDDGraph('.spec', {
      projectRoot: emptyTempDir,
      fallbackToExamples: false,
      fallbackToSynthetic: true
    });
    assert.ok(graph);
    assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
  });

  test('5.8: Undefined specDir on empty projectRoot + fallbackToExamples: false + fallbackToSynthetic: false -> THROWS', () => {
    assert.throws(
      () => loadSDDGraph(undefined, {
        projectRoot: emptyTempDir,
        fallbackToExamples: false,
        fallbackToSynthetic: false
      }),
      /Specification directory not found/
    );
  });

  test('5.9: Undefined specDir on empty projectRoot + fallbackToExamples: true + fallbackToSynthetic: false -> LOADS EXAMPLES', () => {
    const graph = loadSDDGraph(undefined, {
      projectRoot: emptyTempDir,
      fallbackToExamples: true,
      fallbackToSynthetic: false
    });
    assert.ok(graph);
    assert.strictEqual(graph.metadata.source, 'sdd_specs');
    assert.strictEqual(graph.stats.storyCount, 2);
  });

  console.log('\n--- Suite 6: loadSDDGraph Synthetic Scenario Selections ---');

  test('6.1: syntheticScenario "simple_cycle" activates circular flags and detected cycle', () => {
    const graph = loadSDDGraph('missing', {
      projectRoot: emptyTempDir,
      fallbackToSynthetic: true,
      syntheticScenario: 'simple_cycle'
    });
    assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
    assert.strictEqual(graph.metadata.scenario, 'simple_cycle');
    assert.strictEqual(graph.stats.hasCycles, true);
    assert.ok(graph.stats.cycleCount >= 1);
  });

  test('6.2: syntheticScenario "multi_cycle_figure8" accurately reflects multi-cycle state', () => {
    const graph = loadSDDGraph('missing', {
      projectRoot: emptyTempDir,
      fallbackToSynthetic: true,
      syntheticScenario: 'multi_cycle_figure8'
    });
    assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
    assert.strictEqual(graph.metadata.scenario, 'multi_cycle_figure8');
    assert.strictEqual(graph.stats.hasCycles, true);
    assert.ok(graph.stats.cycleCount >= 2);
  });

  test('6.3: syntheticScenario "adversarial_drift" includes orphans and broken edges', () => {
    const graph = loadSDDGraph('missing', {
      projectRoot: emptyTempDir,
      fallbackToSynthetic: true,
      syntheticScenario: 'adversarial_drift'
    });
    assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
    assert.strictEqual(graph.metadata.scenario, 'adversarial_drift');
    assert.ok(graph.stats.orphanCount >= 1);
    assert.ok(graph.stats.brokenEdgeCount >= 1);
  });

  console.log('\n--- Suite 7: Host Environment State With Real Workspace .spec ---');

  test('7.1: Explicit missing path in current host repo (which has root .spec) strictly returns null in resolveSpecDir', () => {
    // Current cwd() has .spec
    const res = resolveSpecDir('strictly_non_existent_folder_abc', { fallbackToExamples: false });
    assert.strictEqual(res, null, 'Host root .spec must not bleed into custom missing path');

    const resAllowExamples = resolveSpecDir('strictly_non_existent_folder_abc', { fallbackToExamples: true });
    assert.strictEqual(resAllowExamples, null, 'Custom missing path must not fall back to examples even if allowed');
  });

  test('7.2: Explicit missing path in current host repo triggers synthetic fallback when fallbackToSynthetic: true', () => {
    const graph = loadSDDGraph('strictly_non_existent_folder_abc', { fallbackToSynthetic: true });
    assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
  });

  test('7.3: Explicit missing path in current host repo throws when fallbackToSynthetic: false', () => {
    assert.throws(
      () => loadSDDGraph('strictly_non_existent_folder_abc', { fallbackToSynthetic: false }),
      /Specification directory not found: "strictly_non_existent_folder_abc"/
    );
  });

  test('7.4: Undefined specDir in current host repo correctly discovers host .spec', () => {
    const res = resolveSpecDir(undefined);
    assert.ok(res);
    assert.ok(res.endsWith('.spec'));
    assert.ok(fs.existsSync(res));
  });

  console.log(`\n======================================================`);
  console.log(`ALL ${passedCount}/${totalCount} ADVERSARIAL STRESS TESTS PASSED SUCCESSFULLY!`);
  console.log(`======================================================`);
} finally {
  fs.rmSync(emptyTempDir, { recursive: true, force: true });
  fs.rmSync(projectWithSpecDir, { recursive: true, force: true });
}
