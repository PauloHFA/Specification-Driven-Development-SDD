# onp-spec-driven & O Cofre 3D de Documentação (Spatial Knowledge Graph)

**A especificação que continua verdadeira.** Você descreve a feature, o agente
de IA especifica, planeja, executa em paralelo e **prova** que fez — com
auditoria mecânica, não com promessa. Se a spec e o código desalinham, a
máquina acusa.

```text
┌───────────┐  ┌────────┐  ┌───────┐  ┌───────┐  ┌────────┐  ┌───────┐
│ESPECIFICAR│→ │PROJETAR│→ │TAREFAS│→ │ PLANO │→ │EXECUTAR│→ │AUDITAR│
└───────────┘  └────────┘  └───────┘  └───────┘  └────────┘  └───────┘
                                          ↑ paralelismo         ↑ o gate mecânico
```

---

## 🌟 O Cofre 3D de Documentação & Diagramas (Spatial Knowledge Graph)

O **Cofre 3D** é a evolução visual e espacial do framework de SDD. Em vez de navegar por especificações técnicas e diagramas de arquitetura em folhas estáticas de texto ou telas 2D planas, todo o ecossistema de software é projetado em um **espaço vetorial 3D contínuo e ilimitado**.

```text
       [Princípios P-xxx (Anel Celestial Superior)]
                       ↑
    [Histórias US-xxx] ←→ [Critérios AC-xxx (Dado/Quando/Então)]
           ↓                         ↓
    [Tarefas T-xxx]    ←┈┈(cabo elástico com física)┈┈→ [Código / Arquivos]
           ↓
   (Vibração carmesim contínua em caso de dependência circular / erro)
```

### Principais Recursos Visuais & Funcionais:
1. **Espaço Vetorial 3D Ilimitado:** Nós representando Histórias (`US-xxx`), Critérios de Aceite (`AC-xxx`), Tarefas (`T-xxx`), Princípios (`P-xxx`), Suposições (`ASM-xxx`) e Arquivos de Código dispostos em órbitas concêntricas e planos temáticos tridimensionais.
2. **Navegação Cinemática Suave (Lerp):** Controle completo com o mouse (órbita esférica, translação planar e zoom sem risco de *gimbal lock*). Ao clicar em qualquer nó, a câmera executa um voo suave até o elemento através de interpolação matemática com curva amortecida `easeOutQuint`.
3. **Física Elástica Dinâmica em Tempo Real:** Conexões interligadas por cabos simulados com física de atração de Hooke ($F_s = -k \cdot \Delta x$), repulsão eletrostática de Coulomb ($F_r = k_e / d^2$) e amortecimento viscoso integrado por método simplético de Euler.
4. **Alerta Físico de Dependências Circulares:** Se o grafo apresentar um ciclo vicioso de dependência entre componentes ou tarefas, o algoritmo de Tarjan/DFS isola o ciclo, as arestas mudam para a cor carmesim e executam uma **vibração transversal física contínua** através de equações de ondas estacionárias com condições estritas de contorno de Dirichlet ($d(0,t)=0, d(1,t)=0$).
5. **HUD Lateral de Inspeção:** Gaveta retrátil na interface para inspecionar instantaneamente o título, status de auditoria, veredito de testes e cláusulas completas Dado/Quando/Então.
6. **100% Offline e Zero Dependências:** Engine WebGL com Three.js e OrbitControls embarcados localmente em `src/vault/public/vendor/`. O servidor local roda sobre o módulo nativo `node:http`.

---

## 🚀 Como Executar o Cofre 3D

Para iniciar o servidor local e abrir o Cofre 3D no seu navegador:

```bash
# Inicia na porta padrão (ou defina --port) e abre o navegador
node bin/onp-spec.js vault --open
```

Ou através do comando geral com porta configurada:
```bash
node bin/onp-spec.js vault --port 3333
```

Acesse no navegador: **`http://localhost:3333`** (ou `http://127.0.0.1:3333`).

---

## 🧭 O Papel do Spec-Driven Development (SDD) na Orientação dos Agentes

Um dos maiores desafios no desenvolvimento com múltiplos agentes de Inteligência Artificial é a **perda de contexto, a alucinação de requisitos e as falsas declarações de sucesso** (*premature victory*).

O **Spec-Driven Development (Spec-Anchored)** foi o alicerce fundamental que guiou, delimitou e auditou toda a atuação da equipe autônoma de desenvolvimento:

### 1. A Spec como Contrato Inegociável (Single Source of Truth)
Os agentes não começam codificando arquivos soltos. O trabalho inicia obrigatoriamente pela escrita da especificação formal (`.spec/features/vault-3d/spec.md`) e da constituição (`.spec/constituicao.md`). Isso estabelece fronteiras matemáticas claras sobre o que é esperado e o que está expressamente **fora de escopo**.

### 2. Definição Executável de "Pronto" (DoD Mecânico)
Em times tradicionais de agentes, a IA afirma: *"Terminei a implementação e tudo parece ótimo!"*. No SDD, **a IA é proibida de declarar vitória por conta própria**. 
- Cada Critério de Aceite (`AC-xxx`) nasce como uma cláusula Dado/Quando/Então.
- Cada critério exige um teste automatizado anotado com a tag `@spec:AC-xxx`.
- O término de uma tarefa (`T-xxx`) só é aceito se o comando mecânico `onp-spec verify` rodar os testes reais e registrar a prova física em `.spec/verification/<feature>.json`.

### 3. Eliminação de Suposições Ocultas (`ASM-xxx` e `Q-xxx`)
Agentes de IA frequentemente assumem premissas silenciosas (ex: assumir que há internet disponível ou bibliotecas externas instaladas). O SDD força o registro obrigatório:
- **Suposições (`ASM-xxx`):** Nenhuma feature pode ser concluída com suposições com status `aberta`. Todas devem ser formalmente marcadas como `confirmada` ou `invalidada`.
- **Perguntas em Aberto (`Q-xxx`):** Dúvidas de arquitetura que exigem resolução explícita antes do fechamento.

### 4. A Prova Final: O Gate de Auditoria (`onp-spec audit --ci`)
O comando de auditoria mecânico cruza:
$$\text{Constituição } (P\text{-}xxx) \longleftrightarrow \text{Histórias } (US) \longleftrightarrow \text{Critérios } (AC) \longleftrightarrow \text{Tarefas } (T) \longleftrightarrow \text{Testes } (@spec) \longleftrightarrow \text{Código Real}$$
Se um desenvolvedor criar código sem tarefa (`ARQUIVO_ORFAO`), se um critério não tiver teste (`AC_SEM_TESTE`), ou se uma tarefa for marcada como concluída sem o teste ter passado (`TASK_CONCLUIDA_SEM_PROVA`), **a auditoria falha com exit code 1**.

---

## 📖 Entendendo a Estrutura da Especificação (`.spec/`)

A especificação do projeto na raiz (`.spec/`) segue rigorosamente a estrutura oficial do SDD:

```text
.spec/
├── constituicao.md                # Princípios inegociáveis do projeto (P-xxx)
├── config.json                    # Configurações de teste, globs e reporters
├── features/
│   └── vault-3d/
│       ├── spec.md                # Histórias de Usuário, Critérios GWT, Suposições e Perguntas
│       └── tasks.md               # Tarefas atômicas, mapeamento de arquivos e status
└── verification/
    ├── vault-3d.json              # Veredito mecânico gerado pelo test runner
    └── sinais.json                # Histórico mecânico de auditorias e lições aprendidas
```

### Anatomia de `spec.md`:
- **Contexto:** Definição clara do problema e público-alvo.
- **Histórias de Usuário (`US-xxx`):** Quem precisa, o que precisa e qual o valor gerado.
- **Critérios de Aceite (`AC-xxx`):**
  - **Dado** o estado inicial do sistema;
  - **Quando** o usuário ou componente executa uma ação;
  - **Então** o resultado observável esperado.
- **Suposições (`ASM-xxx`):** Registro de pressupostos técnicos validados durante a execução.
- **Perguntas em Aberto (`Q-xxx`):** Esclarecimentos resolvidos no ciclo de vida da feature.

### Anatomia de `tasks.md`:
- Cada tarefa atômica (`T-xxx`) referencia os critérios que implementa (`Refs: US-xxx, AC-xxx`) e os arquivos que tem permissão para modificar (`Arquivos: src/...`).
- Status da tarefa: `[pendente]`, `[em-andamento]`, `[concluida]`.

---

## 🤖 Como Foi Conduzido: O Processo Multiagente (Teamwork)

A construção do **Cofre 3D** foi realizada por uma equipe autônoma multidisciplinar coordenada pelo **Teamwork Coordinator** do Google Antigravity, operando sob o rigor de múltiplos portões de qualidade:

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   ENTREVISTA    │ ──> │     RECONHECIMENTO   │ ──> │  EXECUÇÃO EM 4      │ ──> │  VICTORY AUDIT   │
│   E ALINHAMENTO │     │     & MINERAÇÃO SDD  │     │  MARCOS PARALELOS   │     │  INDEPENDENTE    │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘     └──────────────────┘
```

### 1. Entrevista Técnica Inicial
Antes de gerar qualquer linha de código, o agente entrevistador (`teamwork_interviewer`) alinhou com o usuário os requisitos fundamentais:
- **R1 (Espaço Vetorial 3D e Navegação Espacial):** Espaço contínuo, navegação por arrasto (pan/orbit/zoom) e foco inteligente com *lerp*.
- **R2 (Física Elástica & Alerta de Ciclos):** Simulação de atração/repulsão em tempo real e vibração carmesim para dependências circulares.
- **R3 (Integração com SDD):** Leitura de `.spec/`, extração de US/AC/T/Princípios e cláusulas GWT.
- **R4 (Topologias Sintéticas e Automação):** 5 cenários controlados de validação e suíte automatizada.

### 2. Estrutura de Papéis da Equipe Autônoma
| Agente / Especialidade | Papel Desempenhado |
|---|---|
| **Project Orchestrator** | Gestão do cronograma global, controle de dependências entre faixas e supervisão dos Gates 1 a 4. |
| **Survey Explorers & Spec Miner** | Mapeamento do ecossistema do SDD, catalogação da gramática de requisitos e arquitetura física 3D. |
| **Workers de Implementação** | Codificação dos motores matemáticos, adaptadores, shaders físicos e interface WebGL. |
| **Revisores Independentes** | Revisão de código cega, garantia de padrões ESM, ausência de deadlocks e conformidade com os princípios. |
| **Adversarial Challengers** | Ataques destrutivos de estresse: grafos de 5.000 nós, injeção de parâmetros maliciosos, rajadas de concorrência. |
| **Forensic Auditors** | Verificação forense contra fraudes de código (garantia de zero mocking, zero facades e zero valores fixos). |
| **Sentinel & Victory Auditor** | Auditor independente pós-vitória em ambiente isolado que emitiu o veredito final **VICTORY CONFIRMED**. |

### 3. Os 4 Marcos de Desenvolvimento Entregues

#### Marco 1: Núcleo Matemático 3D, Simulação Física & Detecção de Ciclos
- `src/vault/math/vector3.js`: Álgebra vetorial 3D completa com proteção contra divisões por zero e normalizações estáveis.
- `src/vault/math/camera-kinematics.js`: Cinemática orbital esférica sem *gimbal lock*, pan planar e interpolação *lerp* com curva `easeOutQuint`.
- `src/vault/physics/spring-damper.js`: Forças combinadas de Hooke e Coulomb integradas por método simplético de Euler com modo de repouso automático (*sleep state*).
- `src/vault/physics/edge-vibrator.js`: Ondas estacionárias transversais com condições fixas de Dirichlet nas extremidades.
- `src/vault/core/cycle-detector.js`: Algoritmo iterativo de Tarjan para isolar componentes fortemente conexos (SCCs) e ciclos.

#### Marco 2: Adaptador do Grafo SDD & Datasets Sintéticos
- `src/vault/core/sdd-adapter.js`: Parser de especificações em Markdown que lê `.spec/` e gera nós em camadas orbitais inteligentes.
- `src/vault/core/synthetic-data.js`: As 5 topologias controladas de validação:
  1. *Clean DAG:* Grafo acíclico perfeito;
  2. *Simple Cycle:* Ciclo triangular simples A→B→C→A;
  3. *Multi-Cycle Figure-8:* Dois anéis entrelaçados compartilhando nó de articulação;
  4. *Disjoint Hybrid:* Grafo válido convivendo isoladamente com componente cíclico;
  5. *Adversarial Drift:* Desvios cruzados entre features e arestas quebradas.

#### Marco 3: Interface Web 3D Interativa & Servidor Local Nativo
- `src/vault/server.js`: Servidor nativo em Node.js (`node:http`, zero dependências externas) servindo endpoints de API REST e arquivos estáticos com proteção contra *directory traversal*.
- `src/vault/public/`: Interface 3D visual moderna, Three.js e OrbitControls embarcados localmente offline, gaveta HUD de detalhes de critérios e cabos dinâmicos carmesim com física em tempo real.
- Comando `onp-spec vault` integrado à CLI oficial.

#### Marco 4: Validação E2E, Estresse Adversarial e Hardening
- Bateria de testes de estresse comprovando resiliência sob rajadas de 500 requisições HTTP simultâneas, ataques de *prototype pollution*, diretórios vazios de specs, 500 tarefas em estrela e estabilidade matemática sob timestamps de $t = 10^9$ segundos.
- Certificação unânime e homologação pelo Victory Auditor.

---

## 🧪 Suíte de Testes Automatizada & Métricas de Qualidade

Toda a solução é verificada mecanicamente com o test runner nativo do Node.js:

```bash
# Executa todos os 163 testes do Cofre 3D
node --test "test/vault/*.test.js"
```

### Resultados da Homologação:
- **Testes do Cofre 3D:** **163 de 163 testes aprovados (100% PASS)** em ~400ms.
- **Sincronização das Skills (`test/skill-sync.test.js`):** **21 de 21 testes aprovados**.
- **Auditoria Formal de CI:** `node bin/onp-spec.js audit --ci` com **0 erros e 0 avisos** (exit code 0).
- **Provas Gravadas:** 4 de 4 critérios de aceite provados mecanicamente em `.spec/verification/vault-3d.json`.

---

## 📄 Documentação Executiva em PDF

Para reuniões de diretoria, apresentações de arquitetura e consultas executivas, o repositório inclui um relatório formal de engenharia em PDF:

- 📄 **[Relatorio_Executivo_Cofre_3D_SDD.pdf](Relatorio_Executivo_Cofre_3D_SDD.pdf)**
- 🛠️ **Ferramenta Geradora:** `python tools/generate_pdf_report.py`

---

## 📦 Instalação das Skills nos Agentes de IA

A skill do SDD pode ser instalada diretamente no seu agente de preferência:

### Claude Code
```bash
npx @onovoprogramador/onp-spec init --agents claude
```

### Codex
```bash
npx @onovoprogramador/onp-spec init --agents codex
```

### Cursor
```bash
npx @onovoprogramador/onp-spec init --agents cursor
```

### Antigravity
```bash
npx @onovoprogramador/onp-spec init --agents antigravity
```

---

## 🛠️ Catálogo de Comandos CLI

```text
uso: onp-spec <comando> [opções]

comandos:
  init [--preset base|lgpd-educacao] [--agents claude|antigravity|codex|cursor]
                      cria .spec/, constituição e config no diretório atual
  new <feature>       cria .spec/features/<feature>/ com spec.md e tasks.md
  plano <feature>     gera o plano de execução paralela por faixas
  tarefa <feature> <T-xxx> [status]
                      atualiza o status de uma tarefa no tasks.md
  verify <feature>    roda os testes e grava a prova de cada critério de aceite
  audit [--ci]        audita especificação ↔ tarefas ↔ testes ↔ código ↔ constituição
  status              exibe o painel geral de features, critérios e suposições
  assumptions         lista todas as suposições e perguntas em aberto
  vault [--port 3333] [--open]
                      inicia o Cofre 3D de Documentação & Diagramas no navegador
```

---

## ⚖️ Licença

MIT © Vitor Manoel — O Novo Programador
Extensão do Cofre 3D desenvolvida em colaboração autônoma com Google Antigravity Teamwork & PauloHFA.
