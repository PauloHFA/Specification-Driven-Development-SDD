# Handoff Report — Survey Spec Miner 1
**Mission**: Investigation and Specification of SDD Specifications, Schemas, Hierarchies, Parser Requirements, and Synthetic Datasets for the 3D Documentation & Diagram Vault (Spatial Knowledge Graph).

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Specification Grammar | `spec.md` Parsing | Extracts Feature name, Status, User Stories (`US-xxx`), Acceptance Criteria (`AC-xxx`), Assumptions (`ASM-xxx`), and Open Questions (`Q-xxx`). | Markdown content of `spec.md` | Object `{ file, title, feature, status, stories, assumptions, questions, parseIssues, sections }` | Generates parse issues: `ID_CURTO`, `AC_FORA_DE_US`, `ASM_ID_INVALIDO`, `Q_ID_INVALIDO` | `src/parsers/spec.js`, `test/parsers.test.js` |
| 2 | Specification Grammar | Given/When/Then (GWT) Clauses | Extracts Gherkin-like clauses (`Dado`, `Quando`, `Então`/`Entao`, and continuation `E`). Supports indentation and case-insensitivity. | List items matching `^[-*]\s*\*\*(Dado\|Quando\|Então\|E)\*\*` | Categorized arrays `given[]`, `when[]`, `then[]` on each AC | Audit emits `AC_INCOMPLETO` if any of Dado, Quando, Então is missing | `src/parsers/spec.js:16`, `test/parsers.test.js:45` |
| 3 | Specification Grammar | Assumptions & Questions Tables | Markdown tables under `## Suposições` and `## Perguntas em aberto`. Assumptions track `aberta\|confirmada\|invalidada`. Questions track `aberta\|respondida`. | Table rows with columns `ID`, `Texto`, `Status`, `Resolução/Resposta` | Structured lists in `spec.assumptions` and `spec.questions` | `ASM_ABERTA` (error if feature is `implementada`/`auditada`), `Q_ABERTA`, `SECAO_AUSENTE` | `src/parsers/spec.js:148`, `src/core/audit.js:199` |
| 4 | Task Management | `tasks.md` Parsing | Extracts Tasks (`T-xxx`), normalized status (`pendente\|em-andamento\|concluida`), referenced stories/criteria (`Refs:`), files modified (`Arquivos:`), model, and effort. | Markdown content of `tasks.md` | Object `{ file, tasks: [{ id, title, status, refs, files, model, esforco }] }` | `TASK_STATUS_INVALIDO` if bracketed token unknown, `TASK_SEM_STATUS` fallback to pendente | `src/parsers/tasks.js`, `test/parsers.test.js:96` |
| 5 | Constitution & Governance | `constituicao.md` Principles | Parses architectural principles (`P-xxx`) with obligation level (`[DEVE]`, `[RECOMENDADO]`, `[PODE]`) and executable checks. | Markdown content of `constituicao.md` | Object `{ version, principles: [{ id, level, title, checks }] }` | `NIVEL_INVALIDO` (falls back safely to `DEVE`), `PRINCIPIO_SEM_VERIFICACAO`, `PRINCIPIO_VIOLADO` | `src/parsers/constitution.js`, `test/parsers.test.js:122` |
| 6 | Code/Test Traceability | Test & Principle Annotations | Scans test/source code for `@spec:AC-xxx` and `@principle:P-xxx` tags in test titles and comments across multiple languages. | Files matching test/src globs | Arrays `specTags: [{ acId, file, line, text }]`, `principleTags` | `AC_SEM_TESTE` if AC has 0 tags; `TESTE_ORFAO` if test references nonexistent AC | `src/parsers/annotations.js`, `src/core/audit.js:326` |
| 7 | Verification Engine | Test Runner Proof Ledger | Reads `.spec/verification/<feature>.json` populated by `onp-spec verify` with test verdicts (`pass`, `fail`, `skip`). | JSON verification file, test output | Result map per AC and principle | `AC_SEM_PROVA` if missing/fail/skip; `VERIFY_OBSOLETO` if code modified after verify | `src/core/verify.js`, `examples/inscricao-turma/.spec/verification/` |
| 8 | Execution Planning | Task Conflict Graph (Faixas) | Computes connected components of file access to form parallel execution lanes (`faixas`) and sequential queues. | List of pending tasks and their `Arquivos:` sets | Array of execution lanes (`faixas`), worktrees, and branches | Warns on tasks without `Arquivos:` (forced sequential) | `src/core/plano.js:205` |
| 9 | 3D Spatial Knowledge Graph | SDD Graph Parser (New Requirement) | Ingests `.spec/`, codebase files, verification records, and audit findings, transforming them into 3D nodes and directed edges. | Spec root path, project files, verification JSONs | Graph JSON: `{ nodes: GraphNode[], edges: GraphEdge[], stats }` | Flagging broken refs (`REF_QUEBRADA`), orphan tests (`TESTE_ORFAO`), unverified criteria | R1, R2, R3 in `ORIGINAL_REQUEST.md` |
| 10 | Graph Integrity & Physics | Cycle Detection & Elastic Error Simulation | Traversal algorithm detecting directed cycles (e.g. A -> B -> C -> A) and validation failures, driving vibrating elastic line animations in 3D. | Directed edge list | Detected cycle loops, flagged edge status (`circular_error`), vibration triggers | Vibrating crimson lines in 3D; stable standard color lines for valid DAGs | R2, R4 in `ORIGINAL_REQUEST.md` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `parseSpec` | Clause `E` after `Dado`, `Quando`, or `Então` | `src/parsers/spec.js:139-144`: continues the most recently populated clause array (e.g. if `then` has items, `E` appends to `then`). |
| 2 | `parseSpec` | Accented characters in section headers (NFD vs NFC) | `src/parsers/spec.js:25-30`: normalizes with `NFD` and strips accents so `## Suposições` and `## Suposicoes` are both recognized. |
| 3 | `parseSpec` | IDs with fewer than 3 digits (e.g. `US-1`, `AC-2`) | `src/parsers/spec.js:18-20,86-93`: matched by `RE_SHORT_ID` and flags warning `ID_CURTO` suggesting padded format (`US-001`). |
| 4 | `parseTasks` | Task status with accents or casing (`[concluída]`, `[Concluida]`, `[EM-ANDAMENTO]`) | `src/parsers/tasks.js:38`: folded via `foldStatus()` to lower-case unaccented canonical token (`concluida`, `em-andamento`). |
| 5 | `parseTasks` | File paths containing spaces (`Arquivos: src/meu arquivo.js, src/outro.js`) | `src/parsers/tasks.js:87-95`: split strictly by comma `,` rather than whitespace, preserving paths with spaces intact. |
| 6 | `parseConstitution` | Unknown obligation level in principle (e.g. `[OBRIGATORIO]`) | `src/parsers/constitution.js:52-71`: generates `NIVEL_INVALIDO` parse issue but does NOT discard principle; assigns `DEVE` as safest conservative default. |
| 7 | `grepPattern` | ReDoS / Catastrophic backtracking regex in constitution check | `src/parsers/annotations.js:100-154`: executed in a sandboxed subprocess with strict 5000ms timeout; kills process and flags descriptive timeout error. |
| 8 | `auditProject` | AC verified with skipped/todo status in TAP or JSON reporter | `src/core/verify.js` & `src/core/audit.js:350-356`: `# SKIP` or `skipped`/`pending`/`todo` yields `status: skip`, which does NOT satisfy audit and emits `AC_SEM_PROVA`. |
| 9 | `auditProject` | Cross-feature task references (Task in Feature B references AC in Feature A) | `src/core/audit.js:78-92,264-276`: supported! IDs are globally unique across all features; cross-feature refs successfully cover ACs without `REF_QUEBRADA`. |
| 10 | SDD Graph Parser | Circular dependency between components or tasks (A -> B -> C -> A) | Must be detected by cycle detection algorithm (Tarjan/DFS), marking involved edges with `status: 'circular_error'` and `isVibrating: true`. |

---

## 1. Observation

### 1.1 Specification Files and Structure in the Codebase
Direct inspection of `c:\Projetos\Specification-Driven-Development-SDD` revealed:
- There is a complete reference implementation and real specification directory at `examples/inscricao-turma/.spec/`:
  - `examples/inscricao-turma/.spec/constituicao.md` (66 lines, 2506 bytes):
    - Constitution v1.0.0 (preset: LGPD + Educação)
    - Principles defined:
      - `P-001 [DEVE] Nota de um aluno nunca é exposta a outro aluno` (check: `verificação(teste): @principle:P-001`)
      - `P-002 [DEVE] Acesso a nota é registrado (trilha de auditoria)` (check: `verificação(teste): @principle:P-002`)
      - `P-003 [DEVE] Dados de menores só com base legal explícita` (check: `verificação(teste): @principle:P-003`)
      - `P-004 [DEVE] Dados pessoais nunca aparecem em logs` (check: `verificação(proibido): console\.(log|error|warn)\(.*(cpf|nota|email|telefone) em src/**/*.js`)
      - `P-005 [RECOMENDADO] Minimização: só coletar o que a pedagogia exige`
      - `P-006 [RECOMENDADO] Erro pedagógico não é dado punitivo`
      - `P-007 [PODE] Exclusão a pedido do titular`
      - `P-008 [PODE] Portabilidade dos dados do aluno`
  - `examples/inscricao-turma/.spec/features/inscricao-turma/spec.md` (59 lines, 1962 bytes):
    - Metadata: `> feature: inscricao-turma`, `> status: implementada`
    - Stories:
      - `US-001 — Aluno se inscreve em turma aberta`
        - `AC-001 — Inscrição em turma com vaga` (Dado turma aberta, Quando envia dados, Então inscrição registrada)
        - `AC-002 — Turma lotada recusa inscrição` (Dado turma sem vagas, Quando tenta inscrever, Então recusada "turma lotada")
      - `US-002 — Menor de idade exige consentimento`
        - `AC-003 — Inscrição de menor sem consentimento é bloqueada` (Dado idade < 18, Quando tenta concluir, Então bloqueada)
    - Assumptions table:
      - `ASM-001` | "E-mail é o identificador único do aluno" | status: `confirmada` | resolução: "decidido com o produto em 17/07"
      - `ASM-002` | "Idade é auto-declarada no formulário" | status: `confirmada` | resolução: "MVP não valida documento"
    - Open questions table:
      - `Q-001` | "Guardamos o e-mail do responsável separado do e-mail do aluno?" | status: `respondida` | resposta: "sim, campo próprio"
  - `examples/inscricao-turma/.spec/features/inscricao-turma/tasks.md` (19 lines, 430 bytes):
    - `T-001 — Registrar inscrição e decrementar vaga [concluida]` (Refs: `US-001, AC-001`, Arquivos: `src/inscricao.js`)
    - `T-002 — Recusar inscrição em turma lotada [concluida]` (Refs: `AC-002`, Arquivos: `src/inscricao.js`)
    - `T-003 — Exigir consentimento de responsável para menor [concluida]` (Refs: `US-002, AC-003`, Arquivos: `src/inscricao.js`)
  - `examples/inscricao-turma/.spec/verification/inscricao-turma.json` (41 lines, 1059 bytes):
    - JSON results recording AC proof statuses: `AC-001` (pass), `AC-002` (pass), `AC-003` (pass), `P-001` (pass), `P-002` (pass), `P-003` (pass).
  - `examples/inscricao-turma/test/inscricao.spec.test.js`:
    - Tests tagged with `@spec:AC-001`, `@spec:AC-002`, `@spec:AC-003`, and `@principle:P-001`, `@principle:P-002`, `@principle:P-003`.
- Templates directory `templates/`:
  - `templates/spec.md`: standard template containing placeholders `{{TITULO}}`, `{{FEATURE}}`, stories `### US-001`, criteria `#### AC-001`, assumptions table, questions table.
  - `templates/tasks.md`: standard template containing `## T-001 — [título] [pendente]`, `- Refs: US-001, AC-001`, `- Arquivos: src/exemplo.js`, `- Notas: [decisões, dependências de outras tarefas]`.
  - `templates/constituicao-base.md`: base principles (`P-001 [DEVE]`, `P-002 [RECOMENDADO]`).
  - `templates/constituicao-lgpd-educacao.md`: LGPD principles.

### 1.2 Parsing Logic in `src/parsers/`
1. `src/parsers/spec.js`:
   - Line 12: `RE_META = /^>\s*(feature|status)\s*:\s*(.+?)\s*$/;`
   - Line 13: `RE_STORY = new RegExp('^###\\s+(US-\\d{3,})\\s*' + DASH + '\\s*(.+?)\\s*$');`
   - Line 14: `RE_AC = new RegExp('^####\\s+(AC-\\d{3,})\\s*' + DASH + '\\s*(.+?)\\s*$');`
   - Line 16: `RE_GWT = /^\s*[-*]\s*\*\*(Dado|Quando|Então|Entao|E)\*\*\s*(.+?)\s*$/i;`
   - Line 17: `RE_SECTION = /^##\s+(.+?)\s*$/;`
   - Line 19: `RE_SHORT_ID = /^#{3,4}\s+((?:US|AC)-\d{1,2})\b/;`
   - Allowed Spec Statuses: `['rascunho', 'pronta', 'em-implementacao', 'implementada', 'auditada']`.
   - Allowed Assumption Statuses: `['aberta', 'confirmada', 'invalidada']`.
   - Allowed Question Statuses: `['aberta', 'respondida']`.

2. `src/parsers/tasks.js`:
   - Line 13: `RE_TASK_ANY = new RegExp('^##\\s+(T-\\d{3,})\\s*' + DASH + '\\s*(.+?)\\s*$');`
   - Line 14: `RE_STATUS_SUFFIX = /^(.*?)\s*\[([^\]]+)\]\s*$/;`
   - Line 15: `RE_REFS = /^\s*[-*]\s*Refs\s*:\s*(.+?)\s*$/i;`
   - Line 16: `RE_FILES = /^\s*[-*]\s*Arquivos\s*:\s*(.+?)\s*$/i;`
   - Allowed Task Statuses: `['pendente', 'em-andamento', 'concluida']`.

3. `src/parsers/constitution.js`:
   - Line 14: `RE_PRINCIPLE = /^##\s+(P-\d{3,})\s+\[(DEVE|RECOMENDADO|PODE)\]\s*[—–-]?\s*(.+?)\s*$/;`
   - Line 18: `RE_CHECK = /^\s*[-*]\s*verifica(?:ção|cao)\((teste|proibido|obrigat(?:ório|orio)|gate)\)\s*:\s*(.+?)\s*$/i;`

4. `src/core/audit.js`:
   - Tracks 25 standardized finding codes.
   - Escalates warnings (`AC_SEM_PROVA`, `VERIFY_OBSOLETO`, `Q_ABERTA`, `AC_SEM_TASK`, `ARQUIVO_ORFAO`) to errors when in `--ci` mode.

---

## 2. Logic Chain

1. **Premise 1**: The user request (`ORIGINAL_REQUEST.md`) requires building a **Cofre 3D de Documentação & Diagramas (Spatial Knowledge Graph)** that loads specifications from `.spec/`, displays nodes (US, AC, T, components, notes) with their audit status, connects them with elastic lines, and detects dependency cycles (e.g. A -> B -> C -> A) causing cyclic connections to change color and vibrate.
2. **Premise 2**: In the repository, `.spec/` files follow strict, well-tested markdown grammars implemented in `src/parsers/` and validated by `src/core/audit.js`. All identifiers (`US-xxx`, `AC-xxx`, `T-xxx`, `P-xxx`, `ASM-xxx`, `Q-xxx`) are globally scoped strings with at least 3 digits.
3. **Premise 3**: Traceability links form a natural directed acyclic graph (DAG):
   - `Feature` (contains) -> `US` (contains) -> `AC`
   - `Task` (refs/fulfills) -> `AC` and `US`
   - `Task` (modifies) -> `Source File`
   - `Test` (verifies) -> `AC` and `Principle`
   - `Principle` (constrains) -> `Code / Architecture`
   - `Component / Service` (calls/depends_on) -> `Component / Service`
4. **Deduction 1 (Parser Architecture)**: The SDD Graph Parser must ingest `.spec/` (or `examples/inscricao-turma/.spec/`), run the existing parsers or an integrated graph builder, link nodes via their reference fields (`Refs:`, containment, `@spec:`, `@principle:`), and attach audit findings from `auditProject()`.
5. **Deduction 2 (Elastic Connections & Statuses)**: Normal connections (e.g. `US -> AC`, `T -> AC`) are healthy directed edges rendered with stable elastic spring dynamics and standard colors. Connections with audit errors (e.g. `TASK_CONCLUIDA_SEM_PROVA`, `AC_SEM_TESTE`) or circular dependencies must be tagged with `health: 'error'` or `'circular_error'`, triggering the red/vibrating physical animation required by R2.
6. **Deduction 3 (Synthetic Datasets for R4)**: Because the reference `examples/inscricao-turma/.spec` is a completely clean and valid DAG, it cannot by itself test circular dependency detection or visual cycle alerts. Therefore, controlled synthetic datasets are strictly required:
   - Valid baseline DAG (Dataset 1: no cycles).
   - Direct 3-node cycle `A -> B -> C -> A` (Dataset 2: cycle detection + vibration).
   - Figure-8 multi-cycle (Dataset 3: intersecting cycles).
   - Disjoint hybrid graph (Dataset 4: healthy subgraph unaffected while cycle vibrates).
   - Adversarial broken references (Dataset 5: orphan nodes and broken refs).

---

## 3. Specification of the SDD 3D Graph Parser & Data Models

### 3.1 Graph Node Schema
```typescript
interface SDDGraphNode {
  id: string;              // e.g. "FEAT:inscricao-turma", "US-001", "AC-001", "T-001", "P-001", "COMP:OrderService"
  type: 'feature' | 'story' | 'criterion' | 'task' | 'principle' | 'assumption' | 'question' | 'file' | 'test' | 'component' | 'service';
  title: string;           // e.g. "Aluno se inscreve em turma aberta"
  snippet: string;         // Given/When/Then text, markdown description, or code excerpt
  status: string;          // e.g. "implementada", "concluida", "pass", "aberta", "confirmada"
  auditStatus: 'clean' | 'warning' | 'error';
  auditFindings: Array<{
    code: string;          // e.g. "AC_SEM_TESTE", "TASK_CONCLUIDA_SEM_PROVA"
    severity: 'aviso' | 'erro';
    message: string;
    line?: number;
    file?: string;
  }>;
  position3D?: { x: number; y: number; z: number }; // Initial or computed 3D coordinate
  metadata: {
    feature?: string;
    file?: string;
    line?: number;
    obligationLevel?: 'DEVE' | 'RECOMENDADO' | 'PODE';
    model?: string;
    effort?: string;
  };
}
```

### 3.2 Graph Edge Schema
```typescript
interface SDDGraphEdge {
  id: string;              // e.g. "EDGE:US-001->AC-001"
  source: string;          // Source SDDGraphNode.id
  target: string;          // Target SDDGraphNode.id
  type: 'contains' | 'implements' | 'modifies' | 'verifies' | 'constrains' | 'calls' | 'depends_on';
  directed: boolean;       // true for hierarchy, calls, and dependencies
  health: 'healthy' | 'warning' | 'error' | 'circular_error';
  isVibrating: boolean;    // true if involved in circular dependency or critical validation failure
  visualStyle: {
    color: string;         // e.g. "#00e5ff" (normal cyan), "#ff2a5f" (vibrating crimson), "#ffb700" (warning amber)
    stiffness: number;     // Elastic spring stiffness constant (k)
    damping: number;       // Elastic damping ratio
    restLength: number;    // Natural resting length in 3D units
    amplitude?: number;    // Vibration oscillation amplitude if isVibrating == true
    frequency?: number;    // Vibration frequency in Hz
  };
}
```

### 3.3 Parser Pipeline Requirements
1. **Source Discovery**: Search `.spec/` in active workspace. If not found at root, check `examples/inscricao-turma/.spec/` or custom configured path.
2. **File Ingestion**:
   - `constituicao.md` -> extract principles `P-xxx`
   - `features/*/spec.md` -> extract feature node, stories `US-xxx`, criteria `AC-xxx`, assumptions `ASM-xxx`, questions `Q-xxx`
   - `features/*/tasks.md` -> extract tasks `T-xxx`, file connections, and reference edges
   - `verification/*.json` -> link verification verdicts (`pass`, `fail`, `skip`) to `AC` and `P` nodes
   - Test annotations -> scan `@spec:` and `@principle:` occurrences in test files
3. **Audit Integration**: Run `auditProject()` from `src/core/audit.js`. Attach any generated findings directly to the matching nodes.
4. **Graph Construction**:
   - Create containment edges: `Feature -> US`, `US -> AC`, `Feature -> ASM`, `Feature -> Q`.
   - Create traceability edges: `T -> AC`, `T -> US`, `T -> File`.
   - Create verification edges: `Test -> AC`, `Test -> Principle`.
   - Create conceptual / component edges: `Component -> Component` (from architectural annotations or service definitions).
5. **Cycle Detection Algorithm**:
   - Execute DFS with recursion stack or Tarjan's SCC on directed dependency subgraphs.
   - For every cycle detected:
     - Mark every edge in the cycle with `health = 'circular_error'` and `isVibrating = true`.
     - Set `visualStyle.color = '#ff2a5f'` (crimson).
     - Set oscillation parameters (`amplitude: 1.5, frequency: 12.0`).

---

## 4. Requirements for Synthetic SDD Datasets

To ensure 100% test coverage for R4 (Automated Test Suite & Validation Scenarios) and browser verification:

### Dataset 1: Baseline Valid SDD Graph (DAG)
- **Structure**:
  - Feature `auth-login` (`status: implementada`)
  - `US-001` -> `AC-001`, `AC-002`
  - `T-001` (Refs: `AC-001`), `T-002` (Refs: `AC-002`), both `[concluida]`
  - Test suite with `@spec:AC-001` and `@spec:AC-002` passing.
- **Expected Outcome**:
  - Cycles: 0
  - All edges: `health: 'healthy'`, `isVibrating: false`, stable default color.
  - Audit health: clean (exit code 0).

### Dataset 2: Deliberate 3-Node Cycle (`A -> B -> C -> A`)
- **Structure**:
  - Service/Component nodes or circular Task dependencies:
    - Node A: `OrderService` (or `T-101`)
    - Node B: `PaymentService` (or `T-102`)
    - Node C: `NotificationService` (or `T-103`)
    - Directed calls: `OrderService -> PaymentService -> NotificationService -> OrderService`.
- **Expected Outcome**:
  - Cycle detection finds exact cycle `[OrderService, PaymentService, NotificationService, OrderService]`.
  - Edges `(A->B)`, `(B->C)`, `(C->A)` set to `health: 'circular_error'` and `isVibrating: true`.
  - 3D renderer animates continuous physical spring vibration on these 3 lines.

### Dataset 3: Figure-8 Intersecting Multi-Cycle
- **Structure**:
  - Cycle 1: `A -> B -> C -> A`
  - Cycle 2: `C -> D -> E -> C` (Node C is shared junction)
- **Expected Outcome**:
  - Both cycles detected independently.
  - Edges in Cycle 1 and Cycle 2 are marked `circular_error` and vibrate.
  - Node C highlighted as cyclic articulation point.

### Dataset 4: Disjoint Hybrid Graph (Valid Subgraph + Isolated Cycle)
- **Structure**:
  - Subgraph 1: Feature `reports` (healthy DAG with 4 nodes).
  - Subgraph 2: Microservices `Service-X -> Service-Y -> Service-X` (2-node loop).
- **Expected Outcome**:
  - Validates isolation: Subgraph 1 edges remain green/cyan, completely stationary. Only Subgraph 2 edges vibrate in crimson.

### Dataset 5: Adversarial Drift & Broken References
- **Structure**:
  - `T-201` references nonexistent `AC-999` (`REF_QUEBRADA`).
  - Test file annotates nonexistent `AC-888` (`TESTE_ORFAO`).
  - Assumption `ASM-201` is `aberta` while feature is `implementada` (`ASM_ABERTA`).
- **Expected Outcome**:
  - Node badges display warning/error icons.
  - Edge to missing node flagged as broken reference edge.

---

## 5. Caveats

1. **Working Directory Spec Location**: In the current repository checkout, `.spec/` is located at `examples/inscricao-turma/.spec/`. There is no `.spec/` at the workspace root directory. The SDD parser must therefore support configurable base paths (e.g. `opts.specDir` with fallback to `examples/inscricao-turma/.spec`).
2. **Environment & OS Differences**: In Windows environments, `\r\n` line endings must continue to be handled transparently (handled by `splitLines` in `src/util/text.js`). The 3D Vault will render in the browser (WebGL / Three.js / Canvas), making OS-independent JSON representations essential.
3. **No Implementation Done**: Per Specification Miner role rules, no implementation code has been written; all findings and requirements are strictly derived from repository investigation, tests, and authoritative documentation.

---

## 6. Conclusion

The specification mining is complete and authoritative:
1. **Existing Specifications**: Thoroughly cataloged across `examples/inscricao-turma/.spec/` and `templates/`.
2. **Grammar & Rules**: Mapped with exact regular expressions, allowed enum values, GWT structures, assumption/question lifecycles, and 25 audit finding codes.
3. **Dependencies & Hierarchy**: Defined as a multi-layered graph spanning containment (`Feature -> US -> AC`), implementation (`T -> AC`), verification (`Test -> AC`), and component calls (`Service A -> Service B`).
4. **SDD 3D Graph Parser**: Defined with complete TypeScript interfaces for nodes, edges, physical elasticity properties, vibration triggers, and cycle detection.
5. **Synthetic Datasets**: Specified across 5 distinct test scenarios covering valid DAGs, simple cycles (`A -> B -> C -> A`), figure-8 multi-cycles, disjoint isolation, and adversarial drift.

---

## 7. Verification Method

To independently verify the observations and conclusions in this report:

1. **Verify Parsers Unit Tests**:
   ```bash
   node --test test/parsers.test.js
   ```
   *Expected result*: 9 passed tests confirming `parseSpec`, `parseTasks`, `parseConstitution`, GWT clauses, and short IDs.

2. **Verify Adversarial Regressions & Edge Cases**:
   ```bash
   node --test test/regressoes-adversariais.test.js
   ```
   *Expected result*: 22 passed tests validating skip/todo rules, NFD normalization, spaces in paths, case tolerance, and ReDoS subprocess timeout.

3. **Inspect Example Specifications**:
   - `examples/inscricao-turma/.spec/constituicao.md`
   - `examples/inscricao-turma/.spec/features/inscricao-turma/spec.md`
   - `examples/inscricao-turma/.spec/features/inscricao-turma/tasks.md`
   - `examples/inscricao-turma/.spec/verification/inscricao-turma.json`

4. **Invalidation Conditions**:
   - If `src/parsers/spec.js` or `src/parsers/tasks.js` change their ID matching regexes to allow IDs with <3 digits without warning.
   - If `auditProject()` modifies or removes any of the 25 cataloged finding codes.
