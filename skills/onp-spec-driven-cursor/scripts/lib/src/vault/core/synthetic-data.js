/**
 * @file src/vault/core/synthetic-data.js
 * @description Controlled synthetic SDD graph datasets for automated validation and 3D visual verification.
 * Strictly adheres to R4: clean DAG, simple cycle, multi-cycle figure-8, disjoint hybrid, adversarial drift.
 * Pure ESM, zero external runtime dependencies. Node.js >= 18.
 */

import {
  VaultGraphNode,
  VaultGraphEdge,
  NodeType,
  EdgeType,
  NodeStatus,
  EdgeStatus
} from './graph-model.js';

/**
 * Scenario 1: Clean layered DAG with no circular dependencies.
 * Complete feature hierarchy with feature, stories, acceptance criteria, tasks, principles, and files.
 * @returns {{ name: string, description: string, nodes: VaultGraphNode[], edges: VaultGraphEdge[], expectedCycles: string[][] }}
 */
function createCleanDagScenario() {
  const nodes = [
    new VaultGraphNode({
      id: 'FEAT:auth',
      title: 'Autenticação e Sessão',
      type: NodeType.FEATURE,
      status: NodeStatus.VALID,
      snippet: '> feature: auth\n> status: implementada\nControle de acesso por token JWT e segurança de credenciais.',
      position: { x: 0, y: 0, z: 0 },
      mass: 2.5
    }),
    new VaultGraphNode({
      id: 'US-001',
      title: 'Login com Credenciais',
      type: NodeType.STORY,
      status: NodeStatus.VALID,
      snippet: 'Como usuário registrado, quero efetuar login para acessar o sistema.',
      position: { x: -140, y: 20, z: 0 },
      mass: 1.5
    }),
    new VaultGraphNode({
      id: 'US-002',
      title: 'Recuperação de Acesso',
      type: NodeType.STORY,
      status: NodeStatus.VALID,
      snippet: 'Como usuário que esqueceu a senha, quero receber um link seguro de redefinição.',
      position: { x: 140, y: -20, z: 0 },
      mass: 1.5
    }),
    new VaultGraphNode({
      id: 'AC-001',
      title: 'Credenciais Válidas',
      type: NodeType.CRITERION,
      status: 'pass',
      snippet: 'Dado usuário ativo e senha correta\nQuando envia formulário de login\nEntão recebe token JWT válido e status 200',
      position: { x: -220, y: -60, z: -80 }
    }),
    new VaultGraphNode({
      id: 'AC-002',
      title: 'Senha Incorreta',
      type: NodeType.CRITERION,
      status: 'pass',
      snippet: 'Dado usuário existente e senha incorreta\nQuando tenta efetuar login\nEntão recebe erro 401 e tentativa é registrada',
      position: { x: -220, y: 60, z: 80 }
    }),
    new VaultGraphNode({
      id: 'AC-003',
      title: 'Envio de Link de Redefinição',
      type: NodeType.CRITERION,
      status: 'pass',
      snippet: 'Dado e-mail cadastrado\nQuando solicita recuperação\nEntão e-mail com token temporário é despachado',
      position: { x: 220, y: 0, z: 0 }
    }),
    new VaultGraphNode({
      id: 'T-001',
      title: 'Implementar Rota POST /auth/login',
      type: NodeType.TASK,
      status: 'concluida',
      snippet: 'Refs: US-001, AC-001\nArquivos: src/auth/login.js',
      position: { x: -320, y: -90, z: -100 }
    }),
    new VaultGraphNode({
      id: 'T-002',
      title: 'Validar Rate-Limit e Sanitização',
      type: NodeType.TASK,
      status: 'concluida',
      snippet: 'Refs: AC-002\nArquivos: src/auth/login.js',
      position: { x: -320, y: 90, z: 100 }
    }),
    new VaultGraphNode({
      id: 'T-003',
      title: 'Disparador de Token por E-mail',
      type: NodeType.TASK,
      status: 'concluida',
      snippet: 'Refs: US-002, AC-003\nArquivos: src/auth/recovery.js',
      position: { x: 320, y: 0, z: 0 }
    }),
    new VaultGraphNode({
      id: 'P-001',
      title: 'Senhas Protegidas com Hash Forte',
      type: NodeType.PRINCIPLE,
      status: 'pass',
      snippet: 'P-001 [DEVE] Toda senha de usuário deve ser tratada com Argon2id ou bcrypt.',
      position: { x: 0, y: 220, z: 0 },
      mass: 1.8
    }),
    new VaultGraphNode({
      id: 'FILE:src/auth/login.js',
      title: 'src/auth/login.js',
      type: NodeType.FILE,
      status: NodeStatus.VALID,
      snippet: 'Módulo de autenticação e validação de sessão.',
      position: { x: -440, y: 0, z: 0 }
    }),
    new VaultGraphNode({
      id: 'FILE:src/auth/recovery.js',
      title: 'src/auth/recovery.js',
      type: NodeType.FILE,
      status: NodeStatus.VALID,
      snippet: 'Serviço de redefinição de credenciais.',
      position: { x: 440, y: 0, z: 0 }
    })
  ];

  const edges = [
    new VaultGraphEdge({ id: 'EDGE:FEAT:auth->US-001', source: 'FEAT:auth', target: 'US-001', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:FEAT:auth->US-002', source: 'FEAT:auth', target: 'US-002', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:US-001->AC-001', source: 'US-001', target: 'AC-001', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:US-001->AC-002', source: 'US-001', target: 'AC-002', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:US-002->AC-003', source: 'US-002', target: 'AC-003', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:T-001->AC-001', source: 'T-001', target: 'AC-001', type: EdgeType.IMPLEMENTS }),
    new VaultGraphEdge({ id: 'EDGE:T-002->AC-002', source: 'T-002', target: 'AC-002', type: EdgeType.IMPLEMENTS }),
    new VaultGraphEdge({ id: 'EDGE:T-003->AC-003', source: 'T-003', target: 'AC-003', type: EdgeType.IMPLEMENTS }),
    new VaultGraphEdge({ id: 'EDGE:T-001->FILE:src/auth/login.js', source: 'T-001', target: 'FILE:src/auth/login.js', type: 'touches' }),
    new VaultGraphEdge({ id: 'EDGE:T-002->FILE:src/auth/login.js', source: 'T-002', target: 'FILE:src/auth/login.js', type: 'touches' }),
    new VaultGraphEdge({ id: 'EDGE:T-003->FILE:src/auth/recovery.js', source: 'T-003', target: 'FILE:src/auth/recovery.js', type: 'touches' }),
    new VaultGraphEdge({ id: 'EDGE:P-001->FEAT:auth', source: 'P-001', target: 'FEAT:auth', type: EdgeType.CONSTRAINS })
  ];

  return {
    name: 'clean_dag',
    description: 'Clean layered DAG with no circular dependencies',
    nodes,
    edges,
    expectedCycles: []
  };
}

/**
 * Scenario 2: Simple 3-node directed cycle (A -> B -> C -> A).
 * Microservice call chain forming a circular deadlock.
 * @returns {{ name: string, description: string, nodes: VaultGraphNode[], edges: VaultGraphEdge[], expectedCycles: string[][] }}
 */
function createSimpleCycleScenario() {
  const nodes = [
    new VaultGraphNode({
      id: 'A',
      title: 'OrderService',
      type: NodeType.SERVICE,
      status: NodeStatus.VALID,
      snippet: 'Processa pedidos e checkout de vendas.',
      position: { x: -100, y: 0, z: -58 }
    }),
    new VaultGraphNode({
      id: 'B',
      title: 'PaymentService',
      type: NodeType.SERVICE,
      status: NodeStatus.VALID,
      snippet: 'Comunica com adquirentes e processa cartões.',
      position: { x: 100, y: 0, z: -58 }
    }),
    new VaultGraphNode({
      id: 'C',
      title: 'NotificationService',
      type: NodeType.SERVICE,
      status: NodeStatus.VALID,
      snippet: 'Dispara notificações e webhooks de eventos.',
      position: { x: 0, y: 0, z: 115 }
    })
  ];

  const edges = [
    new VaultGraphEdge({ id: 'e_AB', source: 'A', target: 'B', type: EdgeType.CALLS }),
    new VaultGraphEdge({ id: 'e_BC', source: 'B', target: 'C', type: EdgeType.CALLS }),
    new VaultGraphEdge({ id: 'e_CA', source: 'C', target: 'A', type: EdgeType.CALLS })
  ];

  return {
    name: 'simple_cycle',
    description: 'Triangular circular dependency (A -> B -> C -> A)',
    nodes,
    edges,
    expectedCycles: [['A', 'B', 'C', 'A']]
  };
}

/**
 * Scenario 3: Figure-8 intersecting multi-cycle.
 * Two distinct cycles sharing an articulation junction node C:
 * Cycle 1: A -> B -> C -> A
 * Cycle 2: C -> D -> E -> C
 * @returns {{ name: string, description: string, nodes: VaultGraphNode[], edges: VaultGraphEdge[], expectedCycles: string[][] }}
 */
function createMultiCycleFigure8Scenario() {
  const nodes = [
    new VaultGraphNode({
      id: 'A',
      title: 'Component A',
      type: NodeType.COMPONENT,
      status: NodeStatus.VALID,
      snippet: 'Componente do lobo esquerdo',
      position: { x: -180, y: 0, z: -90 }
    }),
    new VaultGraphNode({
      id: 'B',
      title: 'Component B',
      type: NodeType.COMPONENT,
      status: NodeStatus.VALID,
      snippet: 'Componente do lobo esquerdo',
      position: { x: -180, y: 0, z: 90 }
    }),
    new VaultGraphNode({
      id: 'C',
      title: 'Shared Articulation Node C',
      type: NodeType.COMPONENT,
      status: NodeStatus.VALID,
      snippet: 'Nó compartilhado no ponto de intersecção das duas órbitas',
      position: { x: 0, y: 0, z: 0 },
      mass: 3.0
    }),
    new VaultGraphNode({
      id: 'D',
      title: 'Component D',
      type: NodeType.COMPONENT,
      status: NodeStatus.VALID,
      snippet: 'Componente do lobo direito',
      position: { x: 180, y: 0, z: -90 }
    }),
    new VaultGraphNode({
      id: 'E',
      title: 'Component E',
      type: NodeType.COMPONENT,
      status: NodeStatus.VALID,
      snippet: 'Componente do lobo direito',
      position: { x: 180, y: 0, z: 90 }
    })
  ];

  const edges = [
    new VaultGraphEdge({ id: 'e_AB', source: 'A', target: 'B', type: EdgeType.DEPENDS_ON }),
    new VaultGraphEdge({ id: 'e_BC', source: 'B', target: 'C', type: EdgeType.DEPENDS_ON }),
    new VaultGraphEdge({ id: 'e_CA', source: 'C', target: 'A', type: EdgeType.DEPENDS_ON }),
    new VaultGraphEdge({ id: 'e_CD', source: 'C', target: 'D', type: EdgeType.DEPENDS_ON }),
    new VaultGraphEdge({ id: 'e_DE', source: 'D', target: 'E', type: EdgeType.DEPENDS_ON }),
    new VaultGraphEdge({ id: 'e_EC', source: 'E', target: 'C', type: EdgeType.DEPENDS_ON })
  ];

  return {
    name: 'multi_cycle_figure8',
    description: 'Two cycles intersecting at a shared articulation node (A -> B -> C -> A and C -> D -> E -> C)',
    nodes,
    edges,
    expectedCycles: [
      ['A', 'B', 'C', 'A'],
      ['C', 'D', 'E', 'C']
    ]
  };
}

/**
 * Scenario 4: Disjoint hybrid graph.
 * One isolated cyclic component and one completely healthy acyclic DAG component.
 * Verifies that the cycle detector and physics engine isolate cyclic perturbation without infecting valid subgraphs.
 * @returns {{ name: string, description: string, nodes: VaultGraphNode[], edges: VaultGraphEdge[], expectedCycles: string[][] }}
 */
function createDisjointHybridScenario() {
  const nodes = [
    // Healthy DAG component
    new VaultGraphNode({
      id: 'DAG:FEAT:reports',
      title: 'Relatórios de Gestão',
      type: NodeType.FEATURE,
      status: NodeStatus.VALID,
      snippet: 'Subgrafo acíclico válido de relatórios.',
      position: { x: -280, y: 0, z: 0 }
    }),
    new VaultGraphNode({
      id: 'DAG:US:summary',
      title: 'Sumário Executivo',
      type: NodeType.STORY,
      status: NodeStatus.VALID,
      snippet: 'Exportação consolidada em PDF.',
      position: { x: -380, y: 40, z: 0 }
    }),
    new VaultGraphNode({
      id: 'DAG:AC:export',
      title: 'Gerar PDF',
      type: NodeType.CRITERION,
      status: 'pass',
      snippet: 'Dado filtro temporal\nQuando solicita PDF\nEntão arquivo é gerado',
      position: { x: -460, y: 80, z: 0 }
    }),
    new VaultGraphNode({
      id: 'DAG:T:pdf',
      title: 'Renderizador PDFKit',
      type: NodeType.TASK,
      status: 'concluida',
      snippet: 'Tarefa de implementação do relatório.',
      position: { x: -540, y: 120, z: 0 }
    }),

    // Disjoint Cyclic component
    new VaultGraphNode({
      id: 'CYC:1',
      title: 'Microserviço Alpha',
      type: NodeType.SERVICE,
      status: NodeStatus.VALID,
      snippet: 'Serviço Alpha no cluster circular.',
      position: { x: 260, y: 0, z: -80 }
    }),
    new VaultGraphNode({
      id: 'CYC:2',
      title: 'Microserviço Beta',
      type: NodeType.SERVICE,
      status: NodeStatus.VALID,
      snippet: 'Serviço Beta no cluster circular.',
      position: { x: 380, y: 0, z: 0 }
    }),
    new VaultGraphNode({
      id: 'CYC:3',
      title: 'Microserviço Gamma',
      type: NodeType.SERVICE,
      status: NodeStatus.VALID,
      snippet: 'Serviço Gamma no cluster circular.',
      position: { x: 260, y: 0, z: 80 }
    })
  ];

  const edges = [
    // DAG edges
    new VaultGraphEdge({ id: 'EDGE:DAG:FEAT->US', source: 'DAG:FEAT:reports', target: 'DAG:US:summary', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:DAG:US->AC', source: 'DAG:US:summary', target: 'DAG:AC:export', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:DAG:T->AC', source: 'DAG:T:pdf', target: 'DAG:AC:export', type: EdgeType.IMPLEMENTS }),

    // Cyclic edges
    new VaultGraphEdge({ id: 'EDGE:CYC:1->2', source: 'CYC:1', target: 'CYC:2', type: EdgeType.CALLS }),
    new VaultGraphEdge({ id: 'EDGE:CYC:2->3', source: 'CYC:2', target: 'CYC:3', type: EdgeType.CALLS }),
    new VaultGraphEdge({ id: 'EDGE:CYC:3->1', source: 'CYC:3', target: 'CYC:1', type: EdgeType.CALLS })
  ];

  return {
    name: 'disjoint_hybrid',
    description: 'Disconnected graph with one cyclic component and one valid DAG component',
    nodes,
    edges,
    expectedCycles: [['CYC:1', 'CYC:2', 'CYC:3', 'CYC:1']]
  };
}

/**
 * Scenario 5: Adversarial drift.
 * Multi-feature graph with intentional cross-feature circular dependencies,
 * orphan nodes with zero connections, and broken dangling edges pointing to missing nodes.
 * @returns {{ name: string, description: string, nodes: VaultGraphNode[], edges: VaultGraphEdge[], expectedCycles: string[][] }}
 */
function createAdversarialDriftScenario() {
  const nodes = [
    // Feature 1: Billing
    new VaultGraphNode({
      id: 'FEAT:billing',
      title: 'Faturamento e Cobrança',
      type: NodeType.FEATURE,
      status: NodeStatus.VALID,
      position: { x: -250, y: 0, z: -150 }
    }),
    new VaultGraphNode({
      id: 'US:billing',
      title: 'Cobrança Automática',
      type: NodeType.STORY,
      status: NodeStatus.VALID,
      position: { x: -200, y: 0, z: -80 }
    }),
    new VaultGraphNode({
      id: 'AC:bill_charge',
      title: 'Débito Recorrente',
      type: NodeType.CRITERION,
      status: 'pass',
      position: { x: -120, y: 0, z: -30 }
    }),
    new VaultGraphNode({
      id: 'T:bill_charge',
      title: 'Executar Cobrança no Gateway',
      type: NodeType.TASK,
      status: 'em-andamento',
      position: { x: -50, y: 30, z: -40 }
    }),

    // Feature 2: Subscriptions
    new VaultGraphNode({
      id: 'FEAT:subscriptions',
      title: 'Gestão de Assinaturas',
      type: NodeType.FEATURE,
      status: NodeStatus.VALID,
      position: { x: 250, y: 0, z: -150 }
    }),
    new VaultGraphNode({
      id: 'US:subs',
      title: 'Renovação de Ciclo',
      type: NodeType.STORY,
      status: NodeStatus.VALID,
      position: { x: 200, y: 0, z: -80 }
    }),
    new VaultGraphNode({
      id: 'AC:sub_renew',
      title: 'Atualizar Validade do Acesso',
      type: NodeType.CRITERION,
      status: 'pass',
      position: { x: 120, y: 0, z: -30 }
    }),
    new VaultGraphNode({
      id: 'T:sub_renew',
      title: 'Renovar Assinatura no Banco',
      type: NodeType.TASK,
      status: 'em-andamento',
      position: { x: 50, y: 30, z: -40 }
    }),

    // Feature 3: Notifications
    new VaultGraphNode({
      id: 'FEAT:notifications',
      title: 'Serviço de Notificações',
      type: NodeType.FEATURE,
      status: NodeStatus.VALID,
      position: { x: 0, y: 0, z: 200 }
    }),
    new VaultGraphNode({
      id: 'US:notif',
      title: 'Envio de Recibo',
      type: NodeType.STORY,
      status: NodeStatus.VALID,
      position: { x: 0, y: 0, z: 120 }
    }),
    new VaultGraphNode({
      id: 'AC:notif_receipt',
      title: 'Recibo por E-mail',
      type: NodeType.CRITERION,
      status: 'pass',
      position: { x: 0, y: 0, z: 50 }
    }),
    new VaultGraphNode({
      id: 'T:notif_receipt',
      title: 'Enviar E-mail com Comprovante',
      type: NodeType.TASK,
      status: 'em-andamento',
      position: { x: 0, y: -40, z: 30 }
    }),

    // Orphan isolated node
    new VaultGraphNode({
      id: 'ASM:orphan_question',
      title: 'Suposição Abandonada Sem Conexão',
      type: NodeType.ASSUMPTION,
      status: 'aberta',
      snippet: 'Nó órfão com grau 0 para testar detecção de orfandade.',
      position: { x: 350, y: 150, z: 350 }
    })
  ];

  const edges = [
    // Containment
    new VaultGraphEdge({ id: 'EDGE:FEAT:billing->US', source: 'FEAT:billing', target: 'US:billing', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:US:billing->AC', source: 'US:billing', target: 'AC:bill_charge', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:FEAT:subs->US', source: 'FEAT:subscriptions', target: 'US:subs', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:US:subs->AC', source: 'US:subs', target: 'AC:sub_renew', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:FEAT:notif->US', source: 'FEAT:notifications', target: 'US:notif', type: EdgeType.CONTAINS }),
    new VaultGraphEdge({ id: 'EDGE:US:notif->AC', source: 'US:notif', target: 'AC:notif_receipt', type: EdgeType.CONTAINS }),

    // Cross-feature circular task dependencies:
    // T:bill_charge -> T:notif_receipt -> T:sub_renew -> T:bill_charge
    new VaultGraphEdge({ id: 'EDGE:CROSS:bill->notif', source: 'T:bill_charge', target: 'T:notif_receipt', type: EdgeType.DEPENDS_ON }),
    new VaultGraphEdge({ id: 'EDGE:CROSS:notif->sub', source: 'T:notif_receipt', target: 'T:sub_renew', type: EdgeType.DEPENDS_ON }),
    new VaultGraphEdge({ id: 'EDGE:CROSS:sub->bill', source: 'T:sub_renew', target: 'T:bill_charge', type: EdgeType.DEPENDS_ON }),

    // Broken reference edge (points to nonexistent target node)
    new VaultGraphEdge({ id: 'EDGE:BROKEN:missing_target', source: 'T:bill_charge', target: 'NON_EXISTENT_AC', type: EdgeType.IMPLEMENTS })
  ];

  return {
    name: 'adversarial_drift',
    description: 'Complex multi-feature graph with intentional circular cross-feature dependencies',
    nodes,
    edges,
    expectedCycles: [
      ['T:bill_charge', 'T:notif_receipt', 'T:sub_renew', 'T:bill_charge']
    ]
  };
}

const SCENARIO_BUILDERS = Object.freeze({
  clean_dag: createCleanDagScenario,
  simple_cycle: createSimpleCycleScenario,
  multi_cycle_figure8: createMultiCycleFigure8Scenario,
  disjoint_hybrid: createDisjointHybridScenario,
  adversarial_drift: createAdversarialDriftScenario
});

/**
 * Returns a list of all available synthetic scenario names.
 * @returns {string[]}
 */
export function listSyntheticScenarios() {
  return Object.keys(SCENARIO_BUILDERS);
}

/**
 * Instantiates and returns a specific synthetic scenario by name.
 * Generates fresh object instances on each invocation.
 *
 * @param {string} name - One of 'clean_dag', 'simple_cycle', 'multi_cycle_figure8', 'disjoint_hybrid', 'adversarial_drift'
 * @returns {{ name: string, description: string, nodes: VaultGraphNode[], edges: VaultGraphEdge[], expectedCycles: string[][] }}
 */
export function getSyntheticScenario(name) {
  const builder = SCENARIO_BUILDERS[name];
  if (!builder) {
    throw new Error(
      `Unknown synthetic scenario: "${name}". Available scenarios: ${listSyntheticScenarios().join(', ')}`
    );
  }
  return builder();
}

/**
 * Returns a dictionary containing instances of all synthetic scenarios.
 * @returns {Record<string, { name: string, description: string, nodes: VaultGraphNode[], edges: VaultGraphEdge[], expectedCycles: string[][] }>}
 */
export function getSyntheticScenarios() {
  const result = {};
  for (const name of listSyntheticScenarios()) {
    result[name] = getSyntheticScenario(name);
  }
  return result;
}
