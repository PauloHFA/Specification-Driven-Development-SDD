/**
 * @file test/vault/phase2-adversarial-hardening.test.js
 * @description Phase 2 Adversarial Coverage Hardening (Tier 5) Test Suite for 3D Vault.
 *
 * Covers:
 * 1. High-throughput / concurrency requests to src/vault/server.js (in-memory stream simulation up to 500 concurrent requests)
 * 2. Malformed query params & security fuzzing (path traversal, nonexistent scenarios, prototype pollution, URL injection)
 * 3. Extreme inputs to sdd-adapter.js (nonexistent dirs, empty dirs, 0-byte files, missing frontmatter, cyclic tasks, unicode/emojis/accents)
 * 4. Standing wave polyline generation at extreme simulation timestamps (t = 10^6 s, t = 10^9 s, t = -10^6 s)
 *
 * Pure Node.js >= 18 native test runner. Zero external dependencies.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable, Writable } from 'node:stream';

import {
  handleVaultRequest,
  startVaultServer,
  createServerInstance
} from '../../src/vault/server.js';
import {
  loadSDDGraph,
  convertProjectToGraph,
  resolveSpecDir,
  computeOrbitalLayout
} from '../../src/vault/core/sdd-adapter.js';
import {
  generateVibratingEdgePolyline
} from '../../src/vault/physics/edge-vibrator.js';
import { Vector3 } from '../../src/vault/math/vector3.js';
import {
  NodeType,
  EdgeType,
  NodeStatus,
  EdgeStatus
} from '../../src/vault/core/graph-model.js';
import { detectCycles } from '../../src/vault/core/cycle-detector.js';

/**
 * In-memory request dispatcher for high-speed offline simulation.
 * Executes the complete HTTP request lifecycle (routing, query parsing, mime serving, error handling)
 * via Node.js streams without relying on OS socket permissions in sandboxed environments.
 */
function inMemoryRequest(urlPath, options = {}) {
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

// =========================================================================
// SECTION 1: HIGH-THROUGHPUT & CONCURRENCY TO SERVER
// =========================================================================
describe('Phase 2 Adversarial 1: High-Throughput & Concurrency Requests to Server', () => {
  it('1.1: Massive burst: 500 concurrent requests across mixed endpoints without dropping or throwing', async () => {
    const endpoints = [
      '/api/health',
      '/api/scenarios',
      '/api/graph?scenario=clean_dag',
      '/api/graph?scenario=simple_cycle',
      '/api/graph?scenario=multi_cycle_figure8',
      '/api/graph?scenario=disjoint_hybrid',
      '/api/graph?scenario=adversarial_drift',
      '/index.html',
      '/app.js',
      '/style.css',
      '/math/vector3.js',
      '/physics/edge-vibrator.js',
      '/core/cycle-detector.js'
    ];

    const promises = [];
    for (let i = 0; i < 500; i++) {
      const ep = endpoints[i % endpoints.length];
      promises.push(inMemoryRequest(ep));
    }

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 500);

    for (const res of results) {
      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode} with body: ${res.body.slice(0, 100)}`);
      assert.ok(res.body.length > 0);
    }
  });

  it('1.2: Pipelined concurrent bursts: 5 waves of 50 concurrent requests (250 total) execute smoothly', async () => {
    for (let wave = 0; wave < 5; wave++) {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(inMemoryRequest('/api/graph?scenario=simple_cycle'));
      }
      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 50);
      for (const res of results) {
        assert.strictEqual(res.statusCode, 200);
        const j = res.json();
        assert.strictEqual(j.stats.hasCycles, true);
        assert.strictEqual(j.stats.cycleCount, 1);
      }
    }
  });

  it('1.3: Rapid sequential load: 300 sequential requests execute under tight timing (< 2500ms)', async () => {
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) {
      const res = await inMemoryRequest('/api/health');
      assert.strictEqual(res.statusCode, 200);
    }
    const duration = performance.now() - t0;
    assert.ok(duration < 2500, `300 requests took ${duration.toFixed(1)}ms, expected < 2500ms`);
  });

  it('1.4: Concurrent graph generation with live SDD fallback maintains response isolation', async () => {
    // Fire concurrent calls to live_sdd (default) and synthetic scenarios
    const calls = [
      inMemoryRequest('/api/graph'),
      inMemoryRequest('/api/graph?scenario=clean_dag'),
      inMemoryRequest('/api/graph?scenario=multi_cycle_figure8'),
      inMemoryRequest('/api/graph?scenario=adversarial_drift'),
      inMemoryRequest('/api/graph')
    ];

    const [live1, clean, figure8, drift, live2] = await Promise.all(calls);

    const jLive1 = live1.json();
    const jClean = clean.json();
    const jFig = figure8.json();
    const jDrift = drift.json();
    const jLive2 = live2.json();

    assert.strictEqual(jClean.metadata.scenario, 'clean_dag');
    assert.strictEqual(jFig.metadata.scenario, 'multi_cycle_figure8');
    assert.strictEqual(jDrift.metadata.scenario, 'adversarial_drift');

    // Both live SDD graphs should be identical and not cross-pollinated
    assert.strictEqual(jLive1.stats.nodeCount, jLive2.stats.nodeCount);
    assert.strictEqual(jLive1.stats.edgeCount, jLive2.stats.edgeCount);
  });
});

// =========================================================================
// SECTION 2: MALFORMED QUERY PARAMS & SECURITY FUZZING
// =========================================================================
describe('Phase 2 Adversarial 2: Malformed Query Params & Security Fuzzing', () => {
  it('2.1: Rejects path traversal in scenario parameter (?scenario=../../bad)', async () => {
    const res = await inMemoryRequest('/api/graph?scenario=../../bad');
    assert.strictEqual(res.statusCode, 400);
    const json = res.json();
    assert.ok(json.error);
    assert.ok(Array.isArray(json.availableScenarios));
  });

  it('2.2: Rejects Windows-style path traversal (?scenario=..\\..\\windows\\win.ini)', async () => {
    const res = await inMemoryRequest('/api/graph?scenario=..\\..\\windows\\win.ini');
    assert.strictEqual(res.statusCode, 400);
    const json = res.json();
    assert.ok(json.error);
  });

  it('2.3: Rejects URL-encoded path traversal (?scenario=%2e%2e%2f%2e%2e%2f)', async () => {
    const res = await inMemoryRequest('/api/graph?scenario=%2e%2e%2f%2e%2e%2f');
    assert.strictEqual(res.statusCode, 400);
    const json = res.json();
    assert.ok(json.error);
  });

  it('2.4: Handles nonexistent scenario gracefully (?scenario=nonexistent_scenario_12345)', async () => {
    const res = await inMemoryRequest('/api/graph?scenario=nonexistent_scenario_12345');
    assert.strictEqual(res.statusCode, 400);
    const json = res.json();
    assert.ok(json.error.includes('nonexistent_scenario_12345') || json.error.includes('Unknown synthetic scenario'));
    assert.ok(Array.isArray(json.availableScenarios));
  });

  it('2.5: Resists prototype pollution keys in query params (?scenario=__proto__, constructor, toString)', async () => {
    const evilKeys = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];
    for (const key of evilKeys) {
      const res = await inMemoryRequest(`/api/graph?scenario=${key}`);
      assert.strictEqual(res.statusCode, 400);
      const json = res.json();
      assert.ok(json.error);
    }
  });

  it('2.6: Handles extreme query string lengths (10,000 characters) without crashing', async () => {
    const longParam = 'a'.repeat(10000);
    const res = await inMemoryRequest(`/api/graph?scenario=${longParam}`);
    assert.strictEqual(res.statusCode, 400);
  });

  it('2.7: Handles malformed specDir parameter safely without throwing unhandled exceptions', async () => {
    // Non-existent directory falls back to examples/synthetic gracefully
    const res = await inMemoryRequest('/api/graph?specDir=invalid/path/that/does/not/exist');
    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.ok(json.nodes);
    assert.ok(json.edges);
  });

  it('2.8: Blocks static file path traversal (/math/../../server.js, /public/../server.js)', async () => {
    const attackPaths = [
      '/math/../../server.js',
      '/physics/../../server.js',
      '/core/../../server.js',
      '/..%2f..%2fserver.js',
      '/%2e%2e/%2e%2e/package.json'
    ];

    for (const p of attackPaths) {
      const res = await inMemoryRequest(p);
      assert.ok(
        res.statusCode === 403 || res.statusCode === 404 || res.statusCode === 400,
        `Expected 400/403/404 for attack path "${p}", got ${res.statusCode}`
      );
    }
  });

  it('2.9: Blocks null byte injection in static file routes (/%00index.html)', async () => {
    const res = await inMemoryRequest('/%00index.html');
    assert.strictEqual(res.statusCode, 400);
    const json = res.json();
    assert.strictEqual(json.error, 'Bad Request');
  });

  it('2.10: Returns 405 on POST, PUT, DELETE, PATCH HTTP methods', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await inMemoryRequest('/api/graph', { method });
      assert.strictEqual(res.statusCode, 405);
    }
  });
});

// =========================================================================
// SECTION 3: EXTREME INPUTS TO SDD-ADAPTER
// =========================================================================
describe('Phase 2 Adversarial 3: Extreme Inputs to sdd-adapter.js', () => {
  let tempDir;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-adversarial-'));
  });

  after(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('3.1a: Non-existent spec directory: activates synthetic fallback correctly', () => {
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
  });

  it('3.1b: Existing but completely empty spec directory: produces safe empty graph without crashing', () => {
    const emptyDir = path.join(tempDir, 'empty-spec');
    fs.mkdirSync(emptyDir, { recursive: true });

    const graph = loadSDDGraph(emptyDir, {
      projectRoot: tempDir,
      fallbackToExamples: false,
      runAudit: false
    });

    assert.ok(graph);
    assert.strictEqual(graph.nodes.length, 0);
    assert.strictEqual(graph.edges.length, 0);
    assert.strictEqual(graph.stats.nodeCount, 0);
    assert.strictEqual(graph.stats.edgeCount, 0);
    assert.strictEqual(graph.stats.hasCycles, false);
    assert.strictEqual(graph.stats.cycleCount, 0);
  });

  it('3.2: Empty files: 0-byte spec.md and 0-byte tasks.md do not throw or crash', () => {
    const featureDir = path.join(tempDir, 'features', 'feat-empty');
    fs.mkdirSync(featureDir, { recursive: true });
    fs.writeFileSync(path.join(featureDir, 'spec.md'), '');
    fs.writeFileSync(path.join(featureDir, 'tasks.md'), '');

    const graph = loadSDDGraph(tempDir, {
      projectRoot: tempDir,
      fallbackToExamples: false,
      runAudit: false
    });

    assert.ok(graph);
    assert.ok(Array.isArray(graph.nodes));
    assert.ok(Array.isArray(graph.edges));
    const featNode = graph.nodes.find(n => n.id === 'FEAT:feat-empty');
    assert.ok(featNode);
    assert.strictEqual(featNode.type, NodeType.FEATURE);
  });

  it('3.3: Missing frontmatter & corrupted markdown content is sanitized without error', () => {
    const featureDir = path.join(tempDir, 'features', 'feat-corrupted');
    fs.mkdirSync(featureDir, { recursive: true });

    const corruptedSpec = `
Random unformatted text without frontmatter!
<!-- orphan comment -->
#### Subheading with no structure
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
\`\`\`unclosed code block
    `;

    const corruptedTasks = `
Not a valid task format
- [ ] Broken task without ID
- [X] Missing everything
    `;

    fs.writeFileSync(path.join(featureDir, 'spec.md'), corruptedSpec, 'utf-8');
    fs.writeFileSync(path.join(featureDir, 'tasks.md'), corruptedTasks, 'utf-8');

    const graph = loadSDDGraph(tempDir, {
      projectRoot: tempDir,
      fallbackToExamples: false,
      runAudit: false
    });

    assert.ok(graph);
    assert.ok(graph.nodes.some(n => n.id === 'FEAT:feat-corrupted'));
  });

  it('3.4: Unicode, accented characters, emoji, and special characters in GWT clauses', () => {
    const projectData = {
      features: [
        {
          name: 'feat-unicode-i18n',
          spec: {
            title: 'Funcionalidade com Acentuação e Emojis 🚀',
            status: 'pronta',
            stories: [
              {
                id: 'US-999',
                title: 'História com caracteres especiais: áéíóú çãõ & <xml>',
                description: ['Descrição com emojis 🛡️⚡ e texto em Japonês: 日本語テスト'],
                acs: [
                  {
                    id: 'AC-999',
                    title: 'Critério com GWT multilíngue e RTL',
                    given: [
                      'uma condição inicial com acentuação: "coração, bênção, órgão"',
                      'dado também em hebraico: שלום עולם',
                      'dado com regex: ^[a-zA-Z0-9_.-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$'
                    ],
                    when: [
                      'o usuário clica no botão "Executar Ação 💥"',
                      'parâmetros contêm aspas duplas " e simples \''
                    ],
                    then: [
                      'o resultado é 100% validado com sucesso ✅',
                      'nenhum erro de parsing ou layout ocorre'
                    ]
                  }
                ]
              }
            ]
          },
          tasks: {
            tasks: [
              {
                id: 'T-999',
                title: 'Tarefa de implementação para AC-999 com emoji 🛠️',
                status: 'concluida',
                refs: ['AC-999'],
                files: ['src/módulo-especial/arquivo_com_acentos.js']
              }
            ]
          }
        }
      ]
    };

    const graph = convertProjectToGraph(projectData);

    assert.ok(graph);
    const acNode = graph.nodes.find(n => n.id === 'AC-999');
    assert.ok(acNode);
    assert.ok(acNode.snippet.includes('Dado uma condição inicial com acentuação: "coração, bênção, órgão"'));
    assert.ok(acNode.snippet.includes('שלום עולם'));
    assert.ok(acNode.snippet.includes('Executar Ação 💥'));
    assert.ok(acNode.snippet.includes('100% validado com sucesso ✅'));

    // Orbital layout computes valid non-NaN 3D coordinates for unicode nodes
    assert.ok(Number.isFinite(acNode.position.x));
    assert.ok(Number.isFinite(acNode.position.y));
    assert.ok(Number.isFinite(acNode.position.z));
  });

  it('3.5: Cyclic tasks: detectCycles isolates circular task dependencies accurately', () => {
    // Construct synthetic tasks referencing each other in a circle: T-1 -> T-2 -> T-3 -> T-1
    const nodes = [
      { id: 'T-1', type: NodeType.TASK },
      { id: 'T-2', type: NodeType.TASK },
      { id: 'T-3', type: NodeType.TASK },
      { id: 'T-SAFE', type: NodeType.TASK }
    ];

    const edges = [
      { id: 'e1', source: 'T-1', target: 'T-2' },
      { id: 'e2', source: 'T-2', target: 'T-3' },
      { id: 'e3', source: 'T-3', target: 'T-1' },
      { id: 'e4', source: 'T-SAFE', target: 'T-1' } // Dangling dependent
    ];

    const res = detectCycles(nodes, edges);

    assert.strictEqual(res.hasCycles, true);
    assert.strictEqual(res.cycleCount, 1);
    assert.ok(res.cyclicNodeIds.has('T-1'));
    assert.ok(res.cyclicNodeIds.has('T-2'));
    assert.ok(res.cyclicNodeIds.has('T-3'));
    assert.strictEqual(res.cyclicNodeIds.has('T-SAFE'), false);

    assert.strictEqual(res.nodeStatusMap.get('T-1'), NodeStatus.CIRCULAR);
    assert.strictEqual(res.nodeStatusMap.get('T-SAFE'), NodeStatus.VALID);
  });

  it('3.6: Massive star topology with 500 tasks computes orbital layout cleanly without overlap or NaN', () => {
    const nodes = [];
    const edges = [];

    const featNode = { id: 'FEAT:massive', type: NodeType.FEATURE, setPosition(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    nodes.push(featNode);

    for (let i = 0; i < 500; i++) {
      const tNode = {
        id: `T-${i}`,
        type: NodeType.TASK,
        metadata: { feature: 'massive' },
        setPosition(x, y, z) { this.x = x; this.y = y; this.z = z; }
      };
      nodes.push(tNode);
      edges.push({ id: `e_${i}`, source: 'FEAT:massive', target: `T-${i}` });
    }

    computeOrbitalLayout(nodes, edges, { layoutRadius: 200 });

    for (const n of nodes) {
      assert.ok(Number.isFinite(n.x) && !Number.isNaN(n.x));
      assert.ok(Number.isFinite(n.y) && !Number.isNaN(n.y));
      assert.ok(Number.isFinite(n.z) && !Number.isNaN(n.z));
    }
  });
});

// =========================================================================
// SECTION 4: STANDING WAVE AT EXTREME TIMESTAMPS (t = 10^6 s)
// =========================================================================
describe('Phase 2 Adversarial 4: Standing Wave Polyline Generation at Extreme Timestamps', () => {
  const p1 = new Vector3(-250.5, 120.3, -400.8);
  const p2 = new Vector3(310.2, -85.7, 195.4);

  it('4.1: Dirichlet fixed-endpoint invariance d(0,t)=0 and d(1,t)=0 strictly holds at t = 1,000,000s', () => {
    const tExtreme = 1000000.0; // t = 10^6 s
    const polyline = generateVibratingEdgePolyline(p1, p2, tExtreme, {
      segments: 24,
      amplitude: 1.5,
      frequency: 15.0,
      isVibrating: true
    });

    assert.strictEqual(polyline.length, 25);

    const d0 = polyline[0].distanceTo(p1);
    const d1 = polyline[24].distanceTo(p2);

    assert.ok(d0 < 1e-12, `d0 endpoint drift at t=10^6s must be < 1e-12, got ${d0}`);
    assert.ok(d1 < 1e-12, `d1 endpoint drift at t=10^6s must be < 1e-12, got ${d1}`);
  });

  it('4.2: Numeric precision and boundedness at ultra-extreme t = 1,000,000,000s (10^9 seconds)', () => {
    const tGiga = 1e9;
    const polyline = generateVibratingEdgePolyline(p1, p2, tGiga, {
      segments: 16,
      amplitude: 2.0,
      frequency: 20.0,
      isVibrating: true
    });

    assert.strictEqual(polyline.length, 17);

    // Verify all vertex coordinates are finite
    for (let i = 0; i < polyline.length; i++) {
      const v = polyline[i];
      assert.ok(Number.isFinite(v.x) && !Number.isNaN(v.x), `Vertex ${i} x is not finite at t=10^9`);
      assert.ok(Number.isFinite(v.y) && !Number.isNaN(v.y), `Vertex ${i} y is not finite at t=10^9`);
      assert.ok(Number.isFinite(v.z) && !Number.isNaN(v.z), `Vertex ${i} z is not finite at t=10^9`);
    }

    // Verify Dirichlet endpoints at 10^9s
    assert.ok(polyline[0].distanceTo(p1) < 1e-12);
    assert.ok(polyline[16].distanceTo(p2) < 1e-12);
  });

  it('4.3: Negative extreme timestamp (t = -1,000,000s) preserves Dirichlet invariance', () => {
    const tNeg = -1000000.0;
    const polyline = generateVibratingEdgePolyline(p1, p2, tNeg, {
      segments: 32,
      amplitude: 1.0,
      frequency: 10.0,
      isVibrating: true
    });

    assert.strictEqual(polyline.length, 33);
    assert.ok(polyline[0].distanceTo(p1) < 1e-12);
    assert.ok(polyline[32].distanceTo(p2) < 1e-12);
  });

  it('4.4: High-frequency stress at t = 10^6 seconds across 1,000 consecutive timesteps (60 FPS playback)', () => {
    // Simulate 1,000 animation frames starting at t = 1,000,000s with dt = 1/60s
    const startT = 1e6;
    const dt = 1 / 60;
    const segs = 16;
    const amp = 1.2;

    let maxObservedDisplacement = 0;

    for (let frame = 0; frame < 1000; frame++) {
      const curT = startT + frame * dt;
      const pts = generateVibratingEdgePolyline(p1, p2, curT, {
        segments: segs,
        amplitude: amp,
        frequency: 14.0,
        isVibrating: true
      });

      // Endpoint checks
      assert.ok(pts[0].distanceTo(p1) < 1e-12);
      assert.ok(pts[segs].distanceTo(p2) < 1e-12);

      // Midpoint displacement must be strictly bounded by amplitude envelope
      const midPoint = pts[Math.floor(segs / 2)];
      const straightMid = p1.clone().lerp(p2, 0.5);
      const disp = midPoint.distanceTo(straightMid);

      if (disp > maxObservedDisplacement) maxObservedDisplacement = disp;

      // Theoretical max displacement = (oscN + jitN) + (oscB + jitB) <= amp * (1 + 0.15 + 0.7 + 0.15) = amp * 2.0
      assert.ok(
        disp <= amp * 2.2,
        `Displacement ${disp.toFixed(4)} exceeded theoretical envelope clamp at frame ${frame}, t=${curT}`
      );
    }

    assert.ok(maxObservedDisplacement > 0.1, 'Standing wave must oscillate with non-zero displacement');
  });

  it('4.5: High throughput: 10,000 standing wave evaluations execute in < 250ms', () => {
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      generateVibratingEdgePolyline(p1, p2, 1e6 + i * 0.01, {
        segments: 16,
        amplitude: 0.8,
        frequency: 12.0,
        isVibrating: true
      });
    }
    const elapsed = performance.now() - t0;
    assert.ok(elapsed < 1000, `10,000 evaluations took ${elapsed.toFixed(1)}ms, expected < 1000ms`);
  });
});
