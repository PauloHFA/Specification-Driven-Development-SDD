# 📋 Pendências e Próximos Passos — Specification-Driven-Development-SDD

> Documento de rastreabilidade do status técnico, validações automatizadas e backlog evolutivo do **onp-spec-driven & Cofre 3D (Spatial Knowledge Graph)**.

---

## ✅ 1. O que já está Concluído e Validado

- **Motor SDD (`src/core/`, `src/parsers/`, `bin/onp-spec.js`):**
  - Fluxo completo `init` → `new` → `audit` → `scaffold` → `verify` → `plano` → `resumo` → `licoes`.
  - Suporte multi-agente (`claude`, `codex`, `cursor`, `antigravity`) e builds sincronizados em `skills/onp-spec-driven*` via `tools/build-skill.mjs`.
  - `verify.js` com suporte a TAP (`--test-reporter=tap`), Vitest/Jest JSON, exitcode e fallback para o reporter `spec` do Node >= 22.
  - Auto-auditoria SDD limpa (`node bin/onp-spec.js audit --ci` → 4/4 critérios provados, 0 avisos).
- **Cofre 3D (`src/vault/`):**
  - Grafo espacial 3D offline em WebGL (`Three.js` + `OrbitControls` embarcados), física simplética de Euler, detecção de ciclos com ondas estacionárias de Dirichlet, persistência bidirecional e API HTTP local.
  - **164/164 testes** do Cofre 3D passando + **50 testes** de estresse adversarial e remediação passando.
- **Esteira CI/CD (`.github/workflows/ci.yml`):**
  - Execução completa no GitHub Actions (`ubuntu-24.04`) cobrindo `npm test`, suíte do Cofre 3D, estresse adversarial, auto-auditoria `audit --ci` e linter Python (`ruff`) para o gerador de relatórios PDF.

---

## 🚀 2. Melhorias Futuras Opcionais (Backlog de Engenharia)
- [ ] **Portabilidade Windows nos Testes de Orquestração Bash (`test/reexecucao*.e2e.test.js`):** Adaptar separador `PATH` (`path.delimiter`) e wrapper `.cmd`/Git-Bash para rodar os testes E2E de worktree também nativamente no Windows (atualmente validados integralmente no runner Linux do CI).
- [ ] **Sincronização com `upstream` & Publicação npm:** Revisar PRs/commits do repositório upstream (`onovoprogramador/onp-spec-driven`, ex.: `0.10.0`) caso queira incorporar melhorias futuras ou publicar pacote no registro npm.

---

## 🛠️ 3. Dependências Externas (Uso Opcional em Projetos Terceiros)
- [ ] **CLIs Headless dos Agentes (`claude`, `codex`, `cursor`):** Necessários apenas ao executar os scripts `executar-tarefas.sh` gerados por `onp-spec plano` contra um projeto real com IA.
- [ ] **Python + ReportLab:** Necessário apenas ao regerar o PDF executivo via `tools/generate_pdf_report.py`.
