# Início de sessão — PC2 — Design & Conteúdo

Responsável: **Luciana Lima**. Esta sessão é a **coordenadora** do PC2: ela dispara os sub-agentes, revisa, verifica e integra.

## 1. Preparar
```bash
git checkout main && git pull --ff-only
npm install
npm run check && npm run build
```

## 2. Prompt para colar na sessão principal
> Esta sessão é o **PC2 — Design & Conteúdo** do Pucacity. Leia `CLAUDE.md`, `docs/planning.md` e `docs/sessoes/pc2-design.md`. Seja a coordenadora: dispare os sub-agentes `pc2-design-cenarios, pc2-design-balance, pc2-design-conteudo, pc2-design-progressao` **em paralelo**, cada um com `isolation: "worktree"` e a sua tarefa padrão (arquivos em `.claude/agents/`). Ao receber os resultados, revise, rode as verificações do `CLAUDE.md` e abra um PR por sub-agente (branch `pc2/<tarefa>`). Não altere arquivos de outros PCs.

## 3. Sub-agentes deste PC
| Sub-agente | Definição |
|---|---|
| `pc2-design-cenarios` | `.claude/agents/pc2-design-cenarios.md` |
| `pc2-design-balance` | `.claude/agents/pc2-design-balance.md` |
| `pc2-design-conteudo` | `.claude/agents/pc2-design-conteudo.md` |
| `pc2-design-progressao` | `.claude/agents/pc2-design-progressao.md` |

## 4. Ordem
- Nada bloqueia o PC2: todos os sub-agentes podem começar já. O `vila-nova.json` precisa validar no `CityLoader` (já na `main`). Atenção às unidades do contrato: 1 tile = 10 m, `width` em metros, `speed` em km/h, `ownership` em %, água em `areas`. Exemplos: `public/cities/demo.json` e `src/assets/cities/vitrine.json`.
- Disparar os 4 em paralelo. Prioridade: `pc2-design-cenarios` (`vila-nova.json`) e `pc2-design-balance` (casos esperados), porque o PC3 depende deles na Onda 2.

## 5. Fim de sessão
- Todos os PRs do dia abertos ou mergeados, com a `main` verde.
- Atualize o "Estado atual" em `docs/planning.md` §1 (uma linha por entrega).
- Anote os bloqueios para os outros PCs na seção de bloqueios de `docs/planning.md`.
