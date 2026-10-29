/**
 * @file test/vault/server.test.js
 * @description Integration and unit test suite for the 3D Vault HTTP Server.
 * Verifies server lifecycle, static asset serving, MIME types, security guards,
 * /api/graph, /api/scenarios, /api/health, and synthetic scenario query resolution.
 * Native node:test runner. Node.js >= 18.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable, Writable } from 'node:stream';

import {
  startVaultServer,
  createServerInstance,
  handleVaultRequest,
  MIME_TYPES
} from '../../src/vault/server.js';
import { cmdVault, run } from '../../src/cli.js';

/**
 * In-memory HTTP dispatch helper.
 * Strictly executes the actual HTTP request handler without opening network sockets,
 * guaranteeing 100% reliable offline testing across sandboxed environments.
 */
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const reqStream = new Readable({
        read() {
          this.push(null);
        }
      });

      reqStream.method = options.method || 'GET';
      reqStream.url = path;
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

      handleVaultRequest(reqStream, resStream);
    } catch (err) {
      reject(err);
    }
  });
}

describe('3D Vault Server (F9 & Interface Contracts)', () => {
  describe('Server Lifecycle & Factory Contracts', () => {
    it('createServerInstance returns an unstarted http.Server instance', () => {
      const server = createServerInstance();
      assert.ok(server instanceof http.Server);
    });

    it('startVaultServer starts listening, returns url and port, and closes cleanly', async () => {
      const instance = await startVaultServer({
        port: 0,
        host: '127.0.0.1',
        quiet: true,
        open: false
      });
      assert.ok(typeof instance.url === 'string');
      assert.ok(instance.port > 0);
      assert.strictEqual(instance.host, '127.0.0.1');
      assert.strictEqual(typeof instance.close, 'function');
      await instance.close();
    });

    it('MIME_TYPES dictionary contains standard web extensions', () => {
      assert.strictEqual(MIME_TYPES['.html'], 'text/html; charset=utf-8');
      assert.strictEqual(MIME_TYPES['.js'], 'text/javascript; charset=utf-8');
      assert.strictEqual(MIME_TYPES['.css'], 'text/css; charset=utf-8');
      assert.strictEqual(MIME_TYPES['.json'], 'application/json; charset=utf-8');
    });
  });

  describe('Health Endpoint (/api/health)', () => {
    it('returns 200 with status ok and uptime', async () => {
      const res = await request('/api/health');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /application\/json/);

      const json = res.json();
      assert.strictEqual(json.status, 'ok');
      assert.strictEqual(typeof json.uptime, 'number');
      assert.ok(json.timestamp);
    });
  });

  describe('Scenarios Endpoint (/api/scenarios)', () => {
    it('returns list of available scenarios including live_sdd and 5 synthetics', async () => {
      const res = await request('/api/scenarios');
      assert.strictEqual(res.statusCode, 200);

      const scenarios = res.json();
      assert.ok(Array.isArray(scenarios));
      assert.ok(scenarios.length >= 6);

      const ids = scenarios.map((s) => s.id);
      assert.ok(ids.includes('live_sdd'));
      assert.ok(ids.includes('clean_dag'));
      assert.ok(ids.includes('simple_cycle'));
      assert.ok(ids.includes('multi_cycle_figure8'));
      assert.ok(ids.includes('disjoint_hybrid'));
      assert.ok(ids.includes('adversarial_drift'));

      for (const sc of scenarios) {
        assert.ok(sc.id);
        assert.ok(sc.name);
        assert.ok(sc.description);
      }
    });
  });

  describe('Graph API Endpoint (/api/graph)', () => {
    it('returns live SDD repository graph data by default', async () => {
      const res = await request('/api/graph');
      assert.strictEqual(res.statusCode, 200);

      const graph = res.json();
      assert.ok(Array.isArray(graph.nodes));
      assert.ok(Array.isArray(graph.edges));
      assert.ok(graph.metadata);
      assert.ok(graph.stats);
      assert.ok(graph.nodes.length > 0);
    });

    it('returns Scenario 1: clean_dag without cycles', async () => {
      const res = await request('/api/graph?scenario=clean_dag');
      assert.strictEqual(res.statusCode, 200);

      const graph = res.json();
      assert.strictEqual(graph.metadata.scenario, 'clean_dag');
      assert.strictEqual(graph.stats.hasCycles, false);
      assert.strictEqual(graph.stats.cycleCount, 0);

      // Verify node types and properties
      const nodeIds = graph.nodes.map((n) => n.id);
      assert.ok(nodeIds.includes('FEAT:auth'));
      assert.ok(nodeIds.includes('US-001'));
      assert.ok(nodeIds.includes('AC-001'));
      assert.ok(nodeIds.includes('T-001'));

      // All edges in clean_dag must have valid status
      for (const e of graph.edges) {
        assert.strictEqual(e.status, 'valid');
      }
    });

    it('returns Scenario 2: simple_cycle with circular dependency detected and flagged', async () => {
      const res = await request('/api/graph?scenario=simple_cycle');
      assert.strictEqual(res.statusCode, 200);

      const graph = res.json();
      assert.strictEqual(graph.metadata.scenario, 'simple_cycle');
      assert.strictEqual(graph.stats.hasCycles, true);
      assert.strictEqual(graph.stats.cycleCount, 1);

      // Verify cyclic nodes and vibrating edges
      const cyclicEdges = graph.edges.filter((e) => e.status === 'circular');
      assert.ok(cyclicEdges.length >= 3, 'Triangle cycle must flag at least 3 cyclic edges');

      const cyclicNodes = graph.nodes.filter((n) => n.status === 'circular');
      assert.ok(cyclicNodes.length >= 3, 'Must flag cyclic nodes in A->B->C->A');
    });

    it('returns Scenario 3: multi_cycle_figure8 with intersecting cycles', async () => {
      const res = await request('/api/graph?scenario=multi_cycle_figure8');
      assert.strictEqual(res.statusCode, 200);

      const graph = res.json();
      assert.strictEqual(graph.stats.hasCycles, true);
      assert.ok(graph.stats.cycleCount >= 2);
    });

    it('returns Scenario 4: disjoint_hybrid with valid DAG and cyclic component', async () => {
      const res = await request('/api/graph?scenario=disjoint_hybrid');
      assert.strictEqual(res.statusCode, 200);

      const graph = res.json();
      assert.strictEqual(graph.stats.hasCycles, true);

      // Verify that valid component nodes remain status valid
      const validNodes = graph.nodes.filter((n) => n.status === 'valid');
      const cyclicNodes = graph.nodes.filter((n) => n.status === 'circular');
      assert.ok(validNodes.length > 0);
      assert.ok(cyclicNodes.length > 0);
    });

    it('returns Scenario 5: adversarial_drift with cycle and orphan/broken elements', async () => {
      const res = await request('/api/graph?scenario=adversarial_drift');
      assert.strictEqual(res.statusCode, 200);

      const graph = res.json();
      assert.strictEqual(graph.stats.hasCycles, true);
      assert.ok(graph.stats.orphanCount >= 1 || graph.stats.brokenEdgeCount >= 1);
    });

    it('returns 400 Bad Request on unknown scenario name', async () => {
      const res = await request('/api/graph?scenario=non_existent_scenario_xyz');
      assert.strictEqual(res.statusCode, 400);

      const json = res.json();
      assert.match(json.error, /Failed to load synthetic scenario/);
      assert.ok(Array.isArray(json.availableScenarios));
    });
  });

  describe('Static Asset Serving & Correct MIME Types', () => {
    it('serves root / as index.html with text/html', async () => {
      const res = await request('/');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/html/);
      assert.match(res.body, /<title>Cofre 3D de Documentação & Diagramas/);
      assert.match(res.body, /id="vault-canvas"/);
    });

    it('serves /index.html with text/html', async () => {
      const res = await request('/index.html');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/html/);
    });

    it('serves /style.css with text/css', async () => {
      const res = await request('/style.css');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/css/);
      assert.match(res.body, /--accent-cyan/);
    });

    it('serves /app.js with text/javascript', async () => {
      const res = await request('/app.js');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/javascript/);
      assert.match(res.body, /class VaultApp/);
    });

    it('serves /vault-3d.js with text/javascript', async () => {
      const res = await request('/vault-3d.js');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/javascript/);
      assert.match(res.body, /class Vault3D/);
    });

    it('serves vendored offline Three.js ESM (/vendor/three.module.js)', async () => {
      const res = await request('/vendor/three.module.js');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/javascript/);
      assert.match(res.body, /export class WebGLRenderer/);
      assert.match(res.body, /export class Scene/);
    });

    it('serves vendored offline OrbitControls ESM (/vendor/OrbitControls.js)', async () => {
      const res = await request('/vendor/OrbitControls.js');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/javascript/);
      assert.match(res.body, /export class OrbitControls/);
    });

    it('serves core math module (/math/vector3.js)', async () => {
      const res = await request('/math/vector3.js');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/javascript/);
      assert.match(res.body, /export class Vector3/);
    });

    it('serves core physics module (/physics/edge-vibrator.js)', async () => {
      const res = await request('/physics/edge-vibrator.js');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/javascript/);
      assert.match(res.body, /export function generateVibratingEdgePolyline/);
    });

    it('serves core physics spring-damper (/physics/spring-damper.js)', async () => {
      const res = await request('/physics/spring-damper.js');
      assert.strictEqual(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/javascript/);
      assert.match(res.body, /export class SpringSimulation/);
    });
  });

  describe('Security & Error Handling', () => {
    it('returns 404 for non-existent files', async () => {
      const res = await request('/non-existent-file-404.js');
      assert.strictEqual(res.statusCode, 404);
      const json = res.json();
      assert.strictEqual(json.error, 'File Not Found');
    });

    it('blocks directory traversal attacks (/../../../package.json)', async () => {
      const res = await request('/../../../package.json');
      assert.ok([403, 404].includes(res.statusCode));
    });

    it('blocks null byte injection attacks', async () => {
      const res = await request('/index.html%00.png');
      assert.ok([400, 403, 404].includes(res.statusCode));
    });

    it('returns 405 Method Not Allowed on POST requests', async () => {
      const res = await request('/api/health', { method: 'POST' });
      assert.strictEqual(res.statusCode, 405);
    });

    it('handles OPTIONS preflight request with 204 and CORS headers', async () => {
      const res = await request('/api/graph', { method: 'OPTIONS' });
      assert.strictEqual(res.statusCode, 204);
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
    });
  });

  describe('CLI Integration (onp-spec vault)', () => {
    it('cmdVault launches server in test mode and returns instance', async () => {
      const instance = await cmdVault({ port: 0, test: true, 'no-wait': true });
      assert.ok(instance);
      assert.ok(instance.port > 0);
      assert.ok(typeof instance.close === 'function');
      await instance.close();
    });

    it('CLI run dispatcher recognizes vault command with --test', async () => {
      const instance = await run(['vault', '--port', '0', '--test']);
      assert.ok(instance);
      assert.ok(instance.port > 0);
      await instance.close();
    });
  });
});
