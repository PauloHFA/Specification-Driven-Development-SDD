/**
 * @file src/vault/core/graph-model.js
 * @description Pure ESM classes, schemas, status enums, and integrity tags for the 3D Vault Spatial Knowledge Graph.
 * Zero external runtime dependencies. Node.js >= 18.
 */

export const NodeStatus = Object.freeze({
  VALID: 'valid',       // Healthy, connected node in an acyclic subgraph
  CIRCULAR: 'circular', // Participating in at least one directed cycle
  BROKEN: 'broken',     // Referenced by an edge but missing or corrupted
  ORPHAN: 'orphan'      // Isolated node with 0 degree (no incoming or outgoing edges)
});

export const EdgeStatus = Object.freeze({
  VALID: 'valid',       // Acyclic valid directed connection
  CIRCULAR: 'circular', // Involved in at least one directed cycle (triggers red vibration)
  BROKEN: 'broken',     // Endpoint node is missing or nonexistent in graph
  ERROR: 'error'        // Validation error or broken reference
});

export const IntegrityTag = Object.freeze({
  CLEAN: 'CLEAN',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  SELF_LOOP: 'SELF_LOOP',
  ORPHAN_NODE: 'ORPHAN_NODE',
  BROKEN_REFERENCE: 'BROKEN_REFERENCE',
  MISSING_SOURCE: 'MISSING_SOURCE',
  MISSING_TARGET: 'MISSING_TARGET',
  DUPLICATE_EDGE: 'DUPLICATE_EDGE'
});

export const NodeType = Object.freeze({
  FEATURE: 'feature',
  STORY: 'story',
  CRITERION: 'criterion',
  TASK: 'task',
  PRINCIPLE: 'principle',
  ASSUMPTION: 'assumption',
  QUESTION: 'question',
  FILE: 'file',
  TEST: 'test',
  COMPONENT: 'component',
  SERVICE: 'service',
  GENERIC: 'generic'
});

export const EdgeType = Object.freeze({
  CONTAINS: 'contains',
  IMPLEMENTS: 'implements',
  MODIFIES: 'modifies',
  VERIFIES: 'verifies',
  CONSTRAINS: 'constrains',
  CALLS: 'calls',
  DEPENDS_ON: 'depends_on',
  GENERIC: 'generic'
});

/**
 * Node entity in the 3D Knowledge Graph.
 */
export class VaultGraphNode {
  /**
   * @param {Object} [options={}]
   * @param {string} options.id - Unique node identifier
   * @param {string} [options.title] - Descriptive label
   * @param {string} [options.type] - One of NodeType
   * @param {string} [options.status] - One of NodeStatus
   * @param {string} [options.snippet] - Markdown, GWT or code snippet
   * @param {Object} [options.position] - 3D spatial coordinates {x, y, z}
   * @param {Object} [options.velocity] - Physical velocity {x, y, z}
   * @param {number} [options.mass=1.0] - Physical mass
   * @param {string[]} [options.tags] - Array of integrity tags
   * @param {Object[]} [options.auditFindings] - Associated audit findings
   * @param {Object} [options.metadata] - Arbitrary additional metadata
   */
  constructor(options = {}) {
    if (!options.id || typeof options.id !== 'string') {
      throw new TypeError('VaultGraphNode requires a non-empty string "id".');
    }
    this.id = options.id;
    this.title = options.title || options.id;
    this.type = options.type || NodeType.GENERIC;
    this.status = options.status || NodeStatus.VALID;
    this.snippet = options.snippet || '';
    this.position = {
      x: Number.isFinite(options.position?.x) ? Number(options.position.x) : 0,
      y: Number.isFinite(options.position?.y) ? Number(options.position.y) : 0,
      z: Number.isFinite(options.position?.z) ? Number(options.position.z) : 0
    };
    this.velocity = {
      x: Number.isFinite(options.velocity?.x) ? Number(options.velocity.x) : 0,
      y: Number.isFinite(options.velocity?.y) ? Number(options.velocity.y) : 0,
      z: Number.isFinite(options.velocity?.z) ? Number(options.velocity.z) : 0
    };
    this.mass = typeof options.mass === 'number' && options.mass > 0 ? options.mass : 1.0;
    this.tags = new Set(Array.isArray(options.tags) ? options.tags : []);
    this.auditFindings = Array.isArray(options.auditFindings) ? [...options.auditFindings] : [];
    this.metadata = options.metadata ? { ...options.metadata } : {};
  }

  /**
   * Updates node status and synchronizes corresponding integrity tags.
   * @param {string} status
   * @returns {this}
   */
  setStatus(status) {
    if (!Object.values(NodeStatus).includes(status)) {
      throw new Error(`Invalid NodeStatus: "${status}"`);
    }
    this.status = status;
    if (status === NodeStatus.CIRCULAR) {
      this.tags.add(IntegrityTag.CIRCULAR_DEPENDENCY);
    } else if (status === NodeStatus.ORPHAN) {
      this.tags.add(IntegrityTag.ORPHAN_NODE);
    } else if (status === NodeStatus.BROKEN) {
      this.tags.add(IntegrityTag.BROKEN_REFERENCE);
    }
    return this;
  }

  /**
   * Adds an integrity tag.
   * @param {string} tag
   * @returns {this}
   */
  addTag(tag) {
    this.tags.add(tag);
    return this;
  }

  /**
   * Removes an integrity tag.
   * @param {string} tag
   * @returns {this}
   */
  removeTag(tag) {
    this.tags.delete(tag);
    return this;
  }

  /**
   * Checks if node has a specific tag.
   * @param {string} tag
   * @returns {boolean}
   */
  hasTag(tag) {
    return this.tags.has(tag);
  }

  /**
   * Records an audit finding and flags severe issues.
   * @param {Object} finding
   * @returns {this}
   */
  addAuditFinding(finding) {
    if (finding && typeof finding === 'object') {
      this.auditFindings.push(finding);
      if (finding.severity === 'erro' || finding.severity === 'error') {
        this.addTag(IntegrityTag.BROKEN_REFERENCE);
      }
    }
    return this;
  }

  /**
   * Sets node continuous 3D position coordinates.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {this}
   */
  setPosition(x, y, z) {
    this.position.x = Number.isFinite(x) ? Number(x) : 0;
    this.position.y = Number.isFinite(y) ? Number(y) : 0;
    this.position.z = Number.isFinite(z) ? Number(z) : 0;
    return this;
  }

  /**
   * Deep clone of node instance.
   * @returns {VaultGraphNode}
   */
  clone() {
    return new VaultGraphNode({
      id: this.id,
      title: this.title,
      type: this.type,
      status: this.status,
      snippet: this.snippet,
      position: { ...this.position },
      velocity: { ...this.velocity },
      mass: this.mass,
      tags: Array.from(this.tags),
      auditFindings: this.auditFindings.map(f => ({ ...f })),
      metadata: { ...this.metadata }
    });
  }

  /**
   * Plain JSON serializable representation.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      type: this.type,
      status: this.status,
      snippet: this.snippet,
      position: { ...this.position },
      velocity: { ...this.velocity },
      mass: this.mass,
      tags: Array.from(this.tags),
      auditFindings: this.auditFindings,
      metadata: this.metadata
    };
  }

  /**
   * Factory constructing a VaultGraphNode from JSON.
   * @param {Object} data
   * @returns {VaultGraphNode}
   */
  static fromJSON(data) {
    return new VaultGraphNode(data);
  }
}

/**
 * Directed connection between two nodes in the 3D Knowledge Graph.
 */
export class VaultGraphEdge {
  /**
   * @param {Object} [options={}]
   * @param {string} options.source - Source node ID
   * @param {string} options.target - Target node ID
   * @param {string} [options.id] - Edge ID (defaults to "source->target")
   * @param {string} [options.type] - One of EdgeType
   * @param {boolean} [options.directed=true]
   * @param {string} [options.status] - One of EdgeStatus
   * @param {string[]} [options.tags]
   * @param {Object} [options.metadata]
   * @param {Object} [options.visualStyle]
   */
  constructor(options = {}) {
    if (!options.source || typeof options.source !== 'string') {
      throw new TypeError('VaultGraphEdge requires a non-empty string "source".');
    }
    if (!options.target || typeof options.target !== 'string') {
      throw new TypeError('VaultGraphEdge requires a non-empty string "target".');
    }
    this.source = options.source;
    this.target = options.target;
    this.id = options.id || `${this.source}->${this.target}`;
    this.type = options.type || EdgeType.DEPENDS_ON;
    this.directed = options.directed !== undefined ? Boolean(options.directed) : true;
    this.status = options.status || EdgeStatus.VALID;
    this.tags = new Set(Array.isArray(options.tags) ? options.tags : []);
    this.metadata = options.metadata ? { ...options.metadata } : {};

    // Visual & physical elastic parameters
    const vs = options.visualStyle || {};
    this.visualStyle = {
      color: vs.color || this._defaultColorForStatus(this.status),
      stiffness: typeof vs.stiffness === 'number' ? vs.stiffness : 0.25,
      damping: typeof vs.damping === 'number' ? vs.damping : 0.85,
      restLength: typeof vs.restLength === 'number' ? vs.restLength : 80.0,
      amplitude: typeof vs.amplitude === 'number' ? vs.amplitude : 5.0,
      frequency: typeof vs.frequency === 'number' ? vs.frequency : 12.0
    };
  }

  /**
   * Returns default visual color corresponding to edge status.
   * @private
   * @param {string} status
   * @returns {string} Hex color
   */
  _defaultColorForStatus(status) {
    switch (status) {
      case EdgeStatus.CIRCULAR:
        return '#ef4444'; // Glowing neon crimson
      case EdgeStatus.BROKEN:
      case EdgeStatus.ERROR:
        return '#f59e0b'; // Warning amber
      case EdgeStatus.VALID:
      default:
        return '#38bdf8'; // Vibrant sky blue
    }
  }

  /**
   * Indicates whether this edge is vibrating.
   * @returns {boolean}
   */
  get isVibrating() {
    return this.status === EdgeStatus.CIRCULAR;
  }

  /**
   * Explicitly sets vibration state or triggers circular status.
   * @param {boolean} val
   */
  set isVibrating(val) {
    if (val) {
      this.setStatus(EdgeStatus.CIRCULAR);
    } else if (this.status === EdgeStatus.CIRCULAR) {
      this.setStatus(EdgeStatus.VALID);
    }
  }

  /**
   * Updates edge status, color, and integrity tags.
   * @param {string} status
   * @returns {this}
   */
  setStatus(status) {
    if (!Object.values(EdgeStatus).includes(status)) {
      throw new Error(`Invalid EdgeStatus: "${status}"`);
    }
    this.status = status;
    this.visualStyle.color = this._defaultColorForStatus(status);
    if (status === EdgeStatus.CIRCULAR) {
      this.tags.add(IntegrityTag.CIRCULAR_DEPENDENCY);
    } else if (status === EdgeStatus.BROKEN || status === EdgeStatus.ERROR) {
      this.tags.add(IntegrityTag.BROKEN_REFERENCE);
    }
    return this;
  }

  /**
   * Adds an integrity tag.
   * @param {string} tag
   * @returns {this}
   */
  addTag(tag) {
    this.tags.add(tag);
    return this;
  }

  /**
   * Removes an integrity tag.
   * @param {string} tag
   * @returns {this}
   */
  removeTag(tag) {
    this.tags.delete(tag);
    return this;
  }

  /**
   * Checks if edge has a specific tag.
   * @param {string} tag
   * @returns {boolean}
   */
  hasTag(tag) {
    return this.tags.has(tag);
  }

  /**
   * Returns canonical key string "source->target".
   * @returns {string}
   */
  getKey() {
    return `${this.source}->${this.target}`;
  }

  /**
   * Deep clone of edge instance.
   * @returns {VaultGraphEdge}
   */
  clone() {
    return new VaultGraphEdge({
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      directed: this.directed,
      status: this.status,
      tags: Array.from(this.tags),
      metadata: { ...this.metadata },
      visualStyle: { ...this.visualStyle }
    });
  }

  /**
   * Plain JSON serializable representation.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      directed: this.directed,
      status: this.status,
      isVibrating: this.isVibrating,
      tags: Array.from(this.tags),
      metadata: this.metadata,
      visualStyle: { ...this.visualStyle }
    };
  }

  /**
   * Factory constructing a VaultGraphEdge from JSON.
   * @param {Object} data
   * @returns {VaultGraphEdge}
   */
  static fromJSON(data) {
    return new VaultGraphEdge(data);
  }
}

/**
 * High-level container graph maintaining index structures.
 */
export class VaultGraph {
  /**
   * @param {Object} [options={}]
   * @param {Array<VaultGraphNode|Object>} [options.nodes]
   * @param {Array<VaultGraphEdge|Object>} [options.edges]
   */
  constructor(options = {}) {
    this.nodes = new Map();
    this.edges = new Map();
    this.outAdj = new Map();
    this.inAdj = new Map();

    if (Array.isArray(options.nodes)) {
      for (const n of options.nodes) this.addNode(n);
    }
    if (Array.isArray(options.edges)) {
      for (const e of options.edges) this.addEdge(e);
    }
  }

  /**
   * Adds a node to the graph and initializes adjacency lists.
   * @param {VaultGraphNode|Object} node
   * @returns {VaultGraphNode}
   */
  addNode(node) {
    const n = node instanceof VaultGraphNode ? node : new VaultGraphNode(node);
    this.nodes.set(n.id, n);
    if (!this.outAdj.has(n.id)) this.outAdj.set(n.id, []);
    if (!this.inAdj.has(n.id)) this.inAdj.set(n.id, []);
    return n;
  }

  /**
   * Adds an edge to the graph and updates incoming/outgoing indexes.
   * @param {VaultGraphEdge|Object} edge
   * @returns {VaultGraphEdge}
   */
  addEdge(edge) {
    const e = edge instanceof VaultGraphEdge ? edge : new VaultGraphEdge(edge);
    this.edges.set(e.id, e);
    if (!this.outAdj.has(e.source)) this.outAdj.set(e.source, []);
    if (!this.inAdj.has(e.target)) this.inAdj.set(e.target, []);
    this.outAdj.get(e.source).push(e);
    this.inAdj.get(e.target).push(e);
    return e;
  }

  /**
   * Retrieves a node by ID.
   * @param {string} id
   * @returns {VaultGraphNode|undefined}
   */
  getNode(id) {
    return this.nodes.get(id);
  }

  /**
   * Retrieves an edge by ID.
   * @param {string} id
   * @returns {VaultGraphEdge|undefined}
   */
  getEdge(id) {
    return this.edges.get(id);
  }

  /**
   * Checks if node ID exists.
   * @param {string} id
   * @returns {boolean}
   */
  hasNode(id) {
    return this.nodes.has(id);
  }

  /**
   * Returns outgoing edges for node ID.
   * @param {string} id
   * @returns {VaultGraphEdge[]}
   */
  getOutgoing(id) {
    return this.outAdj.get(id) || [];
  }

  /**
   * Returns incoming edges for node ID.
   * @param {string} id
   * @returns {VaultGraphEdge[]}
   */
  getIncoming(id) {
    return this.inAdj.get(id) || [];
  }

  /**
   * Returns total degree (in-degree + out-degree) of node.
   * @param {string} id
   * @returns {number}
   */
  getDegree(id) {
    return (this.outAdj.get(id)?.length || 0) + (this.inAdj.get(id)?.length || 0);
  }

  /**
   * Exports plain JSON representation of graph.
   * @returns {{ nodes: Object[], edges: Object[] }}
   */
  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
      edges: Array.from(this.edges.values()).map(e => e.toJSON())
    };
  }
}
