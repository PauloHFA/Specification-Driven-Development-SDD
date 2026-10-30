/**
 * @file src/vault/core/sdd-adapter.js
 * @description SDD (Specification-Driven Development) Graph Adapter for the 3D Vault.
 * Ingests .spec/ files, User Stories (US-xxx), Acceptance Criteria (AC-xxx), Tasks (T-xxx),
 * Assumptions (ASM-xxx), Questions (Q-xxx), Principles (P-xxx), and GWT clauses.
 * Maps them into 3D VaultGraphNode and VaultGraphEdge instances with logical 3D orbital clustering,
 * elastic connectivity, and automatic cycle detection.
 * Pure ESM, zero external runtime dependencies. Node.js >= 18.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VaultGraphNode,
  VaultGraphEdge,
  NodeType,
  EdgeType,
  NodeStatus,
  EdgeStatus,
  IntegrityTag
} from './graph-model.js';
import { detectCycles } from './cycle-detector.js';
import { getSyntheticScenario } from './synthetic-data.js';

import { parseSpec } from '../../parsers/spec.js';
import { parseTasks } from '../../parsers/tasks.js';
import { parseConstitution } from '../../parsers/constitution.js';
import { auditProject } from '../../core/audit.js';

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
  const hasExplicitRoot = Boolean(options.projectRoot);
  const projectRoot = options.projectRoot || process.cwd();
  const allowExamples = options.fallbackToExamples !== false;

  // Case 1: Caller provided an explicit, non-empty specDir
  if (specDir && typeof specDir === 'string' && specDir.trim().length > 0) {
    const trimmed = specDir.trim();
    const explicitCandidates = [];

    if (path.isAbsolute(trimmed)) {
      explicitCandidates.push(path.normalize(trimmed));
    } else {
      explicitCandidates.push(path.resolve(projectRoot, trimmed));
      if (!hasExplicitRoot && path.resolve(process.cwd(), trimmed) !== path.resolve(projectRoot, trimmed)) {
        explicitCandidates.push(path.resolve(process.cwd(), trimmed));
      }
    }

    for (const candidate of explicitCandidates) {
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

    // Explicit path was requested but does not exist on disk.
    // If examples fallback is explicitly disabled, strictly fail immediately.
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

  // Case 2: No explicit specDir provided (undefined, null, or empty string)
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

/**
 * Formats Given/When/Then (GWT) clauses into an inspection snippet.
 *
 * @param {Object} ac
 * @returns {string}
 */
function formatGwtSnippet(ac) {
  const lines = [];
  if (Array.isArray(ac.given) && ac.given.length > 0) {
    for (const g of ac.given) lines.push(`Dado ${g}`);
  }
  if (Array.isArray(ac.when) && ac.when.length > 0) {
    for (const w of ac.when) lines.push(`Quando ${w}`);
  }
  if (Array.isArray(ac.then) && ac.then.length > 0) {
    for (const t of ac.then) lines.push(`Então ${t}`);
  }
  return lines.join('\n');
}

/**
 * Computes deterministic 3D positions for nodes organized in hierarchical orbital layers:
 * Layer 0: Spec / Features at center (Y ≈ 0)
 * Layer 1: User Stories in orbital ring 1 (radius ~135, Y ≈ 0)
 * Layer 2: Acceptance Criteria in orbital ring 2 (radius ~240, clustered near parent story)
 * Layer 3: Tasks in orbital ring 3 (radius ~350, Y ≈ ±40)
 * Layer 4: Files / Implementation in orbital ring 4 (radius ~460, Y ≈ -80)
 * Layer 5: Principles elevated in celestial ring (radius ~220, Y ≈ +220)
 * Layer 6: Assumptions and Questions in dedicated flanking zones (Y ≈ +100)
 *
 * @param {VaultGraphNode[]} nodes
 * @param {VaultGraphEdge[]} edges
 * @param {Object} [options={}]
 * @param {number} [options.layoutRadius=150] - Base scale factor for layout
 */
export function computeOrbitalLayout(nodes, edges, options = {}) {
  const baseRadius = Number.isFinite(options.layoutRadius) && options.layoutRadius > 0
    ? options.layoutRadius
    : 150;

  // Separate nodes by type
  const featureNodes = [];
  const storyNodes = [];
  const criterionNodes = [];
  const taskNodes = [];
  const principleNodes = [];
  const assumptionNodes = [];
  const questionNodes = [];
  const fileNodes = [];
  const otherNodes = [];

  for (const n of nodes) {
    switch (n.type) {
      case NodeType.FEATURE:
        featureNodes.push(n);
        break;
      case NodeType.STORY:
        storyNodes.push(n);
        break;
      case NodeType.CRITERION:
        criterionNodes.push(n);
        break;
      case NodeType.TASK:
        taskNodes.push(n);
        break;
      case NodeType.PRINCIPLE:
        principleNodes.push(n);
        break;
      case NodeType.ASSUMPTION:
        assumptionNodes.push(n);
        break;
      case NodeType.QUESTION:
        questionNodes.push(n);
        break;
      case NodeType.FILE:
        fileNodes.push(n);
        break;
      default:
        otherNodes.push(n);
        break;
    }
  }

  // 1. Features at center
  const featureCenters = new Map();
  const numFeatures = Math.max(featureNodes.length, 1);
  const featureRadius = numFeatures > 1 ? baseRadius * 1.5 : 0;

  for (let i = 0; i < featureNodes.length; i++) {
    const fNode = featureNodes[i];
    const angle = (2 * Math.PI * i) / numFeatures;
    const fx = featureRadius * Math.cos(angle);
    const fz = featureRadius * Math.sin(angle);
    fNode.setPosition(fx, 0, fz);
    featureCenters.set(fNode.id, { x: fx, z: fz });
  }

  // Default center if no feature nodes
  const defaultCenter = { x: 0, z: 0 };

  // 2. User Stories in orbital ring 1 around their feature center
  const storyAngles = new Map();
  const storyRadius = baseRadius * 0.9;
  for (let i = 0; i < storyNodes.length; i++) {
    const sNode = storyNodes[i];
    const featId = sNode.metadata?.feature ? `FEAT:${sNode.metadata.feature}` : null;
    const center = (featId && featureCenters.get(featId)) || defaultCenter;
    const angle = (2 * Math.PI * i) / Math.max(storyNodes.length, 1);
    storyAngles.set(sNode.id, angle);

    const sx = center.x + storyRadius * Math.cos(angle);
    const sy = 15 * Math.sin(2 * angle);
    const sz = center.z + storyRadius * Math.sin(angle);
    sNode.setPosition(sx, sy, sz);
  }

  // 3. Acceptance Criteria in orbital ring 2, clustered near parent story angle
  const acRadius = baseRadius * 1.6;
  const acsByStory = new Map();
  for (const acNode of criterionNodes) {
    const sid = acNode.metadata?.storyId || 'root';
    if (!acsByStory.has(sid)) acsByStory.set(sid, []);
    acsByStory.get(sid).push(acNode);
  }

  let acGlobalIdx = 0;
  for (const [sid, acList] of acsByStory.entries()) {
    const parentAngle = storyAngles.get(sid) ?? ((2 * Math.PI * acGlobalIdx) / Math.max(criterionNodes.length, 1));
    for (let j = 0; j < acList.length; j++) {
      const acNode = acList[j];
      const featId = acNode.metadata?.feature ? `FEAT:${acNode.metadata.feature}` : null;
      const center = (featId && featureCenters.get(featId)) || defaultCenter;

      const deltaAngle = (j - (acList.length - 1) / 2) * 0.35;
      const angle = parentAngle + deltaAngle;
      const ax = center.x + acRadius * Math.cos(angle);
      const ay = -25 + 20 * (j % 2);
      const az = center.z + acRadius * Math.sin(angle);
      acNode.setPosition(ax, ay, az);
      acGlobalIdx++;
    }
  }

  // 4. Tasks in orbital ring 3
  const taskRadius = baseRadius * 2.3;
  for (let k = 0; k < taskNodes.length; k++) {
    const tNode = taskNodes[k];
    const featId = tNode.metadata?.feature ? `FEAT:${tNode.metadata.feature}` : null;
    const center = (featId && featureCenters.get(featId)) || defaultCenter;
    const angle = (2 * Math.PI * k) / Math.max(taskNodes.length, 1);

    const tx = center.x + taskRadius * Math.cos(angle);
    const ty = 35 * Math.cos(3 * angle);
    const tz = center.z + taskRadius * Math.sin(angle);
    tNode.setPosition(tx, ty, tz);
  }

  // 5. Files in orbital ring 4
  const fileRadius = baseRadius * 3.0;
  for (let m = 0; m < fileNodes.length; m++) {
    const fileNode = fileNodes[m];
    const angle = (2 * Math.PI * m) / Math.max(fileNodes.length, 1);
    const fx = fileRadius * Math.cos(angle);
    const fy = -75;
    const fz = fileRadius * Math.sin(angle);
    fileNode.setPosition(fx, fy, fz);
  }

  // 6. Assumptions on left shelf
  for (let a = 0; a < assumptionNodes.length; a++) {
    const asmNode = assumptionNodes[a];
    const ax = -baseRadius * 1.3 - a * 45;
    const ay = 110;
    const az = -baseRadius * 0.8;
    asmNode.setPosition(ax, ay, az);
  }

  // 7. Questions on right shelf
  for (let q = 0; q < questionNodes.length; q++) {
    const qNode = questionNodes[q];
    const qx = baseRadius * 1.3 + q * 45;
    const qy = 110;
    const qz = -baseRadius * 0.8;
    qNode.setPosition(qx, qy, qz);
  }

  // 8. Principles elevated in overarching celestial ring
  const principleRadius = baseRadius * 1.7;
  for (let p = 0; p < principleNodes.length; p++) {
    const pNode = principleNodes[p];
    const angle = (2 * Math.PI * p) / Math.max(principleNodes.length, 1);
    const px = principleRadius * Math.cos(angle);
    const py = 210 + 15 * Math.sin(2 * angle);
    const pz = principleRadius * Math.sin(angle);
    pNode.setPosition(px, py, pz);
  }

  // 9. Other / generic nodes
  for (let o = 0; o < otherNodes.length; o++) {
    const oNode = otherNodes[o];
    const angle = (2 * Math.PI * o) / Math.max(otherNodes.length, 1);
    oNode.setPosition(baseRadius * 1.1 * Math.cos(angle), -120, baseRadius * 1.1 * Math.sin(angle));
  }
}

/**
 * Converts a structured project model into 3D Knowledge Graph entities.
 *
 * @param {Object} projectData
 * @param {Array<Object>} [projectData.features]
 * @param {Object} [projectData.constitution]
 * @param {Object} [projectData.verifications]
 * @param {Array<Object>} [projectData.auditFindings]
 * @param {Object} [options={}]
 * @returns {{ nodes: VaultGraphNode[], edges: VaultGraphEdge[], metadata: Object, stats: Object }}
 */
export function convertProjectToGraph(projectData = {}, options = {}) {
  const nodeMap = new Map();
  const edges = [];

  function addNode(node) {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
    return nodeMap.get(node.id);
  }

  const verifications = projectData.verifications || {};

  // 1. Principles from Constitution
  const principles = projectData.constitution?.principles || [];
  for (const principle of principles) {
    const pNode = new VaultGraphNode({
      id: principle.id,
      title: principle.title,
      type: NodeType.PRINCIPLE,
      status: NodeStatus.VALID,
      snippet: principle.body ? principle.body.join('\n') : '',
      mass: 1.8,
      metadata: {
        level: principle.level,
        obligationLevel: principle.level,
        checks: principle.checks,
        line: principle.line
      }
    });

    // Match verification status across all features
    for (const vData of Object.values(verifications)) {
      if (vData?.principles?.[principle.id]) {
        pNode.status = vData.principles[principle.id].status || 'pass';
        pNode.metadata.verification = vData.principles[principle.id];
        break;
      }
    }

    addNode(pNode);
  }

  // 2. Features, Stories, ACs, Assumptions, Questions, Tasks
  const features = Array.isArray(projectData.features) ? projectData.features : [];

  for (const feat of features) {
    const featName = feat.name || feat.feature || feat.id || 'feature';
    const spec = feat.spec;
    const featNodeId = featName.startsWith('FEAT:') ? featName : `FEAT:${featName}`;

    const featNode = new VaultGraphNode({
      id: featNodeId,
      title: spec?.title || featName,
      type: NodeType.FEATURE,
      status: spec?.status || 'implementada',
      snippet: spec?.title
        ? `# ${spec.title}\n> feature: ${featName}\n> status: ${spec.status || 'pronta'}`
        : `Feature: ${featName}`,
      mass: 3.0,
      metadata: {
        feature: featName,
        sections: spec?.sections,
        parseIssues: spec?.parseIssues
      }
    });
    addNode(featNode);

    // Link all principles as constrains to this feature
    for (const principle of principles) {
      edges.push(
        new VaultGraphEdge({
          id: `EDGE:${principle.id}->${featNodeId}`,
          source: principle.id,
          target: featNodeId,
          type: EdgeType.CONSTRAINS
        })
      );
    }

    // Process spec stories & ACs
    if (spec && Array.isArray(spec.stories)) {
      for (const story of spec.stories) {
        const storyNode = new VaultGraphNode({
          id: story.id,
          title: story.title,
          type: NodeType.STORY,
          status: spec.status || NodeStatus.VALID,
          snippet: story.description ? story.description.join('\n') : '',
          mass: 1.6,
          metadata: {
            feature: featName,
            line: story.line
          }
        });
        addNode(storyNode);

        // Edge: Feature -> Story (contains)
        edges.push(
          new VaultGraphEdge({
            id: `EDGE:${featNodeId}->${story.id}`,
            source: featNodeId,
            target: story.id,
            type: EdgeType.CONTAINS
          })
        );

        if (Array.isArray(story.acs)) {
          for (const ac of story.acs) {
            const acSnippet = formatGwtSnippet(ac);
            const acNode = new VaultGraphNode({
              id: ac.id,
              title: ac.title,
              type: NodeType.CRITERION,
              status: 'pendente',
              snippet: acSnippet,
              mass: 1.2,
              metadata: {
                feature: featName,
                storyId: story.id,
                line: ac.line,
                given: ac.given || [],
                when: ac.when || [],
                then: ac.then || []
              }
            });

            // Match verification verdict
            const featVerif = verifications[featName] || verifications[spec.feature];
            if (featVerif?.results?.[ac.id]) {
              acNode.status = featVerif.results[ac.id].status || 'pass';
              acNode.metadata.verification = featVerif.results[ac.id];
            }

            addNode(acNode);

            // Edge: Story -> AC (contains)
            edges.push(
              new VaultGraphEdge({
                id: `EDGE:${story.id}->${ac.id}`,
                source: story.id,
                target: ac.id,
                type: EdgeType.CONTAINS
              })
            );
          }
        }
      }
    }

    // Process Assumptions
    if (spec && Array.isArray(spec.assumptions)) {
      for (const asm of spec.assumptions) {
        const asmNode = new VaultGraphNode({
          id: asm.id,
          title: asm.text,
          type: NodeType.ASSUMPTION,
          status: asm.status || 'aberta',
          snippet: asm.resolution ? `Resolução: ${asm.resolution}` : `Status: ${asm.status}`,
          mass: 1.0,
          metadata: {
            feature: featName,
            status: asm.status,
            resolution: asm.resolution,
            line: asm.line
          }
        });
        addNode(asmNode);

        // Edge: Feature -> Assumption (contains)
        edges.push(
          new VaultGraphEdge({
            id: `EDGE:${featNodeId}->${asm.id}`,
            source: featNodeId,
            target: asm.id,
            type: EdgeType.CONTAINS
          })
        );
      }
    }

    // Process Questions
    if (spec && Array.isArray(spec.questions)) {
      for (const q of spec.questions) {
        const qNode = new VaultGraphNode({
          id: q.id,
          title: q.text,
          type: NodeType.QUESTION,
          status: q.status || 'aberta',
          snippet: q.answer ? `Resposta: ${q.answer}` : `Status: ${q.status}`,
          mass: 1.0,
          metadata: {
            feature: featName,
            status: q.status,
            answer: q.answer,
            line: q.line
          }
        });
        addNode(qNode);

        // Edge: Feature -> Question (contains)
        edges.push(
          new VaultGraphEdge({
            id: `EDGE:${featNodeId}->${q.id}`,
            source: featNodeId,
            target: q.id,
            type: EdgeType.CONTAINS
          })
        );
      }
    }

    // Process Tasks
    const taskList = feat.tasks?.tasks || [];
    for (const task of taskList) {
      const taskNode = new VaultGraphNode({
        id: task.id,
        title: task.title,
        type: NodeType.TASK,
        status: task.status || 'pendente',
        snippet: `Refs: ${(task.refs || []).join(', ')}\nArquivos: ${(task.files || []).join(', ')}`,
        mass: 1.3,
        metadata: {
          feature: featName,
          status: task.status,
          refs: task.refs || [],
          files: task.files || [],
          model: task.model,
          esforco: task.esforco,
          line: task.line
        }
      });
      addNode(taskNode);

      // Edges: Task -> Refs (implements)
      for (const ref of task.refs || []) {
        edges.push(
          new VaultGraphEdge({
            id: `EDGE:${task.id}->${ref}`,
            source: task.id,
            target: ref,
            type: EdgeType.IMPLEMENTS
          })
        );
      }

      // Edges: Task -> Files (touches)
      if (options.includeFiles !== false) {
        for (const file of task.files || []) {
          const fileId = file.startsWith('FILE:') ? file : `FILE:${file}`;
          if (!nodeMap.has(fileId)) {
            const fileNode = new VaultGraphNode({
              id: fileId,
              title: path.basename(file),
              type: NodeType.FILE,
              status: NodeStatus.VALID,
              snippet: `Arquivo referenciado em tarefas SDD: ${file}`,
              mass: 1.0,
              metadata: { path: file }
            });
            addNode(fileNode);
          }

          edges.push(
            new VaultGraphEdge({
              id: `EDGE:${task.id}->${fileId}`,
              source: task.id,
              target: fileId,
              type: 'touches'
            })
          );
        }
      }
    }
  }

  const nodes = Array.from(nodeMap.values());

  // Attach audit findings if present
  if (Array.isArray(projectData.auditFindings)) {
    for (const finding of projectData.auditFindings) {
      for (const node of nodes) {
        if (
          finding.code &&
          (finding.id === node.id ||
            finding.message?.includes(node.id) ||
            (finding.feature && node.metadata?.feature === finding.feature && node.type === NodeType.FEATURE))
        ) {
          node.addAuditFinding(finding);
          if (finding.severity === 'erro' || finding.severity === 'error') {
            node.metadata.auditStatus = 'error';
          } else if (node.metadata.auditStatus !== 'error') {
            node.metadata.auditStatus = 'warning';
          }
        }
      }
    }
  }

  // Set default audit status on nodes if not set
  for (const node of nodes) {
    if (!node.metadata.auditStatus) {
      if (node.status === 'pass' || node.status === 'concluida' || node.status === 'implementada') {
        node.metadata.auditStatus = 'clean';
      }
    }
  }

  // 3. Compute 3D Positions
  computeOrbitalLayout(nodes, edges, options);

  // 4. Run Cycle Detection and classify graph integrity
  const cycleResult = detectCycles(nodes, edges);

  for (const node of nodes) {
    const integrityStatus = cycleResult.nodeStatusMap.get(node.id);
    node.metadata.integrityStatus = integrityStatus || NodeStatus.VALID;
    if (integrityStatus === NodeStatus.CIRCULAR) {
      node.setStatus(NodeStatus.CIRCULAR);
    } else if (integrityStatus === NodeStatus.ORPHAN) {
      node.addTag(IntegrityTag.ORPHAN_NODE);
    } else if (integrityStatus === NodeStatus.BROKEN) {
      node.addTag(IntegrityTag.BROKEN_REFERENCE);
    }
  }

  for (const edge of edges) {
    const edgeId = edge.id || `${edge.source}->${edge.target}`;
    const status = cycleResult.edgeStatusMap.get(edgeId);
    if (status) {
      edge.setStatus(status);
    }
  }

  const stats = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    featureCount: nodes.filter(n => n.type === NodeType.FEATURE).length,
    storyCount: nodes.filter(n => n.type === NodeType.STORY).length,
    criterionCount: nodes.filter(n => n.type === NodeType.CRITERION).length,
    taskCount: nodes.filter(n => n.type === NodeType.TASK).length,
    principleCount: nodes.filter(n => n.type === NodeType.PRINCIPLE).length,
    assumptionCount: nodes.filter(n => n.type === NodeType.ASSUMPTION).length,
    questionCount: nodes.filter(n => n.type === NodeType.QUESTION).length,
    fileCount: nodes.filter(n => n.type === NodeType.FILE).length,
    hasCycles: cycleResult.hasCycles,
    cycleCount: cycleResult.cycleCount,
    cycles: cycleResult.cycles,
    orphanCount: cycleResult.orphanNodeIds.size,
    brokenEdgeCount: cycleResult.brokenEdges.length
  };

  const metadata = {
    loadedAt: new Date().toISOString(),
    source: options.source || 'sdd_specs',
    specDir: options.specDir || null,
    projectRoot: options.projectRoot || null,
    cycleSummary: cycleResult.summary,
    sccs: cycleResult.sccs
  };

  return { nodes, edges, metadata, stats };
}

/**
 * Discovers and parses specification files into a 3D Knowledge Graph.
 *
 * @param {string} [specDir] - Path to .spec directory or feature folder
 * @param {Object} [options={}]
 * @param {string} [options.projectRoot]
 * @param {boolean} [options.fallbackToExamples=true]
 * @param {boolean} [options.fallbackToSynthetic=true]
 * @param {string} [options.syntheticScenario='clean_dag']
 * @param {boolean} [options.runAudit=true]
 * @returns {{ nodes: VaultGraphNode[], edges: VaultGraphEdge[], metadata: Object, stats: Object }}
 */
export function loadSDDGraph(specDir, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const resolved = resolveSpecDir(specDir, {
    projectRoot,
    fallbackToExamples: options.fallbackToExamples !== false
  });

  function buildSyntheticFallback() {
    const scenarioName = options.syntheticScenario || 'clean_dag';
    const scenario = getSyntheticScenario(scenarioName);
    const cycleResult = detectCycles(scenario.nodes, scenario.edges);

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
    for (const edge of scenario.edges) {
      const eid = edge.id || `${edge.source}->${edge.target}`;
      const s = cycleResult.edgeStatusMap.get(eid);
      if (s) edge.setStatus(s);
    }

    const stats = {
      nodeCount: scenario.nodes.length,
      edgeCount: scenario.edges.length,
      featureCount: scenario.nodes.filter(n => n.type === NodeType.FEATURE).length,
      storyCount: scenario.nodes.filter(n => n.type === NodeType.STORY).length,
      criterionCount: scenario.nodes.filter(n => n.type === NodeType.CRITERION).length,
      taskCount: scenario.nodes.filter(n => n.type === NodeType.TASK).length,
      principleCount: scenario.nodes.filter(n => n.type === NodeType.PRINCIPLE).length,
      assumptionCount: scenario.nodes.filter(n => n.type === NodeType.ASSUMPTION).length,
      questionCount: scenario.nodes.filter(n => n.type === NodeType.QUESTION).length,
      fileCount: scenario.nodes.filter(n => n.type === NodeType.FILE).length,
      hasCycles: cycleResult.hasCycles,
      cycleCount: cycleResult.cycleCount,
      cycles: cycleResult.cycles,
      orphanCount: cycleResult.orphanNodeIds.size,
      brokenEdgeCount: cycleResult.brokenEdges.length
    };

    const metadata = {
      loadedAt: new Date().toISOString(),
      source: 'synthetic_fallback',
      scenario: scenario.name,
      description: scenario.description,
      specDir: null,
      projectRoot,
      cycleSummary: cycleResult.summary,
      sccs: cycleResult.sccs
    };

    return {
      nodes: scenario.nodes,
      edges: scenario.edges,
      metadata,
      stats
    };
  }

  if (!resolved) {
    if (options.fallbackToSynthetic !== false) {
      return buildSyntheticFallback();
    }

    throw new Error(
      `Specification directory not found: "${specDir || '.spec'}". Ensure .spec exists or enable fallback.`
    );
  }

  // Parse discovered directory files
  let constitution = null;
  const constPath = path.join(resolved, 'constituicao.md');
  if (existsSync(constPath)) {
    try {
      const raw = readFileSync(constPath, 'utf-8');
      constitution = parseConstitution(raw, { file: constPath });
    } catch {
      // Non-fatal
    }
  }

  const features = [];
  const featuresRoot = path.join(resolved, 'features');

  if (existsSync(featuresRoot)) {
    try {
      const entries = readdirSync(featuresRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const featDir = path.join(featuresRoot, entry.name);
        const feat = { name: entry.name, dir: featDir, spec: null, tasks: null };

        const specPath = path.join(featDir, 'spec.md');
        if (existsSync(specPath)) {
          feat.spec = parseSpec(readFileSync(specPath, 'utf-8'), { file: specPath });
        }

        const tasksPath = path.join(featDir, 'tasks.md');
        if (existsSync(tasksPath)) {
          feat.tasks = parseTasks(readFileSync(tasksPath, 'utf-8'), { file: tasksPath });
        }

        features.push(feat);
      }
    } catch {
      // Non-fatal
    }
  } else {
    // Check if resolved directory itself contains spec.md and tasks.md
    const singleSpec = path.join(resolved, 'spec.md');
    if (existsSync(singleSpec)) {
      const featName = path.basename(resolved);
      const feat = { name: featName, dir: resolved, spec: null, tasks: null };
      feat.spec = parseSpec(readFileSync(singleSpec, 'utf-8'), { file: singleSpec });

      const singleTasks = path.join(resolved, 'tasks.md');
      if (existsSync(singleTasks)) {
        feat.tasks = parseTasks(readFileSync(singleTasks, 'utf-8'), { file: singleTasks });
      }
      features.push(feat);
    }
  }

  // Load verification results
  const verifications = {};
  const verifDir = path.join(resolved, 'verification');
  if (existsSync(verifDir)) {
    try {
      for (const entry of readdirSync(verifDir)) {
        if (!entry.endsWith('.json')) continue;
        const featKey = entry.replace(/\.json$/, '');
        try {
          const raw = readFileSync(path.join(verifDir, entry), 'utf-8');
          verifications[featKey] = JSON.parse(raw);
        } catch {
          // Ignore corrupted verification files
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // Optionally perform audit
  let auditFindings = [];
  if (options.runAudit !== false) {
    try {
      const syntheticProject = {
        config: {
          specDir: path.relative(projectRoot, resolved) || '.spec',
          testGlobs: ['test/**', 'src/**/*.test.*'],
          srcGlobs: ['src/**'],
          ignoreGlobs: ['node_modules/**']
        },
        rootDir: projectRoot,
        specRoot: resolved,
        features,
        constitution,
        verifications,
        srcFiles: [],
        testFiles: [],
        annotations: { specTags: [], principleTags: [] },
        errors: []
      };
      const res = auditProject(syntheticProject);
      if (Array.isArray(res)) {
        auditFindings = res;
      }
    } catch {
      // Non-fatal if audit engine encounters missing source files
    }
  }

  return convertProjectToGraph(
    {
      features,
      constitution,
      verifications,
      auditFindings
    },
    {
      ...options,
      source: 'sdd_specs',
      specDir: resolved,
      projectRoot
    }
  );
}
