/**
 * @file test/remediation-challenger-deep.test.mjs
 * @description Deep Adversarial Edge Case Probing for resolveSpecDir and loadSDDGraph.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveSpecDir, loadSDDGraph } from '../src/vault/core/sdd-adapter.js';

describe('Adversarial Boundary & Type Abuse', () => {
  it('handles null, undefined, empty string, and whitespace specDir safely', () => {
    const inputs = [undefined, null, '', '   ', '\t\n'];
    for (const input of inputs) {
      const resolved = resolveSpecDir(input);
      // In current workspace, should find .spec
      assert.ok(resolved, `Should resolve default for input: ${JSON.stringify(input)}`);
      assert.ok(resolved.endsWith('.spec'));

      const graph = loadSDDGraph(input);
      assert.ok(graph);
      assert.equal(graph.metadata.source, 'sdd_specs');
    }
  });

  it('handles non-string types safely without throwing TypeError', () => {
    const weirdInputs = [123, true, false, {}, [], () => {}];
    for (const input of weirdInputs) {
      // Should fall back to default workspace cascade instead of crashing
      const resolved = resolveSpecDir(input);
      assert.ok(resolved, `Non-string input ${typeof input} should safely trigger default cascade`);
    }
  });

  it('rejects files when pointed to a file instead of a directory', () => {
    // resolveSpecDir should return null or fall back if target is a file, NOT a directory
    const filePath = 'package.json';
    const resolved = resolveSpecDir(filePath, { fallbackToExamples: false });
    assert.strictEqual(resolved, null, 'File should not be accepted as spec directory');

    // With synthetic fallback
    const graph = loadSDDGraph(filePath, {
      fallbackToExamples: false,
      fallbackToSynthetic: true
    });
    assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
  });

  it('gracefully handles missing examples when projectRoot is entirely isolated from repo', () => {
    const isolatedTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'isolated-no-examples-'));
    try {
      // In an isolated environment without .spec and without repo examples in projectRoot:
      // Note: resolveExamplesDir also checks repoRoot if import.meta.url is available.
      // But if we disable fallbackToExamples:
      const resolved = resolveSpecDir(undefined, {
        projectRoot: isolatedTemp,
        fallbackToExamples: false
      });
      assert.strictEqual(resolved, null, 'Should return null when no workspace .spec and fallbackToExamples is false');

      // loadSDDGraph with fallbackToSynthetic: false should throw
      assert.throws(
        () => loadSDDGraph(undefined, {
          projectRoot: isolatedTemp,
          fallbackToExamples: false,
          fallbackToSynthetic: false
        }),
        /Specification directory not found/
      );

      // loadSDDGraph with fallbackToSynthetic: true should return synthetic
      const graph = loadSDDGraph(undefined, {
        projectRoot: isolatedTemp,
        fallbackToExamples: false,
        fallbackToSynthetic: true
      });
      assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
    } finally {
      fs.rmSync(isolatedTemp, { recursive: true, force: true });
    }
  });

  it('handles non-existent directory traversal attempts safely by returning null', () => {
    const nonExistentTraversalPaths = [
      '../../../../../../../../definitely_non_existent_folder_xyz_9999',
      '../../../non_existent_dir_abc',
      '..\\..\\..\\non_existent_dir_def'
    ];
    for (const badPath of nonExistentTraversalPaths) {
      const resolved = resolveSpecDir(badPath, { fallbackToExamples: false });
      assert.strictEqual(resolved, null, `Non-existent traversal path ${badPath} must return null`);
    }
  });

  it('handles empty spec directory without features gracefully', () => {
    const emptySpecDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-spec-dir-'));
    try {
      const graph = loadSDDGraph(emptySpecDir, {
        fallbackToExamples: false,
        fallbackToSynthetic: true,
        runAudit: false
      });
      assert.ok(graph);
      assert.equal(graph.metadata.source, 'sdd_specs');
      assert.equal(graph.nodes.length, 0);
      assert.equal(graph.edges.length, 0);
    } finally {
      fs.rmSync(emptySpecDir, { recursive: true, force: true });
    }
  });

  it('handles spec directory with corrupt markdown files gracefully without crashing', () => {
    const corruptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corrupt-spec-dir-'));
    try {
      const featDir = path.join(corruptDir, 'features', 'corrupt-feat');
      fs.mkdirSync(featDir, { recursive: true });
      fs.writeFileSync(path.join(featDir, 'spec.md'), '### Not a valid spec header\nrandom garbage ::: \0');
      fs.writeFileSync(path.join(featDir, 'tasks.md'), 'Random text without tasks');
      fs.writeFileSync(path.join(corruptDir, 'constituicao.md'), 'Broken constitution content');

      const graph = loadSDDGraph(corruptDir, {
        fallbackToExamples: false,
        fallbackToSynthetic: false,
        runAudit: false
      });

      assert.ok(graph);
      assert.equal(graph.metadata.source, 'sdd_specs');
    } finally {
      fs.rmSync(corruptDir, { recursive: true, force: true });
    }
  });
});
