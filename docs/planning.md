# Planejamento — 3 computadores, cada um com seus sub-agentes

Objetivo: chegar ao **MVP v0.1** (SPEC §3: Vila Nova jogável, com metas, evento e dilemas) o mais rápido possível. Cada computador é dono de uma área do repositório e roda vários sub-agentes do Claude Code em paralelo, sem pisar no trabalho dos outros.

---

## 1. Estado atual (após o merge de 13/11/2026)

A `main` junta o trabalho dos três workers até agora:

| Origem | O que está na `main` |
|---|---|
| Arte + Design (fermneto) | SPEC "cidade radical sem carros"; style guide, referências e dados de arte; camada visual completa (pipeline PS1 + Aero, 14 veículos, 11 prédios, 11 radicais, 7 props, vitrine, laboratório, HUD, capturas); canais múltiplos, Torre Espiral, Mega Half-pipe |
| Design (Luciana Lima) | `docs/design/problemas.md` (8 problemas), `docs/design/cenario-01-vila-nova.md`, `config/balance.json` v0.2.0, já alinhados à cidade radical (mesmos ids de veículo e faixa) |
| Engenharia (corre) | **Integrada (Onda 0):** core com testes (`types.ts`, `CityLoader` com erros/avisos, `RoadGraph` com BPR por faixa, `Pathfinding` A\* por modo, `Crossings`, `Vehicles`, `Rng`, `Spatial`), cidade-demo (`public/cities/demo.json`, `scripts/gen-demo-city.ts`), ESLint com regras do core, CI no GitHub Actions, `docs/engineering.md` |
| Integração | Contrato oficial `src/core/types.ts`, com a união: faixas por via, travessias, canais, features, posse de veículos, **personagens** e **cenário** (metas, eventos, dilemas) |

**Decisões do merge** (antigas D1–D7): venceu a cidade radical, sem carros. Faixas `sidewalk/slow/fast/transit`, tandem e tuk-tuk no coletivo e travessias radicais com rota acessível. Os 8 problemas da Luciana viraram a estrutura de design, e os KPIs são as métricas de cada problema. Os overboards saíram do escopo.

**Verificação da `main` integrada:**
- `npm run check` (typecheck da app + do core rígido, lint e testes): **38/38 testes**, incluindo a vitrine validada pelo `CityLoader`
- `npm run build` ok
- `npm run shots` sem erro de console

**Ainda falta:** o loop do jogo (`src/game/`), a simulação de agentes, as regras de jogo e o cenário Vila Nova em dados (`src/assets/cities/vila-nova.json`).

**Próxima sessão:** cada PC segue `docs/sessoes/pcN-*.md`. Os sub-agentes estão definidos em `.claude/agents/`, e as regras gerais em `CLAUDE.md`.

---

## 2. Divisão por computador

| | **PC1 — Arte & Render** | **PC2 — Design & Conteúdo** | **PC3 — Engenharia & Simulação** |
|---|---|---|---|
| Responsável | fermneto | Luciana Lima | corre |
| É dono de | `src/render/**`, `src/ui/**`, `src/lab.*`, `data/arte/**`, `docs/style-guide.md`, `docs/referencias.md`, `docs/validacao-visual.md`, `scripts/screenshots.mjs`, `scripts/gen-vitrine.mjs`, `assets/models|textures` | `docs/design/**`, `config/balance.json`, `src/assets/cities/*.json` (exceto `vitrine.json`), textos (`src/assets/text/**`), `docs/playtests/**` | `src/core/**`, `tests/**`, `src/game/**` (loop do jogo), `package.json`, `tsconfig.json`, `vite.config.ts`, CI (`.github/**`), `docs/engineering.md` |
| Entrega para os outros | Views que leem o estado do `core` (sem lógica de jogo), HUD e painéis, modelos/ícones pedidos pelo cenário | Cenários em JSON válidos, números de equilíbrio, eventos, dilemas e textos | API do `core` (`Simulation`, `Commands`, `Kpis`, eventos), validação dos JSON, testes e build |

**Arquivos compartilhados** (só por PR pequeno, revisado pelo dono):

| Arquivo | Dono | Regra |
|---|---|---|
| `SPEC.md` | por seção: §1–5 PC2 · §5 e §8 (arte/UI) PC1 · §6–7, §10 PC3 | Cada PC edita só as suas seções |
| `src/core/CityFile.ts` (contrato) | PC3 | Mudança de campo exige aviso aos três, porque quebra JSONs e views |
| `data/arte/veiculos.json` (ids) | PC1 | Ids são contrato com `balance.json`: não renomear sem combinar |
| `src/main.ts` | PC1 enquanto for a vitrine; vira `vitrine.ts` quando o PC3 criar `src/game/` | — |
| `eslint.config.js`, `tsconfig*.json`, CI | PC3 | Regras do core (sem three, DOM nem `Math.random`) valem para todos |

---

## 3. Sub-agentes por computador

Os sub-agentes já estão definidos em **`.claude/agents/pcN-*.md`** (escopo, leituras, tarefa padrão e critério de pronto). Cada PC abre **uma sessão principal** (a coordenadora) e dispara sub-agentes em **worktrees isolados** (`isolation: "worktree"`), cada um com escopo de arquivos fechado. A coordenadora revisa, roda as verificações e abre o PR.

### PC1 — Arte & Render
| Sub-agente | Escopo (arquivos) | Primeira tarefa |
|---|---|---|
| `pc1-arte-modelos` | `src/render/models/**` | Assets do cenário Vila Nova que faltam: mercado, estação de carga, casa simples; retratos dos 4 personagens |
| `pc1-arte-views` | `src/render/*View.ts`, `src/render/Overlays.ts` | `SimView`: desenhar os agentes **a partir do estado do core** (substitui o `DemoTraffic` no jogo) |
| `pc1-arte-ui` | `src/ui/**` | Painéis de ferramenta, balões de fala, rádio de eventos, balanço do dia, cartas de dilema |
| `pc1-arte-mundo` | `scripts/gen-vitrine.mjs`, `src/render/Atmosphere.ts` | Pendências: cidade maior, bolhas gigantes, vulcões de gel, dinossauros Aero |

### PC2 — Design & Conteúdo
| Sub-agente | Escopo | Primeira tarefa |
|---|---|---|
| `pc2-design-cenarios` | `src/assets/cities/*.json` | `vila-nova.json` completo no contrato `CityFile` (ruas, faixas, travessias, personagens, cenário) |
| `pc2-design-balance` | `config/balance.json` | Números de escolha modal, BPR, quedas e paciência, com tabela de casos esperados para os testes do PC3 |
| `pc2-design-conteudo` | `docs/design/**`, `src/assets/text/**` | Eventos, dilemas e falas do cenário 1 em JSON; roteiro do tutorial |
| `pc2-design-progressao` | `docs/design/**` | Desenho dos cenários 2–4 (Centro Gel, Orla Bolha, Morro Alto) |

### PC3 — Engenharia & Simulação
| Sub-agente | Escopo | Primeira tarefa |
|---|---|---|
| `pc3-eng-rede` | `src/core/RoadGraph.ts`, `Crossings.ts`, `Pathfinding.ts` + testes | Grafo com faixas, travessias (regra de acessibilidade), A\* por modo |
| `pc3-eng-agentes` | `src/core/Agents.ts`, `Transit.ts`, `Simulation.ts` + testes | Rotinas, escolha modal (logit), BPR, linhas de tuk-tuk; passo fixo e *seed* |
| `pc3-eng-jogo` | `src/core/Commands.ts`, `Kpis.ts`, `Events.ts`, `Save.ts` + testes | Ferramentas com undo, KPIs dos 8 problemas, eventos e dilemas lidos do JSON |
| `pc3-eng-infra` | `package.json`, CI, `src/game/**`, validador de JSON | Vitest + CI (tsc, build, testes, `npm run shots`), loader e validador de `city.json`/`balance.json` |

**Modelo de prompt para um sub-agente** (cole na sessão coordenadora):
> Você é `<nome>` do PC`<n>`. Escopo: só pode alterar `<arquivos>`. Leia `SPEC.md` §`<x>`, `docs/planning.md` e `<docs da área>`. Tarefa: `<tarefa>`. Pronto quando: `npx tsc --noEmit`, `npm test` e `npm run build` passam e `<critério da tarefa>`. Não mexa em arquivos fora do escopo; se precisar mudar um contrato, pare e descreva a mudança no relatório.

---

## 4. Ondas de trabalho (caminho crítico para o MVP)

### 4.0 Onda 0 — integrar `eng/fundacao` ✅ concluída (13/11/2026)

| Caminho | Resultado |
|---|---|
| `src/core/*` da engenharia, `tests/**`, `scripts/gen-demo-city.ts`, `public/cities/demo.json`, `.github/workflows/ci.yml`, `eslint.config.js` | Entraram como estavam |
| Contrato | **`src/core/types.ts` é o oficial**, estendido com `features`, `characters` e `scenario.id/events/dilemmas`. `CityFile.ts` só reexporta e oferece `crossingIsAccessible()` e `waterBands()` |
| Unidades | Adotadas as da engenharia: **1 tile = 10 m**, `width` em m, `speed` em km/h, `ownership` em %, água em `areas` (o render deriva os canais via `waterBands`). O render passou a `TILE_M = 10` e `AGENT_SCALE = 2.0`, e o tamanho visual se manteve |
| Render | A versão da `main` (PC1) prevaleceu. `RadicalView`, `QuadBuilder`, `shading` e `textures` foram removidos (duplicados); `Picking.ts` foi mantido |
| `src/main.ts` | Ficou a vitrine. O protótipo da engenharia está no histórico (`59979c1`) e serve de referência para o `src/game/` |
| Pacotes | three 0.187, vite 8, **vitest 4**, **TypeScript 5.9** (o `typescript-eslint` não suporta o TS 7), eslint 9, `globals`, playwright. Scripts: `typecheck`, `lint`, `test`, `check`, `shots`, `gen:demo`, `gen:vitrine` |
| Rigor de tipos | `tsconfig.core.json` aplica `noUncheckedIndexedAccess` em `src/core` + `tests`; o render ainda não (dívida do PC1, tarefa do `pc1-arte-views`) |
| `.gitignore` | `.claude/*` ignorado, exceto `.claude/agents/` (sub-agentes versionados) |
| `PLANEJAMENTO.md` | Movido para `docs/engineering.md`, com nota da integração no topo |
| CI | Ganhou o passo de capturas visuais (`npm run shots` no Chromium) e o artefato `shots/` |
| Teste novo | `tests/core/vitrine.test.ts`: a vitrine do PC1 valida no `CityLoader` do PC3 |

| Onda | PC1 — Arte & Render | PC2 — Design & Conteúdo | PC3 — Engenharia & Simulação | Marco |
|---|---|---|---|---|
| **1. Contratos** | Assets do Vila Nova; `SimView` usando dados mock; render com `noUncheckedIndexedAccess` | `vila-nova.json` (valida no `CityLoader`) + `balance.json` com casos de teste | `src/game/` (loop + loader), `Simulation` com tick e seed, `getState()` para o render | Vila Nova carrega e aparece no render |
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
4. **Verificação obrigatória** (já está na CI do GitHub Actions):
   - `npm run check` (typecheck app + core rígido, lint e testes), `npm run build`
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
5. Branches antigas apagadas: `arte/cidade-radical-aero`, `design/mobilidade-overboards`, `design/cidade-radical`.
6. `eng/fundacao` (corre) integrada na Onda 0, via `pc3/integracao-fundacao` (detalhes em §4.0). O `Goal` adotado foi o da engenharia (`kpi: KpiId`, `op`, `value`, `stars`).

## 6.1 Sessão 1 do PC1 (13/11/2026): integrada na `main`

| Sub-agente | Entrega |
|---|---|
| `pc1-arte-modelos` | `bld_market`, `bld_house`, `prop_charge_station`, **`rad_volcano`** (Vulcão de Gel), **`prop_dino_neck/runner/horns`** (dinossauros Aero originais), `MeshBuilder.ellipsoid/limb` |
| `pc1-arte-views` | **`src/render/SimState.ts`** (proposta de `Simulation.getState()` + mock determinístico `createMockSim`), `SimView`, `Overlays`, teste `tests/render/simstate.test.ts` |
| `pc1-arte-ui` | `SpeechQueue`/balões com retrato pixelado, `DilemmaCard`, `RadioTicker`, `DayReport` e a página de demonstração `/ui.html?show=…` |
| `pc1-arte-mundo` | Vitrine cerca de 3× maior (2 canais, ilha, 14 travessias, espirais, megapipes, 11 bolhas gigantes), presets de câmera, névoa automática |
| Coordenadora | `noUncheckedIndexedAccess` em **todo** o projeto; `ui.html` no build e nas capturas; lint ignora `.claude/` (worktrees); `.gitignore` cobre o symlink `node_modules` |

Em andamento: **metrópole Aero** (cidade cerca de 1,8× maior, Parque Aero e Distrito Eólico com 8 estruturas gigantes, categoria `marco` ≤ 400 tris).

**Lições para as próximas sessões:**
- Os sub-agentes em worktree usam um symlink para o `node_modules`; o `npm run shots` precisa de `server.fs.strict: false` nesse caso.
- Os agentes de `.claude/agents/` só são carregados quando o Claude Code inicia.

## 7. Bloqueios entre PCs

| Quem espera | De quem | O quê | Quando |
|---|---|---|---|
| PC1 (`SimView`) | PC3 | `Simulation.getState()` | Onda 1 |
| PC2 (`vila-nova.json`) | PC3 | `CityLoader` na `main` | ✅ disponível |
| PC3 (testes de balance) | PC2 | Tabela de casos esperados | Onda 2 |
| PC1 (`SimView` com dados reais) | PC3 | Implementar `Simulation.getState()` no formato de `src/render/SimState.ts` (ou superconjunto); decidir se o arquivo vai para `src/core/`; definir a interpolação entre ticks (1 tick = 1 min) e o render (por quadro) | Onda 1 |
| PC1 (vulcões e dinossauros como features) | PC3 | Novos `FeatureKind` em `types.ts` (ex.: `volcano`, `dino` com espécie). Por enquanto eles entram como `buildings` com `kind: 'park'` | quando der |
| PC1 (UI no jogo) | PC3 | Mapear `KPI_IDS` do core para os ids de KPI da UI (`src/ui/kpis.ts`) | Onda 3 |

## 8. Pendências herdadas (já distribuídas aos sub-agentes)

- `pc1-arte-mundo`: cidade maior, bolhas gigantes, vulcões de gel, dinossauros Aero.
- `pc1-arte-modelos`: assets do Vila Nova.
- `pc2-design-cenarios`: `vila-nova.json`.
- `pc3-eng-infra`: `src/game/` (loop do jogo usando o render do PC1 e o protótipo `59979c1` como referência).
- `pc3-*`: agentes, coletivo, Commands, KPIs, eventos e save.
- `pc1-arte-views`: usar `Picking.screenToTile` no lugar do raycast do `main.ts`; trocar o mock pelo `getState()` real quando sair.
- `pc1-arte-ui`: botões de velocidade sem gel no `hud.css` (`.speed button { background: none }`); integrar balões, rádio, dilema e balanço no jogo (`src/game/`, com o PC3).
