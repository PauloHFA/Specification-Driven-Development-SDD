/**
 * @file test/remediation-challenger.test.mjs
 * @description Empirical Challenger 2 Stress Harness for SDD Adapter, Vault Server, and CLI.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';

import { resolveSpecDir, loadSDDGraph } from '../src/vault/core/sdd-adapter.js';
import { handleVaultRequest, startVaultServer } from '../src/vault/server.js';
import { cmdVault, run } from '../src/cli.js';

/**
 * In-memory HTTP request dispatcher for hermetic, socketless testing.
 */
function mockRequest(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const reqStream = new Readable({
        read() {
          this.push(null);
        }
      });

      reqStream.method = options.method || 'GET';
      reqStream.url = urlPath;
      reqStream.headers = { host: '127.0.0.1', ...(options.headers || {}) };

      let statusCode = 200;
      const responseHeaders = {};
      const chunks = [];

      const resStream = new Writable({
        write(chunk, enc, cb) {
          chunks.push(Buffer.from(chunk));
          cb();
        }
      });

      resStream.writeHead = (status, hdrs) => {
        statusCode = status;
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            responseHeaders[k.toLowerCase()] = v;
          }
        }
        return resStream;
      };

      resStream.setHeader = (k, v) => {
        responseHeaders[k.toLowerCase()] = v;
      };
      resStream.getHeader = (k) => responseHeaders[k.toLowerCase()];

      resStream.on('finish', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({
          statusCode,
          headers: responseHeaders,
          body,
          json() {
            return JSON.parse(body);
          }
        });
      });

      handleVaultRequest(reqStream, resStream, options.serverOptions || {});
    } catch (err) {
      reject(err);
    }
  });
}

describe('Empirical Challenger 2: 5 Previously Failing Tests Under Stress', () => {
  it('Stress 1 (Line 248): loadSDDGraph(".spec") fallback in isolated empty root', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-test1-'));
    try {
      // In isolated tempDir without .spec
      const graph = loadSDDGraph('.spec', { projectRoot: tempDir });
      assert.ok(graph, 'Graph should be loaded');
      assert.equal(graph.metadata.source, 'sdd_specs');
      assert.ok(graph.metadata.specDir.includes('examples'), 'Should resolve to reference examples');
      assert.equal(graph.stats.featureCount, 1);
      assert.equal(graph.stats.storyCount, 2);

      // Variations of relative .spec notation
      const graphDotSlash = loadSDDGraph('./.spec', { projectRoot: tempDir });
      assert.ok(graphDotSlash);
      assert.equal(graphDotSlash.stats.featureCount, 1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('Stress 2 (Line 255): loadSDDGraph("non_existent", { fallbackToExamples: false, fallbackToSynthetic: true })', () => {
    const scenarios = ['clean_dag', 'simple_cycle', 'multi_cycle_figure8', 'disjoint_hybrid', 'adversarial_drift'];
    for (const sc of scenarios) {
      const graph = loadSDDGraph('non_existent_folder_xyz', {
        fallbackToExamples: false,
        fallbackToSynthetic: true,
        syntheticScenario: sc
      });
      assert.ok(graph);
      assert.equal(graph.metadata.source, 'synthetic_fallback');
      assert.equal(graph.metadata.scenario, sc);
      assert.ok(graph.nodes.length > 0);
      assert.ok(graph.stats.nodeCount > 0);
    }
  });

  it('Stress 3 (Line 270): loadSDDGraph("non_existent", { fallbackToExamples: false, fallbackToSynthetic: false })', () => {
    const badPaths = [
      'non_existent_folder_xyz',
      'foo/bar/baz',
      'C:\\definitely_not_existing_path_12345',
      './missing/sub/folder'
    ];
    for (const badPath of badPaths) {
      assert.throws(
        () => loadSDDGraph(badPath, {
          fallbackToExamples: false,
          fallbackToSynthetic: false
        }),
        /Specification directory not found/,
        `Should throw for bad path ${badPath}`
      );
    }
  });

  it('Stress 4 (Line 281): resolveSpecDir("missing_dir", { fallbackToExamples: false })', () => {
    const missingCandidates = [
      'missing_dir_12345',
      'invalid/sub/dir',
      'C:\\non_existent_drive_folder',
      '../missing_parent'
    ];
    for (const candidate of missingCandidates) {
      const resolved = resolveSpecDir(candidate, { fallbackToExamples: false });
      assert.strictEqual(resolved, null, `Candidate ${candidate} must resolve to null`);
    }
  });

  it('Stress 5 (Line 306 in phase2 adversarial): non-existent directory in isolated tempDir', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-test5-'));
    try {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');
      const graph = loadSDDGraph(nonExistentDir, {
        projectRoot: tempDir,
        fallbackToExamples: false,
        fallbackToSynthetic: true,
        syntheticScenario: 'clean_dag'
      });

      assert.ok(graph);
      assert.ok(graph.nodes.length > 0);
      assert.strictEqual(graph.metadata.source, 'synthetic_fallback');
      assert.strictEqual(graph.metadata.scenario, 'clean_dag');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Empirical Challenger 2: Server Stability Across Root .spec Presence', () => {
  it('Server behaves reliably in workspace WITH real .spec/', async () => {
    const serverOpts = { projectRoot: process.cwd() };

    // 1. Health check
    const health = await mockRequest('/api/health', { serverOptions: serverOpts });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().status, 'ok');

    // 2. Scenarios list
    const scenarios = await mockRequest('/api/scenarios', { serverOptions: serverOpts });
    assert.equal(scenarios.statusCode, 200);
    const scenList = scenarios.json();
    assert.ok(Array.isArray(scenList));
    assert.ok(scenList.some(s => s.id === 'live_sdd'));

    // 3. Live SDD Graph (loads real .spec with 4 features)
    const liveGraph = await mockRequest('/api/graph', { serverOptions: serverOpts });
    assert.equal(liveGraph.statusCode, 200);
    const liveJson = liveGraph.json();
    assert.equal(liveJson.metadata.source, 'sdd_specs');
    assert.equal(liveJson.stats.featureCount, 1);
    assert.equal(liveJson.stats.storyCount, 4);
    assert.ok(liveJson.nodes.length > 0);

    // 4. Specific synthetic scenario request
    const syntheticGraph = await mockRequest('/api/graph?scenario=simple_cycle', { serverOptions: serverOpts });
    assert.equal(syntheticGraph.statusCode, 200);
    const synthJson = syntheticGraph.json();
    assert.equal(synthJson.metadata.source, 'synthetic');
    assert.equal(synthJson.metadata.scenario, 'simple_cycle');
    assert.equal(synthJson.stats.hasCycles, true);

    // 5. Explicit specDir query param pointing to reference examples
    const exampleGraph = await mockRequest('/api/graph?specDir=examples/inscricao-turma/.spec', { serverOptions: serverOpts });
    assert.equal(exampleGraph.statusCode, 200);
    const exJson = exampleGraph.json();
    assert.equal(exJson.metadata.source, 'sdd_specs');
    assert.equal(exJson.stats.featureCount, 1);

    // 6. Non-existent specDir query param (should gracefully degrade to synthetic clean_dag)
    const missingSpecGraph = await mockRequest('/api/graph?specDir=non_existent_folder_xyz', { serverOptions: serverOpts });
    assert.equal(missingSpecGraph.statusCode, 200);
    const missingJson = missingSpecGraph.json();
    assert.equal(missingJson.metadata.source, 'synthetic_fallback');
    assert.equal(missingJson.metadata.scenario, 'clean_dag');
  });

  it('Server behaves reliably in workspace WITHOUT .spec/ (isolated empty sandbox)', async () => {
    const emptyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-nospec-'));

    try {
      const serverOpts = { projectRoot: emptyTempDir };

      // 1. Health check
      const health = await mockRequest('/api/health', { serverOptions: serverOpts });
      assert.equal(health.statusCode, 200);
      assert.equal(health.json().status, 'ok');

      // 2. Default graph without .spec in root
      // In empty temp root with fallbackToExamples: true, fallbackToSynthetic: true:
      // resolveSpecDir -> resolves examples/inscricao-turma/.spec via fallback
      const graph = await mockRequest('/api/graph', { serverOptions: serverOpts });
      assert.equal(graph.statusCode, 200);
      const graphJson = graph.json();
      assert.ok(
        graphJson.metadata.source === 'sdd_specs' || graphJson.metadata.source === 'synthetic_fallback',
        'Must gracefully resolve to examples or synthetic'
      );

      // 3. Synthetic scenario selection still functions 100%
      const synth = await mockRequest('/api/graph?scenario=multi_cycle_figure8', { serverOptions: serverOpts });
      assert.equal(synth.statusCode, 200);
      assert.equal(synth.json().metadata.scenario, 'multi_cycle_figure8');

      // 4. Explicit non-existent dir degrades to synthetic without 500
      const badReq = await mockRequest('/api/graph?specDir=random_missing_path', { serverOptions: serverOpts });
      assert.equal(badReq.statusCode, 200);
      assert.equal(badReq.json().metadata.source, 'synthetic_fallback');
    } finally {
      fs.rmSync(emptyTempDir, { recursive: true, force: true });
    }
  });
});

describe('Empirical Challenger 2: CLI Invocations (onp-spec vault)', () => {
  it('cmdVault launches and returns running instance with custom and default options', async () => {
    const instance = await cmdVault({ test: true, port: 0 });
    assert.ok(instance);
    assert.ok(instance.url.startsWith('http://127.0.0.1:'));
    await instance.close();
  });

  it('run() dispatches vault command correctly with test flags', async () => {
    const res = await run(['vault', '--test', '--port', '0']);
    assert.ok(res);
    assert.ok(typeof res.close === 'function');
    await res.close();
  });

  it('cmdVault functions properly in an isolated environment without root .spec/', async () => {
    const emptyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-cli-nospec-'));
    const prevCwd = process.cwd();

    try {
      process.chdir(emptyTempDir);
      const instance = await cmdVault({ test: true, port: 0 });
      assert.ok(instance);
      assert.ok(instance.url);
      await instance.close();
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(emptyTempDir, { recursive: true, force: true });
    }
  });
});
