/**
 * @file src/vault/server.js
 * @description Zero-dependency native node:http server for the 3D Vault visualizer.
 * Serves static assets from src/vault/public/, exposes /api/graph, /api/scenarios, and /api/health.
 * Provides programmatic lifecycle control via startVaultServer and createServerInstance.
 * Pure ESM, zero external runtime dependencies. Node.js >= 18.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

import { loadSDDGraph, resolveSpecDir } from './core/sdd-adapter.js';
import { getSyntheticScenario, listSyntheticScenarios } from './core/synthetic-data.js';
import { detectCycles } from './core/cycle-detector.js';
import { NodeStatus, EdgeStatus, IntegrityTag } from './core/graph-model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.resolve(__dirname, 'public');
const MATH_DIR = path.resolve(__dirname, 'math');
const PHYSICS_DIR = path.resolve(__dirname, 'physics');
const CORE_DIR = path.resolve(__dirname, 'core');

/**
 * Active Server-Sent Events (SSE) clients for real-time hot-reload.
 * @type {Set<http.ServerResponse>}
 */
const sseClients = new Set();

/**
 * Broadcasts an SSE event to all connected clients.
 * @param {string} eventName
 * @param {Object} data
 */
export function broadcastSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * Resolves the path to the custom graph persistence file (.spec/vault-custom.json).
 * @param {string} projectRoot
 * @param {string} [specDir]
 * @returns {string}
 */
function getCustomGraphFilePath(projectRoot, specDir) {
  const resolved = resolveSpecDir(specDir, { projectRoot, fallbackToExamples: false }) ||
                   path.resolve(projectRoot, '.spec');
  return path.join(resolved, 'vault-custom.json');
}

/**
 * Reads persisted custom nodes and edges from disk.
 * @param {string} projectRoot
 * @param {string} [specDir]
 * @returns {{ nodes: Array, edges: Array }}
 */
function readCustomGraphData(projectRoot, specDir) {
  try {
    const filePath = getCustomGraphFilePath(projectRoot, specDir);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        edges: Array.isArray(parsed.edges) ? parsed.edges : []
      };
    }
  } catch {
    // Fallback to empty
  }
  return { nodes: [], edges: [] };
}

/**
 * Writes custom nodes and edges to disk (.spec/vault-custom.json).
 * @param {string} projectRoot
 * @param {string} [specDir]
 * @param {{ nodes: Array, edges: Array }} data
 */
function writeCustomGraphData(projectRoot, specDir, data) {
  const filePath = getCustomGraphFilePath(projectRoot, specDir);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const clean = {
    updatedAt: new Date().toISOString(),
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
    edges: Array.isArray(data.edges) ? data.edges : []
  };
  fs.writeFileSync(filePath, JSON.stringify(clean, null, 2), 'utf-8');
  return clean;
}

export const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
});

/**
 * Sends a JSON response with status code and standard headers.
 */
function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(jsonStr, 'utf-8'),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache'
  });
  res.end(jsonStr);
}

/**
 * Attempts to launch the system default browser.
 */
function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      exec(`start "" "${url}"`);
    } else if (platform === 'darwin') {
      exec(`open "${url}"`);
    } else {
      exec(`xdg-open "${url}"`);
    }
  } catch {
    // Graceful fallback if open command is unavailable
  }
}

/**
 * Resolves a safe file path against an allowed base directory to prevent directory traversal.
 *
 * @param {string} baseDir - Trusted root directory
 * @param {string} relativePath - Request sub-path
 * @returns {string|null} Resolved absolute file path or null if out of bounds
 */
function resolveSafePath(baseDir, relativePath) {
  const normalizedRel = path.normalize(decodeURIComponent(relativePath)).replace(/^(\.\.[/\\])+/, '');
  const absolutePath = path.resolve(baseDir, normalizedRel);

  // Security check: target must be inside baseDir
  if (!absolutePath.startsWith(baseDir)) {
    return null;
  }
  return absolutePath;
}

/**
 * Serves a static file from disk.
 */
function serveStaticFile(req, res, filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: 'File Not Found', path: req.url });
      return;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const indexFile = path.join(filePath, 'index.html');
      if (fs.existsSync(indexFile)) {
        return serveStaticFile(req, res, indexFile);
      }
      sendJson(res, 404, { error: 'File Not Found', path: req.url });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (err) {
    sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Handles an incoming HTTP request for the 3D Vault.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Object} [options={}]
 */
export function handleVaultRequest(req, res, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  let urlObj;
  try {
    urlObj = new URL(req.url, 'http://127.0.0.1');
  } catch {
    sendJson(res, 400, { error: 'Invalid URL' });
    return;
  }

  const pathname = urlObj.pathname;
  const query = Object.fromEntries(urlObj.searchParams.entries());

  // --- API: Custom Graph Persistence (.spec/vault-custom.json) ---
  if (pathname === '/api/graph/custom') {
    const targetSpecDir = query.specDir || options.specDir;

    if (req.method === 'GET') {
      const customData = readCustomGraphData(projectRoot, targetSpecDir);
      sendJson(res, 200, customData);
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const saved = writeCustomGraphData(projectRoot, targetSpecDir, parsed);
          sendJson(res, 200, { status: 'saved', ...saved });
        } catch (err) {
          sendJson(res, 400, { error: `Invalid JSON body: ${err.message}` });
        }
      });
      return;
    }

    if (req.method === 'DELETE') {
      try {
        const filePath = getCustomGraphFilePath(projectRoot, targetSpecDir);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        sendJson(res, 200, { status: 'cleared', nodes: [], edges: [] });
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Strictly enforce GET for all other routes
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // --- API: Server-Sent Events (SSE) for Real-Time .spec/ Hot-Reload ---
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'watching', timestamp: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    const cleanup = () => {
      sseClients.delete(res);
    };
    if (typeof req.on === 'function') req.on('close', cleanup);
    if (typeof res.on === 'function') res.on('close', cleanup);
    return;
  }

  // --- API: Health ---
  if (pathname === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
    return;
  }

  // --- API: Scenarios ---
  if (pathname === '/api/scenarios') {
    const scenarios = [
      {
        id: 'live_sdd',
        name: 'Live SDD Repository (.spec/)',
        description: 'Live repository specifications mapped to 3D graph model with audit validation'
      }
    ];

    for (const name of listSyntheticScenarios()) {
      try {
        const sc = getSyntheticScenario(name);
        scenarios.push({
          id: sc.name,
          name: sc.name,
          description: sc.description,
          nodeCount: sc.nodes.length,
          edgeCount: sc.edges.length,
          expectedCycles: sc.expectedCycles
        });
      } catch {
        // Continue
      }
    }

    sendJson(res, 200, scenarios);
    return;
  }

  // --- API: Graph ---
  if (pathname === '/api/graph') {
    const scenarioParam = query.scenario;

    // Handle synthetic scenario request
    if (scenarioParam && scenarioParam !== 'live_sdd') {
      try {
        const scenario = getSyntheticScenario(scenarioParam);
        const cycleResult = detectCycles(scenario.nodes, scenario.edges);

        // Annotate node status & tags
        for (const node of scenario.nodes) {
          const s = cycleResult.nodeStatusMap.get(node.id);
          if (s === NodeStatus.CIRCULAR) {
            node.setStatus(NodeStatus.CIRCULAR);
          } else if (s === NodeStatus.ORPHAN) {
            node.addTag(IntegrityTag.ORPHAN_NODE);
          } else if (s === NodeStatus.BROKEN) {
            node.addTag(IntegrityTag.BROKEN_REFERENCE);
          }
        }

        // Annotate edge status
        for (const edge of scenario.edges) {
          const eid = edge.id || `${edge.source}->${edge.target}`;
          const s = cycleResult.edgeStatusMap.get(eid);
          if (s) edge.setStatus(s);
        }

        const responseData = {
          nodes: scenario.nodes.map(n => (typeof n.toJSON === 'function' ? n.toJSON() : n)),
          edges: scenario.edges.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)),
          metadata: {
            loadedAt: new Date().toISOString(),
            source: 'synthetic',
            scenario: scenario.name,
            description: scenario.description,
            specDir: null,
            projectRoot,
            cycleSummary: cycleResult.summary,
            cycles: cycleResult.cycles,
            hasCycles: cycleResult.hasCycles
          },
          stats: {
            nodeCount: scenario.nodes.length,
            edgeCount: scenario.edges.length,
            hasCycles: cycleResult.hasCycles,
            cycleCount: cycleResult.cycleCount,
            orphanCount: cycleResult.orphanNodeIds.size,
            brokenEdgeCount: cycleResult.brokenEdges.length
          }
        };

        sendJson(res, 200, responseData);
        return;
      } catch (err) {
        sendJson(res, 400, {
          error: `Failed to load synthetic scenario: ${err.message}`,
          availableScenarios: listSyntheticScenarios()
        });
        return;
      }
    }

    // Handle Live SDD Graph request
    try {
      const targetSpecDir = query.specDir || options.specDir;
      const result = loadSDDGraph(targetSpecDir, {
        projectRoot,
        fallbackToExamples: true,
        fallbackToSynthetic: true
      });

      const responseData = {
        nodes: result.nodes.map(n => (typeof n.toJSON === 'function' ? n.toJSON() : n)),
        edges: result.edges.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)),
        metadata: result.metadata,
        stats: result.stats
      };

      sendJson(res, 200, responseData);
      return;
    } catch (err) {
      sendJson(res, 500, {
        error: `Failed to load SDD Graph: ${err.message}`,
        stack: err.stack
      });
      return;
    }
  }

  // --- Static File Routing ---

  // Security check against null bytes or encoded path manipulation
  if (pathname.includes('%00') || pathname.includes('\0')) {
    sendJson(res, 400, { error: 'Bad Request' });
    return;
  }

  // Direct module serving from /math/, /physics/, /core/
  if (pathname.startsWith('/math/')) {
    const rel = pathname.slice('/math/'.length);
    const safe = resolveSafePath(MATH_DIR, rel);
    if (!safe) return sendJson(res, 403, { error: 'Forbidden' });
    return serveStaticFile(req, res, safe);
  }

  if (pathname.startsWith('/physics/')) {
    const rel = pathname.slice('/physics/'.length);
    const safe = resolveSafePath(PHYSICS_DIR, rel);
    if (!safe) return sendJson(res, 403, { error: 'Forbidden' });
    return serveStaticFile(req, res, safe);
  }

  if (pathname.startsWith('/core/')) {
    const rel = pathname.slice('/core/'.length);
    const safe = resolveSafePath(CORE_DIR, rel);
    if (!safe) return sendJson(res, 403, { error: 'Forbidden' });
    return serveStaticFile(req, res, safe);
  }

  // General public assets from /public/
  const targetPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const safeFilePath = resolveSafePath(PUBLIC_DIR, targetPath);

  if (!safeFilePath) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  serveStaticFile(req, res, safeFilePath);
}

/**
 * Creates and configures the native node:http server instance.
 *
 * @param {Object} [options={}]
 * @param {string} [options.specDir] - Target specification directory
 * @param {string} [options.projectRoot] - Project workspace root
 * @returns {http.Server}
 */
export function createServerInstance(options = {}) {
  return http.createServer((req, res) => handleVaultRequest(req, res, options));
}

/**
 * Starts the 3D Vault HTTP server and begins listening.
 *
 * @param {Object} [options={}]
 * @param {number} [options.port=3333]
 * @param {string} [options.host='127.0.0.1']
 * @param {boolean} [options.open=false] - Automatically opens web browser
 * @param {boolean} [options.quiet=false] - Silences startup console log
 * @param {string} [options.specDir]
 * @param {string} [options.projectRoot]
 * @returns {Promise<{ server: http.Server, url: string, port: number, host: string, close: () => Promise<void> }>}
 */
export async function startVaultServer(options = {}) {
  const port = options.port ?? 3333;
  const host = options.host || '127.0.0.1';
  const projectRoot = options.projectRoot || process.cwd();
  const server = createServerInstance(options);

  let specWatcher = null;
  let debounceTimer = null;

  try {
    const watchDir = resolveSpecDir(options.specDir, { projectRoot, fallbackToExamples: true });
    if (watchDir && fs.existsSync(watchDir)) {
      specWatcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const normalized = String(filename).replace(/\\/g, '/');
        if (normalized.endsWith('.md') || normalized.endsWith('.json')) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            broadcastSSE('spec-changed', {
              eventType,
              filename: normalized,
              timestamp: new Date().toISOString()
            });
          }, 180);
        }
      });
      specWatcher.on('error', () => {
        // Ignore OS watch errors gracefully
      });
    }
  } catch {
    // Recursive fs.watch fallback if unsupported by platform
  }

  return new Promise((resolve, reject) => {
    server.on('error', (err) => {
      if (specWatcher) {
        try { specWatcher.close(); } catch { /* ignore */ }
      }
      reject(err);
    });

    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address !== null ? address.port : port;
      const url = `http://${host}:${actualPort}`;

      if (!options.quiet) {
        console.log(`[Vault Server] Listening on ${url}`);
      }

      if (options.open) {
        openBrowser(url);
      }

      resolve({
        server,
        url,
        port: actualPort,
        host,
        close: () =>
          new Promise((res, rej) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            if (specWatcher) {
              try { specWatcher.close(); } catch { /* ignore */ }
              specWatcher = null;
            }
            for (const client of sseClients) {
              try { client.end(); } catch { /* ignore */ }
            }
            sseClients.clear();
            server.close((err) => (err ? rej(err) : res()));
          })
      });
    });
  });
}
