# Pucacity — Planejamento de Engenharia

> Escopo deste documento: **apenas a frente de Engenharia** (Three.js, simulação, ferramentas, build, desempenho).
> Fonte de verdade do produto: [`SPEC.md`](../SPEC.md) (cidade radical sem carros, PS1 + Frutiger Aero) e [`docs/style-guide.md`](style-guide.md).
> Planejamento dos três PCs: [`docs/planning.md`](planning.md). Aqui ficam decisões técnicas, contratos e critérios de pronto.

> **Onda 0 (13/11/2026), resumo:** `eng/fundacao` entrou na `main` junto com a camada visual do PC1. O render do PC1 prevaleceu; o contrato oficial é `src/core/types.ts` (`CityFile.ts` só reexporta). A vitrine virou `vitrine.html` e o `index.html` passou a ser o jogo (`src/game/`).

---

## 0. Decisões técnicas (fechadas)

| Tema | Decisão | Motivo |
|---|---|---|
| Stack | TypeScript 5.9 (strict) + Vite 8 + Three.js 0.187 + Vitest 4 + ESLint 9 | TS 5.9 porque o `typescript-eslint` ainda não suporta o TS 7 |
| Rigor de tipos | `noUncheckedIndexedAccess` vale para `src/core` e `tests` via `tsconfig.core.json` (o `npm run typecheck` roda os dois tsconfigs); o render ainda não segue (dívida do PC1) | Core sem `undefined` escondido |
| Separação | `src/core/` **nunca** importa `three`, `render/`, `ui/`, `window`/`document` (regra de lint) | Simulação testável e portável para Web Worker |
| Unidades | 1 tile = 1 unidade Three.js = **10 m**; `edge.width` em **metros**; `edge.speed` = limite em **km/h**; velocidade dos veículos em **m/s**; tempo em **minutos de jogo** | Contrato único entre Arte, Design e código |
| Eixos | `city.x` → Three `x`; `city.y` → Three `z`; altura = Three `y` | Mapa no plano XZ |
| Tick | 1 tick = 1 min de jogo; **passo fixo com acumulador** (`src/game/GameLoop.ts`); 1× = 1 tick/s real (`?tps=`), 2× e 4× multiplicam | Determinismo e independência de FPS |
| Aleatoriedade | PRNG próprio com seed (`core/Rng.ts`, mulberry32); `Math.random` proibido em `core/` (lint) | Cenários reproduzíveis |
| Dados | `core/` e `render/` importam **direto** `data/arte/*.json` e `config/balance.json` | Arte e Design mudam números sem pedir código |
| Faixas | `lanes` conta faixas **por sentido** em vias de mão dupla; sem a faixa própria o veículo usa a vizinha mais lenta (`LANE_FALLBACK`). Fator de velocidade no fallback (hoje 70%), capacidades, espera e velocidade do Elevador de Bolha **passam a vir de `config/balance.json`** (tarefa `pc3-eng-rede`); até lá ficam em `DEFAULT_TRAFFIC` (`core/RoadGraph.ts`) | SPEC §4.2 |
| Tráfego MVP | Fluxo por faixa com BPR + agentes visíveis como amostra | Barato e legível (SPEC §13) |
| Rotas | A\* **por modo**: aresta devolve `Infinity` para quem não pode usá-la; heurística admissível | SPEC §4.4 |
| Travessias | Cada `crossing` vira ligações nos 2 sentidos: **radical** (só `manobras: true` e acima da velocidade mínima) + **acessível** (`lift`, `walkway` ou `transit_only`) | SPEC §4.5 |
| Render | Do PC1: `ShaderMaterial` PS1 único, render target de 240 linhas → tela com `NearestFilter`, dither 15-bit | SPEC §7 |
| Comandos | Padrão Command (`apply`/`revert`/`cost`) + undo/redo | SPEC §4.7 |
| Validação | `city.json` e `config/balance.json` validados na carga com **erros** (bloqueiam, aparecem na tela) e **avisos** (console) | Design/Arte editam sem depender de código |

---

## 1. Estrutura do repositório

```
index.html        → jogo (src/game/main.ts)
vitrine.html      → vitrine visual do PC1 (src/vitrine.ts)
lab.html          → laboratório de assets do PC1 (src/lab.ts)
config/balance.json            # números do Design (validados por loadBalance)
data/arte/*.json               # paleta, veículos, elementos radicais (Arte)
public/cities/*.json           # cidades servidas como estático (demo.json; vila-nova.json do PC2)
src/assets/cities/vitrine.json # cidade da vitrine (gerada por scripts/gen-vitrine.mjs)
scripts/                       # gen-demo-city.ts, gen-vitrine.mjs, screenshots.mjs
src/
  core/                        # lógica pura (sem three) — PC3
    types.ts                   # contrato oficial (CityFile etc.); CityFile.ts só reexporta + waterBands()
    CityLoader.ts              # validateCity/parseCity/loadCity + validateBalance/loadBalance
    Vehicles.ts  Crossings.ts  RoadGraph.ts  Pathfinding.ts  Spatial.ts  Rng.ts
    Simulation.ts  Agents.ts  Transit.ts  Commands.ts  Kpis.ts  Events.ts  Save.ts   # em andamento (Ondas 1–4)
  game/                        # loop do jogo — PC3
    main.ts                    # entrada: carrega cidade/balance, liga simulação, render e HUD
    GameLoop.ts                # passo fixo + acumulador, pausa/1×/2×/4×
    SimulationPort.ts          # interface que espelha a API de core/Simulation.ts
    createSimulation.ts        # ÚNICO ponto de troca mock → Simulation real
    MockSimulation.ts          # simulação de mentira (agentes passeando pelo RoadGraph)
    SimpleSimView.ts           # agentes desenhados com os modelos do PC1 (provisório até o SimView do PC1)
    game.css
  render/                      # PC1 (referência; não editar fora do PC1)
    Renderer.ts  ps1/*  CityView.ts  CameraRig.ts  Atmosphere.ts  DemoTraffic.ts  Picking.ts
    palette.ts  util.ts  models/*  textures/Atlas.ts
  ui/                          # PC1: hud.ts, hud.css
  vitrine.ts  lab.ts           # PC1
tests/core/*.test.ts
```

---

## 2. Contratos

### 2.1 `city.json` (Design → Engenharia)
Implementado em `src/core/types.ts` (SPEC §6). Regras de validação (`CityLoader.validateCity`):

**Erros (a cidade não carrega):**
- `size.w`, `size.h` inteiros > 0; nós e prédios dentro de `[0, w] × [0, h]`.
- IDs únicos por coleção (nós, arestas, travessias, prédios, bairros).
- `from`/`to` de arestas e travessias existem e são diferentes.
- Aresta: `width > 0` (m), `speed > 0` (km/h), `kind` ∈ street/avenue/boulevard, `lanes` só com sidewalk/slow/fast/transit, inteiros ≥ 0, total ≥ 1.
- Travessia: `over` ∈ river/canal/expressway, `radical` ∈ ramp_bridge/air_loop/death_jump/rail_walkway, `access` (se houver) ∈ bubble_lift/glass_walkway/transit_only.
- Bairro: `ownership` só com veículos conhecidos, valores 0–100 (%); `wheelchairShare` entre 0 e 1.
- Semáforo: fases apontam para arestas existentes; soma dos verdes ≤ ciclo.
- `scenario.goals[]`: `kpi` ∈ `KPI_IDS`, `op` ∈ `<=`/`>=`, `stars` ∈ 1/2/3.
- Mensagens com caminho, ex.: `edges[12].lanes.bus: faixa desconhecida`.

**Avisos (a cidade carrega, mas o jogo sofre):** via sem calçada; travessia sem rota acessível.

### 2.2 `config/balance.json` (Design → Engenharia)
`loadBalance()` (em `CityLoader.ts`) valida só as chaves que o código usa e devolve o tipo `Balance`; o resto do arquivo é livre. Teste: `tests/core/Balance.test.ts`.

- **Erros:** `version`; `time.{tickMinutes, minutesPerDay, peaks[]}`; `vehicles.<id>.{fallRisk 0–1, modeCost ≥ 0}`; `lanes.<sidewalk|slow|fast|transit>.{capacityPerWidth, fallRiskMultiplier, noiseMultiplier}`; `congestion.{alpha, beta, saturatedThreshold, gridlockThreshold}`; `modalChoice.weights.{tempo, custo, risco, conforto, diversao}` e `modalChoice.noise`; `citizens.groups.<g>.{share 0–1, speedFactor}`; `citizens.patience.{start, dropPerBadDay, protestThreshold}`.
- **Avisos:** id de veículo que não existe em `data/arte/veiculos.json`; soma dos `share` dos grupos ≠ 1.
- Ao usar uma chave nova do balance no core, acrescente-a ao validador e ao teste.

### 2.3 Simulação → jogo/render
`src/game/SimulationPort.ts` espelha a API de `src/core/Simulation.ts`: `tick()`, `step(min)`, `getState()`, `setCity()`, `serialize()`, `graph`, `city`; construtor `new Simulation(city, { seed, scale, startMinute })`. `SimState` traz `minute/day/minuteOfDay`, `agents` (`AgentView`: x, y em tiles, `heading` em rad com 0 = +x, `edge` = índice de aresta dirigida no `RoadGraph`, `lane`, `group`), `transit`, `edgeSaturation` (por aresta dirigida), `stats` e `statsToday`.

### 2.4 Dados e assets (Arte → Engenharia)
- `data/arte/veiculos.json`: `kind`, `faixa`, `velocidade` [mín, máx] m/s, `manobras`.
- `data/arte/elementos-radicais.json`: `velocidade_minima`, `pontos_gap`.
- Modelos procedurais do PC1 com ids `veh_<kind>`, `bld_*`, `rad_*`, `prop_*`; os `.glb` substituem com o mesmo id.

---

## 3. Questões abertas (para Design/Arte)

| # | Questão | Hoje no código |
|---|---|---|
| 1 | **Cadeira de rodas manual faz manobras?** `veiculos.json` diz `manobras: true`; a premissa do SPEC §1 diz que a cadeira não atravessa sem rota acessível. | Segue o JSON. |
| 2 | `lanes` é **por sentido** ou **total**? | Por sentido. |
| 3 | Como o tuk-tuk cruza numa travessia `transit_only`? | Ligação plana só para coletivo. |
| 4 | Quem pode usar o Elevador de Bolha e a passarela de vidro? | Todos menos coletivos. |
| 5 | **Unidade de `balance.lanes.capacityPerWidth`**: usuários/hora por metro de largura? por faixa? | Ainda não usado; `DEFAULT_TRAFFIC.laneCapacityVph` (usuários/hora por faixa) até o `pc3-eng-rede` migrar. |
| 6 | **Linhas de coletivo** (tuk-tuk, tandem): paradas, rotas e frota não cabem no `city.json` atual. Vão para o `city.json` (`transitLines[]`) ou para o cenário? | O mock cria coletivos de mentira nas vias com faixa coletiva. |
| 7 | **`Goal.op`**: `types.ts` usa `<=`/`>=` sobre o valor absoluto; o `CityFile` antigo propunha `delta<=`/`delta>=` (melhora relativa, como `improvement: 0.20` no balance). | Só `<=`/`>=`; metas relativas precisam de mudança de contrato. |
| 8 | **Ids de veículo no balance**: `config/balance.json → vehicles` usa `pedestre`, `cadeira_rodas`, `patinete`…, mas os ids oficiais são os de `veiculos.json` (`pedestrian`, `wheelchair`, `kick_scooter`…). | `loadBalance` avisa no console; o core não acha esses números até o PC2 alinhar os ids. |

---

## 4. Plano por ondas (Engenharia)

As ondas são as de `docs/planning.md` §4.

- **Onda 0 — integração ✅ (13/11/2026):** core com testes (`types`, `CityLoader`, `RoadGraph` com BPR por faixa, A\* por modo, `Crossings`, `Vehicles`, `Rng`, `Spatial`), cidade-demo, ESLint com regras do core, CI com capturas.
- **Onda 1 — Contratos:** `src/game/` (loop de passo fixo, loader, HUD mínimo) ✅ com `MockSimulation`; `loadBalance` ✅; `Simulation` com tick e seed e `getState()` para o render (em andamento) → trocar em `createSimulation.ts`.
- **Onda 2 — Movimento:** `Agents` (rotinas, posse por bairro, cadeirantes), A\* + BPR com fluxo real, escolha modal, `Transit`; números de `config/balance.json`.
- **Onda 3 — Ferramentas:** `Commands` com undo/redo e custo, `Kpis`, `Events`/dilemas, paciência.
- **Onda 4 — Vertical slice:** `Save`/load, desempenho (60 FPS com 2.000 agentes), determinismo (mesma seed ⇒ mesmo estado).

---

## 5. Riscos técnicos e mitigação

| Risco | Mitigação |
|---|---|
| A\* por modo × milhares de agentes | Cache de rotas por (modo, zona origem, zona destino); recalcular a cada N ticks ou quando o custo mudar > X% |
| Escala de tempo: 1 tick = 1 min, mas a pé/skate um agente anda 100–300 m (10–30 tiles) por minuto | O render interpola entre ticks; o `SimView` do PC1 deve interpolar **ao longo da aresta** (há `edge` no estado). O mock anda só `velocidade × 1,5 s` por tick para ficar legível |
| Faixas ilegíveis em 240 linhas | Exagero visual de largura, cores contrastantes, playtest |
| Gargalo da Engenharia | Mock da simulação, placeholders procedurais, validadores com mensagens claras |
| Determinismo quebrado por ordem de iteração | Arrays ordenados por ID; nada de iterar `Set`/`Map` com inserção dependente de tempo |

---

## 6. Como rodar

Pré-requisito: **Node.js 22+** (o `gen:demo` usa TypeScript nativo do Node 23.6+).

```bash
npm install
npm run dev        # http://localhost:5173/  (jogo)
npm run check      # typecheck (app + core rígido) + lint + testes
npm run build      # typecheck + build de produção em dist/
npm run shots      # capturas em shots/ (jogo, vitrine e lab); falha com erro de console
npm run gen:demo   # regenera public/cities/demo.json
```

| Página | URL | O quê |
|---|---|---|
| **Jogo** | `/` | `src/game/main.ts`: cidade + simulação + HUD |
| **Vitrine** | `/vitrine.html` | validação visual do PC1 (`?cam=`, `?t=`, `?overlay=`; ver `docs/validacao-visual.md`) |
| **Laboratório** | `/lab.html` | assets isolados com orçamento de polígonos |

**Teclas do jogo:** `Espaço` pausa · `1`/`2`/`3` = 1×/2×/4× (também nos botões ▶ do HUD) · arrastar/`WASD`/setas = mover · roda = zoom · `Q`/`E` = girar · `T` overlay de tráfego · `A` overlay de acessibilidade · `P` liga/desliga PS1 · `H` esconde o HUD · `G` painel visual. O quadro de status mostra pausa/velocidade, relógio, FPS e se a simulação é o mock.

**Parâmetros de URL do jogo:** `?city=` (`vitrine` é o padrão; um nome curto vira `public/cities/<nome>.json`, ex. `?city=vila-nova`; ou um caminho), `?seed=1`, `?scale=0.05` (fração da população que vira agente), `?start=420` (minuto inicial), `?tps=1` (ticks/s em 1×), `?t=30` (pré-roda 30 ticks e pausa, para capturas), `?res=240`, `?ps1=0`, `?hud=0`, `?overlay=traffic|access`.

Por que a vitrine é a cidade padrão: é o mapa para o qual o render do PC1 foi afinado (canal, travessias, features) e já valida no `CityLoader`. Hoje o `CityView` assume `node.id === índice` e por isso `?city=demo` (ids começando em 1) mostra erro na tela; correção pendente no PC1.

Se o `city.json` ou o `balance.json` tiver erro, a tela lista todos os problemas; os avisos vão para o console.

**Debug (só em dev):** `__puca` no console: `__puca.state()`, `__puca.sim`, `__puca.graph`, `__puca.loop` (`loop.setSpeed(4)`, `loop.togglePause()`), `__puca.rig`, `__puca.balance`.

### Trocar o mock pela `Simulation` real
1. Quando `src/core/Simulation.ts` estiver na `main`, edite **só** `src/game/createSimulation.ts`: `return new Simulation(city, opts)` e `SIMULATION_KIND = 'core'`.
2. Se a API divergir, ajuste `src/game/SimulationPort.ts` (ou faça-o reexportar os tipos do core).
3. Apague `MockSimulation.ts` quando ninguém mais usar.
4. A vista provisória dos agentes troca pelo `SimView` do PC1 em `createSimView()` (`src/game/main.ts`).
