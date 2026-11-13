# Pucacity — Planejamento de Engenharia

> Escopo deste documento: **apenas a frente de Engenharia** (Three.js, simulação, ferramentas, build, desempenho).
> Fonte de verdade do produto: [`SPEC.md`](SPEC.md) (cidade radical sem carros, PS1 + Frutiger Aero) e [`docs/style-guide.md`](docs/style-guide.md).
> Aqui ficam decisões técnicas, ordem de implementação, contratos e critérios de pronto.


> **Integração de 13/11/2026 (Onda 0):** esta branch entrou na `main` junto com a camada visual do PC1. Mudanças em relação ao texto abaixo:
> - O **render da `main` prevaleceu** (`Renderer`, `ps1/*`, `CityView`, `CameraRig`, `palette`, mais `MeshBuilder`, `Atlas`, `models/*`, `DemoTraffic`). `RadicalView`, `QuadBuilder`, `shading` e `textures` foram removidos porque já existiam em versão própria. O `Picking.ts` foi mantido.
> - O protótipo `src/main.ts` desta branch foi substituído pela vitrine; o loop do jogo vai para `src/game/` (tarefa `pc3-eng-infra`).
> - **O contrato oficial é `src/core/types.ts`**, estendido com `features`, `characters` e `scenario.id/events/dilemmas`. `src/core/CityFile.ts` só reexporta e oferece `waterBands()`.
> - **Versões:** three 0.187, vite 8, vitest 4 e TypeScript 5.9 (por causa do `typescript-eslint`). O `noUncheckedIndexedAccess` vale para `src/core` e `tests` (`tsconfig.core.json`); o render ainda não segue a regra (dívida do PC1).
> - Planejamento geral dos três PCs: `docs/planning.md`.


---

## 0. Decisões técnicas (fechadas)

| Tema | Decisão | Motivo |
|---|---|---|
| Stack | TypeScript (strict) + Vite + Three.js + Vitest + ESLint | Como na spec; build rápido, testes nativos em TS |
| Separação | `src/core/` **nunca** importa `three`, `render/`, `ui/`, `window`/`document` (regra de lint) | Simulação testável e portável para Web Worker (v0.2) |
| Unidades | 1 tile = 1 unidade Three.js = **10 m**; `edge.width` em **metros**; `edge.speed` = limite em **km/h**; velocidade dos veículos em **m/s**; tempo em **minutos de jogo** | Contrato único entre Arte (escala do .glb), Design (balance) e código |
| Eixos | `city.x` → Three `x`; `city.y` → Three `z`; altura = Three `y` | Mapa no plano XZ, câmera olhando de cima |
| Tick | 1 tick = 1 min de jogo; passo fixo com acumulador | Determinismo e independência de FPS |
| Aleatoriedade | PRNG próprio com seed (`mulberry32`); `Math.random` proibido em `core/` (lint) | Cenários reproduzíveis e testáveis |
| Dados da Arte | `core/` e `render/` importam **direto** `data/arte/*.json` (veículos, elementos radicais, paleta) | A Arte muda números/cores sem pedir código |
| Faixas | `lanes` conta faixas **por sentido** em vias de mão dupla; sem a faixa própria o veículo usa a vizinha mais lenta (`LANE_FALLBACK`) a 70% da velocidade | SPEC §4.2 |
| Tráfego MVP | Modelo de **fluxo por faixa** com BPR + agentes visíveis como amostra | Barato e legível (SPEC §13) |
| Rotas | A\* **por modo**: cada aresta devolve `Infinity` para quem não pode usá-la; heurística = distância / velocidade de cruzeiro do veículo (admissível) | SPEC §4.4 |
| Travessias | Cada `crossing` vira 2 ligações nos 2 sentidos: **radical** (só `manobras: true` e acima da velocidade mínima) + **acessível** (`lift`, `walkway` ou `transit_only`) | SPEC §4.5 |
| Elevador de Bolha | Espera fixa (1,5 min) + 1 m/s + capacidade baixa (120/h) com BPR → forma fila | Dilema "radical × inclusão" |
| Câmera | Começa **perspectiva FOV 40°**, toggle para ortográfica | Decisão em aberto na spec; o playtest decide |
| Render | Um único `ShaderMaterial` PS1; render target 240/360/480 linhas → tela com `NearestFilter`; vias desenhadas **2,2× mais largas** que o real | Legibilidade das faixas em baixa resolução |
| Comandos | Padrão Command (`apply`/`revert`/`cost`) + pilhas undo/redo | SPEC §4.7 |
| Dados | `city.json` validado na carga com **erros** (bloqueiam) e **avisos** (não bloqueiam) legíveis para o Design | Design/Arte editam sem depender de código |

---

## 1. Estrutura do repositório

```
pucacity/
  SPEC.md  docs/engineering.md
  docs/                        # style-guide, referências (Arte); engineering.md (a escrever)
  data/arte/*.json             # paleta, veículos, elementos radicais (Arte) — lidos pelo código
  config/balance.json          # números do Design (Sprint 2+)
  public/cities/*.json         # cidades servidas como estático
  scripts/gen-demo-city.ts     # gera a cidade-demo (npm run gen:demo)
  src/
    core/                      # lógica pura (sem three)
      types.ts                 # CityFile e tipos do contrato
      CityLoader.ts            # parse + validação (erros e avisos)
      Vehicles.ts              # perfis dos 13 veículos a partir de veiculos.json
      Crossings.ts             # elementos radicais (elementos-radicais.json), travessias sem acesso
      RoadGraph.ts             # grafo dirigido: vias com faixas + travessias; BPR por faixa
      Pathfinding.ts           # A* por modo
      Spatial.ts               # nó/aresta mais próximos (picking)
      Rng.ts                   # PRNG com seed
      Agents.ts  Transit.ts  Simulation.ts  Kpis.ts  Commands.ts  Save.ts   # próximos sprints
    render/
      Renderer.ts              # low-res target + upscale
      ps1/Ps1Material.ts       # snap + affine + vertex color + fog (env map Aero: Sprint 5)
      ps1/PostFx.ts            # dither + 15-bit
      CityView.ts              # chão, água, vias (uma tira por faixa), prédios
      RadicalView.ts           # rampas, loop, rail, elevador, passarela (placeholders)
      palette.ts               # cores de paleta.json + cores de faixa (placeholder)
      CameraRig.ts  Picking.ts  QuadBuilder.ts  shading.ts  textures.ts
      VehicleView.ts Overlays.ts                                            # próximos sprints
    ui/                        # HUD HTML/CSS
    main.ts
  tests/core/*.test.ts
```

---

## 2. Contratos

### 2.1 `city.json` (Design → Engenharia)
Implementado em `src/core/types.ts` (SPEC §6). Regras de validação (`CityLoader`):

**Erros (a cidade não carrega):**
- `size.w`, `size.h` inteiros > 0; nós e prédios dentro de `[0, w] × [0, h]`.
- IDs únicos por coleção (nós, arestas, travessias, prédios, bairros).
- `from`/`to` de arestas e travessias existem e são diferentes.
- Aresta: `width > 0` (m), `speed > 0` (km/h), `kind` ∈ street/avenue/boulevard, `lanes` só com sidewalk/slow/fast/transit, inteiros ≥ 0, total ≥ 1.
- Travessia: `over` ∈ river/canal/expressway, `radical` ∈ ramp_bridge/air_loop/death_jump/rail_walkway, `access` (se houver) ∈ bubble_lift/glass_walkway/transit_only.
- Bairro: `ownership` só com veículos conhecidos, valores 0–100 (%); `wheelchairShare` entre 0 e 1.
- Semáforo: fases apontam para arestas existentes; soma dos verdes ≤ ciclo.
- Mensagens com caminho, ex.: `edges[12].lanes.bus: faixa desconhecida`.

**Avisos (a cidade carrega, mas o jogo sofre):**
- Via sem calçada.
- Travessia sem rota acessível (a regra "ninguém fica preso" vira problema de jogo, não de arquivo).

**Extensões propostas ao Design (já aceitas pelo validador, opcionais):**
- `building.district?: number`: liga prédio ao bairro (Equidade/Acessibilidade).
- `areas?: { kind: 'water' | 'blocked'; x; y; w; h }[]`: canais, rios e patrimônio. A spec cita áreas bloqueadas, mas o contrato não tinha onde desenhá-las.
- `SignalCfg = { cycle; phases: { edges: number[]; green: number }[] }` (segundos).
- `Goal = { kpi; op: '<=' | '>='; value; stars }` com `kpi` ∈ avgTripMinutes, congestionPct, accessibilityPct, equityGapMinutes, radicalityPct, energyKwh, balance, satisfaction.

### 2.2 Dados e assets (Arte → Engenharia)
- `data/arte/veiculos.json`: `kind`, `faixa`, `velocidade` [mín, máx] m/s, `manobras`. O código usa a média como velocidade de cruzeiro e o máximo para a velocidade mínima dos elementos.
- `data/arte/elementos-radicais.json`: `velocidade_minima` (Loop Aéreo = 7 m/s), `pontos_gap`.
- `data/arte/paleta.json`: cores `mundo` (céu, água, grama, concreto, vidro, cromo, faixas de lançamento/aterrissagem).
- `.glb`, origem na base/centro, 1 tile = 1 unidade, nomes `bld_<kind>_<n>.glb`, `veh_<kind>.glb`, `rad_<kind>.glb`.
- Até os modelos chegarem: **placeholders procedurais**. Nunca bloquear em asset.

### 2.3 Entregas da Engenharia para o time
- Build jogável no fim de cada sprint (o CI gera o artefato `dist/`).
- Página `?viewer=assets` para a Arte checar modelos com o filtro PS1 (Sprint 1).
- Painel de debug: hoje o HUD + `__puca` no console em dev; `F3` com toggles na Sprint 2.

---

## 3. Questões abertas (para Design/Arte)

| # | Questão | Hoje no código |
|---|---|---|
| 1 | **Cadeira de rodas manual faz manobras?** `veiculos.json` diz `manobras: true`, mas a premissa da SPEC (§1) diz que a cadeira "não consegue atravessar o canal porque a única travessia é uma rampa de salto". | Segue o JSON: a cadeira manual usa rampas. Basta mudar para `false` no JSON para ela passar a precisar do elevador. |
| 2 | **Cores do piso de cada faixa.** O style guide pede cores diferentes, mas `paleta.json` não define quais. | Placeholders em `render/palette.ts`: calçada = concreto, lenta = Lilás Gloss, rápida = Azul Céu XP, coletiva = Laranja Cone. |
| 3 | `lanes` é **por sentido** ou **total**? | Por sentido (como estava no contrato anterior). |
| 4 | Como o tuk-tuk cruza numa travessia `transit_only`? | Ligação plana só para coletivo (faixa laranja). |
| 5 | Quem pode usar o Elevador de Bolha e a passarela de vidro? | Todo mundo menos veículos coletivos. Skatista também pode, só que mais devagar. |
| 6 | Capacidades, esperas e penalidades (faixa, elevador, elementos). | Placeholders em `DEFAULT_TRAFFIC` (`core/RoadGraph.ts`), a migrar para `config/balance.json`. |

---

## 4. Plano por sprint (só Engenharia)

### Sprint 0 — Fundação

- [x] Projeto Vite + TS strict + Three.js + Vitest + ESLint
- [x] Contrato `city.json` da spec nova + validador com erros/avisos + testes
- [x] Perfis de veículos e elementos radicais lidos de `data/arte/*.json`
- [x] `RoadGraph`: faixas por tipo, fallback de faixa, BPR por faixa, travessias (radical + acessível)
- [x] A\* por modo + testes (rampa, loop com velocidade mínima, elevador, só coletivo, travessia sem acesso)
- [x] PRNG com seed + testes
- [x] Render target low-res, `Ps1Material`, PostFx (dither 15-bit), toggles
- [x] Cidade-demo com canal, 6 travessias (1 sem rota acessível), faixas por tipo, céu e gramado Aero
- [x] CI (`.github/workflows/ci.yml`: typecheck, lint, testes, build, artefato `dist/`)
- [ ] Revisão do PR `eng/fundacao` pelo time

Verificado em 2026-11-13: 36 testes, `tsc` e lint limpos, cidade-demo renderizando sem erros no console, 60 fps.

### Sprint 1 — Cidade parada e visível
- Carregar `public/cities/*.json` com erro na tela (feito) e avisos visíveis no HUD.
- `CityView`: curvas e cruzamentos melhores, marcação de faixa, quarter-pipes de esquina.
- `RadicalView`: trocar placeholders por `rad_*.glb` quando chegarem; `InstancedMesh` por tipo.
- `CameraRig`: limites e zoom ajustados; `Picking` de via/nó/**travessia** com painel de seleção.
- Céu com nuvens e brilho Aero (gradiente já existe).
- **Decisão a tomar:** editor de cidade (SPEC §13). Proposta: estender `scripts/gen-demo-city.ts` para ler uma planilha/grid do Design.

### Sprint 2 — Gente rolando
- `Simulation` com relógio, acumulador e velocidades (pausa, 1×, 2×, 4×).
- `Agents`: cidadãos a partir de `district.population`, `ownership` e `wheelchairShare`; destinos em `com/ind/school/skatepark`; picos ~8h/~18h.
- Escolha modal v1 (logit: tempo + custo + conforto + **diversão** dos elementos radicais na rota).
- Fluxo por faixa e por ligação de travessia (janela móvel) → BPR.
- `VehicleView`: `InstancedMesh` por tipo de veículo, cor sorteada de `veiculos_moda` respeitando `regras_combinacao`.
- Teste de determinismo: mesma seed ⇒ mesmo estado após N ticks.

### Sprint 3 — Ferramentas, KPIs e travessias
- `Commands`: divisão de faixas, sentido, semáforo, limite, **trocar elemento/rota acessível da travessia**; undo/redo; custo.
- `Kpis`: tempo médio, congestionamento por faixa, divisão modal, **acessibilidade** (inclui cadeirantes), equidade, radicalidade, saldo.
- `Overlays`: tráfego (`T`) e **acessibilidade** (`A`, destaca travessias sem rota acessível).
- Animação de salto/loop sobre a curva do elemento.

### Sprint 4 — Transporte coletivo
- `Transit`: linhas de tuk-tuk (paradas, headway, frota) na faixa coletiva; lotação e espera.
- Escolha modal com coletivo; tuk-tuk acessível leva cadeirantes pelas travessias `transit_only`.

### Sprint 5 — Vertical slice
- `Save` (< 100 ms), desempenho (60 FPS com 2.000 agentes), env map Aero (vidro/cromo), feedback "radical" no HUD, tutorial interativo.

### Sprint 6 — Polimento
- Bugs, otimização, build final publicada.

---

## 5. Riscos técnicos e mitigação

| Risco | Mitigação |
|---|---|
| A\* por modo × milhares de agentes | Cache de rotas por (modo, zona origem, zona destino); recalcular a cada N ticks ou quando o custo mudar > X% |
| 13 veículos × faixas × travessias = muitas combinações para testar | Testes por regra (fallback, velocidade mínima, acesso) na cidade mínima + A\* = Dijkstra na demo para cada modo |
| Faixas ilegíveis em 320×240 | Exagero visual de largura (`ROAD_VISUAL_SCALE`), cores contrastantes, playtest de legibilidade |
| Vertex snapping "dançando" demais | Intensidade em uniform; desliga no menu |
| Gargalo da Engenharia (1 pessoa) | Placeholders procedurais, dados da Arte lidos direto, validador com mensagens claras |
| Determinismo quebrado por ordem de iteração | Arrays ordenados por ID; nada de iterar `Set`/`Map` com inserção dependente de tempo |

---

## 6. Como rodar

Pré-requisito: **Node.js 22+** (o script da cidade-demo usa TypeScript nativo do Node 23.6+).

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run check      # typecheck + lint + testes
npm run build      # build de produção em dist/
npm run gen:demo   # regenera public/cities/demo.json
```

Teclas (protótipo):
- `WASD`/arrastar = mover, roda = zoom, `Q/E` = girar, `P` = alterna perspectiva/ortográfica.
- Clique em dois cruzamentos = rota A\*; `M` = troca o modo (Pedestre, Cadeira de Rodas, Skate, Patinete, Tuk-tuk).
- `C` = "hora do rush" aleatória (o BPR muda a rota), `X` = zera fluxos, `T` = overlay de congestionamento.
- `1` jitter, `2` affine, `3` dither, `R` = altura low-res 240/360/480.

Outra cidade: `http://localhost:5173/?city=cities/minha.json` (arquivo em `public/cities/`). Se o JSON tiver erro, a tela lista todos os problemas; os avisos vão para o console.
