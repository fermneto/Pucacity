# Início de sessão — PC1 — Arte & Render

Responsável: **fermneto**. Esta sessão é a **coordenadora** do PC1: ela dispara os sub-agentes, revisa, verifica e integra.

## 1. Preparar
```bash
git checkout main && git pull --ff-only
npm install
npm run check && npm run build
```

## 2. Prompt para colar na sessão principal
> Esta sessão é o **PC1 — Arte & Render** do Pucacity. Leia `CLAUDE.md`, `docs/planning.md` e `docs/sessoes/pc1-arte.md`. Seja a coordenadora: dispare os sub-agentes `pc1-arte-modelos, pc1-arte-views, pc1-arte-ui, pc1-arte-mundo` **em paralelo**, cada um com `isolation: "worktree"` e a sua tarefa padrão (arquivos em `.claude/agents/`). Ao receber os resultados, revise, rode as verificações do `CLAUDE.md` e abra um PR por sub-agente (branch `pc1/<tarefa>`). Não altere arquivos de outros PCs.

## 3. Sub-agentes deste PC
| Sub-agente | Definição |
|---|---|
| `pc1-arte-modelos` | `.claude/agents/pc1-arte-modelos.md` |
| `pc1-arte-views` | `.claude/agents/pc1-arte-views.md` |
| `pc1-arte-ui` | `.claude/agents/pc1-arte-ui.md` |
| `pc1-arte-mundo` | `.claude/agents/pc1-arte-mundo.md` |

## 4. Ordem
- A Onda 0 já foi concluída: o render do PC1 prevaleceu e o contrato oficial é `src/core/types.ts`, com 1 tile = 10 m e água em `areas`. Dívida herdada: o render ainda não segue `noUncheckedIndexedAccess` (tarefa do `pc1-arte-views`).
- Em paralelo, já: `pc1-arte-modelos` (assets do Vila Nova) e `pc1-arte-mundo` (cidade maior, bolhas, vulcões, dinossauros), que não dependem do core. `pc1-arte-views` e `pc1-arte-ui` começam com mock e passam ao core real quando o PC3 expuser `Simulation.getState()`.

## 5. Fim de sessão
- Todos os PRs do dia abertos ou mergeados, com a `main` verde.
- Atualize o "Estado atual" em `docs/planning.md` §1 (uma linha por entrega).
- Anote os bloqueios para os outros PCs na seção de bloqueios de `docs/planning.md`.
