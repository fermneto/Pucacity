# Início de sessão — PC3 — Engenharia & Simulação

Responsável: **corre**. Esta sessão é a **coordenadora** do PC3: ela dispara os sub-agentes, revisa, verifica e integra.

## 1. Preparar
```bash
git checkout main && git pull --ff-only
npm install
npx tsc --noEmit && npm run build
```

## 2. Prompt para colar na sessão principal
> Esta sessão é o **PC3 — Engenharia & Simulação** do Pucacity. Leia `CLAUDE.md`, `docs/planning.md` e `docs/sessoes/pc3-engenharia.md`. Seja a coordenadora: dispare os sub-agentes `pc3-eng-infra, pc3-eng-rede, pc3-eng-agentes, pc3-eng-jogo` **em paralelo**, cada um com `isolation: "worktree"` e a sua tarefa padrão (arquivos em `.claude/agents/`). Ao receber os resultados, revise, rode as verificações do `CLAUDE.md` e abra um PR por sub-agente (branch `pc3/<tarefa>`). Não altere arquivos de outros PCs.

## 3. Sub-agentes deste PC
| Sub-agente | Definição |
|---|---|
| `pc3-eng-infra` | `.claude/agents/pc3-eng-infra.md` |
| `pc3-eng-rede` | `.claude/agents/pc3-eng-rede.md` |
| `pc3-eng-agentes` | `.claude/agents/pc3-eng-agentes.md` |
| `pc3-eng-jogo` | `.claude/agents/pc3-eng-jogo.md` |

## 4. Ordem
- **Onda 0 (bloqueante):** `pc3-eng-infra` integra `origin/eng/fundacao` na `main` seguindo `docs/planning.md` §4.0. Os outros sub-agentes do PC3 só começam depois desse merge.
- Depois da Onda 0: `pc3-eng-rede`, `pc3-eng-agentes` e `pc3-eng-jogo` em paralelo, cada um em seu worktree. A primeira entrega é `Simulation.getState()`, porque o PC1 depende dela.

## 5. Fim de sessão
- Todos os PRs do dia abertos ou mergeados, com a `main` verde.
- Atualize o "Estado atual" em `docs/planning.md` §1 (uma linha por entrega).
- Anote os bloqueios para os outros PCs na seção de bloqueios de `docs/planning.md`.
