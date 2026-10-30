# Spec: Vault 3d

> feature: vault-3d
> status: implementada

## Contexto

Visualização e navegação espacial 3D imersiva de anotações técnicas, componentes de software e especificações SDD em espaço vetorial contínuo com física elástica em tempo real e detecção mecânica de dependências circulares.

## Histórias

### US-001 — Navegação Espacial 3D e Vetores Contínuos

Como desenvolvedor ou arquiteto de software, quero navegar por notas e diagramas em um espaço vetorial 3D contínuo, para inspecionar relações entre componentes com transições suaves de câmera.

#### AC-001 — Renderização Espacial e Foco com Lerp

- **Dado** o ambiente 3D inicializado com nós distribuídos no espaço vetorial
- **Quando** o usuário navega com o mouse ou clica em um nó para focar
- **Então** a câmera executa transição suave via interpolação matemática lerp com curva easeOutQuint e o HUD exibe os detalhes

### US-002 — Física Elástica e Alerta de Dependências Circulares

Como arquiteto de software, quero que as conexões entre componentes usem simulação física em tempo real e vibrem quando houver erros, para identificar imediatamente dependências circulares na arquitetura.

#### AC-002 — Detecção de Ciclos e Vibração por Ondas Estacionárias

- **Dado** um grafo com dependência circular entre componentes ou tarefas
- **Quando** o detector de ciclos analisa a estrutura de conectividade
- **Então** as arestas envolvidas no ciclo mudam de cor para carmesim e executam animação física contínua de vibração elástica

### US-003 — Ingestão de Especificações SDD

Como líder técnico, quero que o cofre carregue diretamente as especificações da pasta .spec/, para que o modelo tridimensional reflita fielmente as histórias, critérios de aceite e tarefas do projeto.

#### AC-003 — Mapeamento de Requisitos e Cláusulas GWT

- **Dado** um diretório de especificações contendo arquivos spec.md e tasks.md
- **Quando** o adaptador SDD processa as definições do projeto
- **Então** nós tridimensionais são gerados para histórias, critérios e tarefas com suas cláusulas Dado/Quando/Então vinculadas

### US-004 — Validação Automatizada e Topologias Sintéticas

Como engenheiro de qualidade, quero dispor de cenários sintéticos controlados e testes automatizados, para garantir a integridade mecânica de todo o sistema sem dependências externas.

#### AC-004 — Execução de Suíte Automatizada e Topologias de Teste

- **Dado** a suíte de testes automatizados e o gerador de topologias sintéticas
- **Quando** o test runner executa as baterias de teste
- **Então** todos os cenários (DAG limpo, ciclo simples, multi-ciclo, grafo híbrido e desvio adversarial) passam com 100% de sucesso

## Fora de escopo

- Renderização em Realidade Virtual (VR/WebXR) imersiva com óculos 3D.
- Edição de texto rica (WYSIWYG) embutida diretamente dentro da malha 3D.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | O navegador cliente suporta WebGL e Three.js para renderização 3D | confirmada | Trilha WebGL e Three.js embarcado offline |
| ASM-002 | O ambiente de execução dispõe de Node.js >= 18 com suporte a ESM | confirmada | Verificado no package.json e motores nativos |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | A interface web 3D opera completamente offline sem requisições de CDN? | respondida | Sim, Three.js e OrbitControls foram embarcados localmente em public/vendor/ |
| Q-002 | Como o servidor HTTP local gerencia concorrência de requisições de API? | respondida | Utilizando node:http assíncrono com pool de conexões e rotas REST isoladas |
