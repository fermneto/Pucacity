# Planejamento — 3 computadores, cada um com seus sub-agentes

Objetivo: chegar ao **MVP v0.1** (SPEC §3: Vila Nova jogável, com metas, evento e dilemas) o mais rápido possível. Cada computador é dono de uma área do repositório e roda vários sub-agentes do Claude Code em paralelo, sem pisar no trabalho dos outros.

---

## 1. Estado atual (após o merge de 13/11/2026)

A `main` junta o trabalho dos três workers até agora:

| Origem | O que está na `main` |
|---|---|
| Arte + Design (fermneto) | SPEC "cidade radical sem carros"; style guide, referências e dados de arte; camada visual completa (pipeline PS1 + Aero, 14 veículos, 11 prédios, 11 radicais, 7 props, vitrine, laboratório, HUD, capturas); canais múltiplos, Torre Espiral, Mega Half-pipe |
| Design (Luciana Lima) | `docs/design/problemas.md` (8 problemas), `docs/design/cenario-01-vila-nova.md`, `config/balance.json` v0.2.0, já alinhados à cidade radical (mesmos ids de veículo e faixa) |
| Integração | `src/core/CityFile.ts` com a união do contrato: faixas por via, travessias, canais, features, posse de veículos, **personagens** e **cenário** (metas, eventos, dilemas) |

**Decisões do merge** (antigas D1–D7): venceu a cidade radical, sem carros. Faixas `sidewalk/slow/fast/transit`, tandem e tuk-tuk no coletivo e travessias radicais com rota acessível. Os 8 problemas da Luciana viraram a estrutura de design, e os KPIs são as métricas de cada problema. Os overboards saíram do escopo.

**Ainda falta:** toda a simulação (`src/core/` tem só o contrato) e o cenário Vila Nova em dados (`src/assets/cities/vila-nova.json`).

---

## 2. Divisão por computador

| | **PC1 — Arte & Render** | **PC2 — Design & Conteúdo** | **PC3 — Engenharia & Simulação** |
|---|---|---|---|
| Responsável | fermneto | Luciana Lima | *a definir* |
| É dono de | `src/render/**`, `src/ui/**`, `src/lab.*`, `data/arte/**`, `docs/style-guide.md`, `docs/referencias.md`, `docs/validacao-visual.md`, `scripts/screenshots.mjs`, `scripts/gen-vitrine.mjs`, `assets/models|textures` | `docs/design/**`, `config/balance.json`, `src/assets/cities/*.json` (exceto `vitrine.json`), textos (`src/assets/text/**`), `docs/playtests/**` | `src/core/**`, `tests/**`, `src/game/**` (loop do jogo), `package.json`, `tsconfig.json`, `vite.config.ts`, CI (`.github/**`), `docs/engineering.md` |
| Entrega para os outros | Views que leem o estado do `core` (sem lógica de jogo), HUD e painéis, modelos/ícones pedidos pelo cenário | Cenários em JSON válidos, números de equilíbrio, eventos, dilemas e textos | API do `core` (`Simulation`, `Commands`, `Kpis`, eventos), validação dos JSON, testes e build |

**Arquivos compartilhados** (só por PR pequeno, revisado pelo dono):

| Arquivo | Dono | Regra |
|---|---|---|
| `SPEC.md` | por seção: §1–5 PC2 · §5 e §8 (arte/UI) PC1 · §6–7, §10 PC3 | Cada PC edita só as suas seções |
| `src/core/CityFile.ts` (contrato) | PC3 | Mudança de campo exige aviso aos três, porque quebra JSONs e views |
| `data/arte/veiculos.json` (ids) | PC1 | Ids são contrato com `balance.json`: não renomear sem combinar |
| `src/main.ts` | PC1 enquanto for a vitrine; vira `vitrine.ts` quando o PC3 criar `src/game/` | — |

---

## 3. Sub-agentes por computador

Cada PC abre **uma sessão principal** (a coordenadora) e dispara sub-agentes em **worktrees isolados** (`isolation: "worktree"`), cada um com escopo de arquivos fechado. A coordenadora revisa, roda as verificações e abre o PR.

### PC1 — Arte & Render
| Sub-agente | Escopo (arquivos) | Primeira tarefa |
|---|---|---|
| `arte-modelos` | `src/render/models/**` | Assets do cenário Vila Nova que faltam: mercado, estação de carga, casa simples; retratos dos 4 personagens |
| `arte-views` | `src/render/*View.ts`, `src/render/Overlays.ts` | `SimView`: desenhar os agentes **a partir do estado do core** (substitui o `DemoTraffic` no jogo) |
| `arte-ui` | `src/ui/**` | Painéis de ferramenta, balões de fala, rádio de eventos, balanço do dia, cartas de dilema |
| `arte-mundo` | `scripts/gen-vitrine.mjs`, `src/render/Atmosphere.ts` | Pendências: cidade maior, bolhas gigantes, vulcões de gel, dinossauros Aero |

### PC2 — Design & Conteúdo
| Sub-agente | Escopo | Primeira tarefa |
|---|---|---|
| `design-cenarios` | `src/assets/cities/*.json` | `vila-nova.json` completo no contrato `CityFile` (ruas, faixas, travessias, personagens, cenário) |
| `design-balance` | `config/balance.json` | Números de escolha modal, BPR, quedas e paciência, com tabela de casos esperados para os testes do PC3 |
| `design-conteudo` | `docs/design/**`, `src/assets/text/**` | Eventos, dilemas e falas do cenário 1 em JSON; roteiro do tutorial |
| `design-cenarios-2-4` | `docs/design/**` | Desenho dos cenários 2–4 (Centro Gel, Orla Bolha, Morro Alto) |

### PC3 — Engenharia & Simulação
| Sub-agente | Escopo | Primeira tarefa |
|---|---|---|
| `eng-core-rede` | `src/core/RoadGraph.ts`, `Crossings.ts`, `Pathfinding.ts` + testes | Grafo com faixas, travessias (regra de acessibilidade), A\* por modo |
| `eng-core-agentes` | `src/core/Agents.ts`, `Transit.ts`, `Simulation.ts` + testes | Rotinas, escolha modal (logit), BPR, linhas de tuk-tuk; passo fixo e *seed* |
| `eng-core-jogo` | `src/core/Commands.ts`, `Kpis.ts`, `Events.ts`, `Save.ts` + testes | Ferramentas com undo, KPIs dos 8 problemas, eventos e dilemas lidos do JSON |
| `eng-infra` | `package.json`, CI, `src/game/**`, validador de JSON | Vitest + CI (tsc, build, testes, `npm run shots`), loader e validador de `city.json`/`balance.json` |

**Modelo de prompt para um sub-agente** (cole na sessão coordenadora):
> Você é `<nome>` do PC`<n>`. Escopo: só pode alterar `<arquivos>`. Leia `SPEC.md` §`<x>`, `docs/planning.md` e `<docs da área>`. Tarefa: `<tarefa>`. Pronto quando: `npx tsc --noEmit`, `npm test` e `npm run build` passam e `<critério da tarefa>`. Não mexa em arquivos fora do escopo; se precisar mudar um contrato, pare e descreva a mudança no relatório.

---

## 4. Ondas de trabalho (caminho crítico para o MVP)

As três colunas de cada onda andam **em paralelo**. Cada onda termina com a `main` verde e uma build jogável.

| Onda | PC1 — Arte & Render | PC2 — Design & Conteúdo | PC3 — Engenharia & Simulação | Marco |
|---|---|---|---|---|
| **1. Contratos** | Assets do Vila Nova; `SimView` usando dados mock | `vila-nova.json` + `balance.json` com casos de teste | Esqueleto do `core` (carregar e validar o JSON, grafo, tick com seed), CI | Vila Nova carrega e aparece no render |
| **2. Movimento** | `SimView` lendo o core; overlays com dados reais | Rotinas e grupos de moradores; eventos em dados | Agentes, A\*, BPR, escolha modal, coletivo | Moradores vão e voltam; as faixas congestionam |
| **3. Ferramentas** | Painéis de ferramenta, pré-visualização de impacto, balões e rádio | Custos, metas e estrelas; dilemas e textos | Commands com undo, KPIs, eventos/dilemas, paciência | Mudar uma faixa ou travessia muda o KPI |
| **4. Vertical slice** | Polish visual, áudio, tutorial na UI | Playtest, ajuste do balance, roteiro do tutorial | Save/load, desempenho, determinismo | **MVP v0.1**: Vila Nova do início ao fim |

**Dependências entre PCs:**
- O contrato `CityFile.ts` sai do PC3 na onda 1, primeiro.
- O PC1 trabalha com mock até o core expor `Simulation.getState()`.
- O PC2 entrega os casos esperados em `balance.json`, que viram testes no PC3.

---

## 5. Fluxo de integração (para não travar)

1. **Branches:** `pc1/<tarefa>`, `pc2/<tarefa>`, `pc3/<tarefa>`, uma por sub-agente, todas a partir da `main` do dia.
2. **PRs pequenos** (≤ ~400 linhas), aprovados pelo dono da área. O merge é feito pela coordenadora do PC dono.
3. **Integração contínua:** ao menos **2 merges por dia** em cada PC. Antes de abrir PR: `git fetch && git rebase origin/main`.
4. **Verificação obrigatória** (vira CI na onda 1):
   - `npx tsc --noEmit`, `npm test`, `npm run build`
   - `npm run shots` sem erro de console (render e UI)
   - laboratório com "todos dentro do orçamento ✓" (modelos)
   - JSONs validados contra o contrato (cenários e balance)
5. **Mudança de contrato:** PR próprio, aviso aos três e o merge acontece antes dos PRs que dependem dele.
6. **Sincronização diária** (15 min, ou assíncrona): o que cada PC integrou, os bloqueios e se algum contrato vai mudar.
7. **Pronto =** está na `main`, a CI passa, respeita o style guide e o SPEC, e o doc da área está atualizado.

---

## 6. Registro do merge de 13/11/2026

1. `design/mobilidade-overboards` (Luciana) foi adaptada à cidade radical e entrou na `main` (`3fd827c`, `39aa64f`).
2. `design/cidade-radical` (fermneto) entrou na `main` sem conflito.
3. `CityFile.ts` passou a ter `characters`, `scenario` e `Goal`. O formato de `Goal` é uma **proposta** do PC1: o PC3 confirma na onda 1.
4. Verificado: typecheck, build e capturas sem erro de console.
5. Branches que podem ser apagadas: `arte/cidade-radical-aero`, `design/mobilidade-overboards`, `design/cidade-radical`.

**Pendências herdadas, já distribuídas acima:**
- PC1 (`arte-mundo`): cidade maior, bolhas gigantes, vulcões de gel, dinossauros Aero.
- PC1 (`arte-modelos`): assets do Vila Nova.
- PC2: vila-nova.json.
- PC3: todo o core.
