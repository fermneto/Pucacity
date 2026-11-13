# PucaCity — Planejamento de Engenharia

> Escopo deste documento: **apenas a frente de Engenharia** (Three.js, simulação, ferramentas, build, desempenho).
> Fonte de verdade do produto: a Spec do Projeto. Aqui ficam decisões técnicas, ordem de implementação, contratos e critérios de pronto.

---

## 0. Decisões técnicas (fechadas)

| Tema | Decisão | Motivo |
|---|---|---|
| Stack | TypeScript (strict) + Vite + Three.js + Vitest | Como na spec; build rápido, testes nativos em TS |
| Separação | `src/core/` **nunca** importa `three` (regra de lint) | Simulação testável e portável para Web Worker (v0.2) |
| Unidades | 1 tile = 1 unidade Three.js = **10 m**; velocidade em **km/h**; tempo em **minutos de jogo** | Contrato único entre arte (escala do .glb), design (balance) e código |
| Eixos | `city.x` → Three `x`; `city.y` → Three `z`; altura = Three `y` | Mapa no plano XZ, câmera olhando de cima |
| Tick | 1 tick = 1 min de jogo; passo fixo com acumulador | Determinismo e independência de FPS |
| Aleatoriedade | PRNG próprio com seed (`mulberry32`); proibido `Math.random` em `core/` | Cenários reproduzíveis e testáveis |
| Tráfego MVP | Modelo de **fluxo** com BPR por aresta + veículos visíveis como amostra | Barato e legível (spec §13) |
| Rotas | A\* com heurística = distância / velocidade máxima da rede (admissível) | Custo dinâmico (tempo atual) sem perder otimalidade |
| Capacidade | `capacidade = faixas_carro × 1800 veic/h` (ajustável em `balance.json`) | Valor padrão de engenharia de tráfego |
| Câmera | Começa **perspectiva FOV 40°**, toggle para ortográfica | Decisão em aberto na spec; deixamos as duas e o playtest decide |
| Render | Um único `ShaderMaterial` PS1; render target 320×240 → tela com `NearestFilter` | Spec §7 |
| Comandos | Padrão Command (`apply`/`revert`/`cost`) + pilhas undo/redo | Spec §4.5 |
| Dados | `city.json` validado na carga com mensagens legíveis para o Design | Design/Arte editam sem depender de código |

---

## 1. Estrutura do repositório

```
pucacity/
  index.html
  package.json  tsconfig.json  vite.config.ts
  PLANEJAMENTO.md
  docs/engineering.md          # (a escrever) como rodar, arquitetura, debug
  config/balance.json          # parâmetros do Design (Sprint 2+)
  public/cities/*.json         # cidades servidas como estático
  src/
    core/                      # lógica pura (sem three)
      types.ts                 # CityFile e tipos do contrato
      CityLoader.ts            # parse + validação de city.json
      RoadGraph.ts             # grafo dirigido, capacidade, BPR
      Pathfinding.ts           # A*
      Rng.ts                   # PRNG com seed
      Agents.ts  Transit.ts  Simulation.ts  Kpis.ts  Commands.ts  Save.ts   # próximos sprints
    render/
      Renderer.ts              # low-res target + upscale
      ps1/Ps1Material.ts       # snap + affine + vertex color + fog
      ps1/PostFx.ts            # dither + 15-bit
      CityView.ts              # vias e prédios
      CameraRig.ts             # pan / zoom / rotação 90°
      VehicleView.ts Overlays.ts Picking.ts                                 # próximos sprints
    ui/                        # HUD HTML/CSS
    main.ts
  tests/core/*.test.ts
```

---

## 2. Contratos

### 2.1 `city.json` (Design → Engenharia)
Implementado em `src/core/types.ts`. Regras de validação (`CityLoader`):

- `size.w`, `size.h` inteiros > 0; nós dentro de `[0, w] × [0, h]`.
- IDs únicos por coleção (nós, arestas, prédios, bairros).
- `edge.from`/`edge.to` existem e são diferentes; `lanes ≥ 1`; `speed > 0`.
- `lanesReserved.length < lanes` (sempre sobra ≥ 1 faixa para carros).
- `building.kind` ∈ enum; `rotation` ∈ {0,1,2,3}; `capacity ≥ 0`.
- `building.district` (opcional) aponta para bairro existente.
- Erros retornam **lista completa** (não para no primeiro), ex.: `edges[12].to: nó 99 não existe`.

Campos adicionados ao contrato (propostos ao Design no Sprint 0):
- `building.district?: number` — liga prédio ao bairro (necessário para equidade/acessibilidade).
- `SignalCfg = { cycle: number; phases: { edges: number[]; green: number }[] }` (segundos).
- `Goal = { kpi: KpiId; op: '<=' | '>='; value: number; stars: 1 | 2 | 3 }`.

### 2.2 Assets (Arte → Engenharia)
- `.glb`, origem na base/centro, 1 tile = 1 unidade, nomes `bld_<kind>_<n>.glb`, `veh_<tipo>.glb`.
- Até os modelos chegarem: **placeholders procedurais** (caixas com cor de vértice) — nunca bloquear em asset.
- Atlas `atlas.png` + `atlas.json` (UV por nome).

### 2.3 Entregas da Engenharia para o time
- Build jogável no fim de cada sprint (`npm run build` → `dist/`, publicado em itch.io/GitHub Pages).
- Página `?viewer=assets` para a Arte checar modelos com o filtro PS1.
- Painel de debug (`F3`): FPS, draw calls, ticks/s, toggles PS1, seed.

---

## 3. Plano por sprint (só Engenharia)

### Sprint 0 — Fundação (em andamento)

> Verificado em 2026-11-13: 26 testes passando, `tsc` limpo, `vite build` ok, cidade-demo renderizando em PS1 sem erros no console.
> Debug em dev: `__puca` no console do navegador (grafo, câmera, estado da rota).
> Bônus já adiantado do Sprint 1: picking (`core/Spatial.ts` + `render/Picking.ts`) e rota A\* clicável.
- [x] Projeto Vite + TS strict + Three.js + Vitest
- [x] Tipos do `city.json` + validador com testes
- [x] `RoadGraph` (dirigido, mão dupla vira 2 arestas, BPR) + testes
- [x] A\* + testes
- [x] PRNG com seed + testes
- [x] Render target 320×240 com upscale nearest
- [x] `Ps1Material` (vertex color, fog, snapping, affine com intensidade)
- [x] PostFx (dither Bayer 4×4 + 15-bit, toggle)
- [x] Repositório Git + CI (`.github/workflows/ci.yml`: typecheck, lint, testes, build e artefato `dist/`)
- [x] ESLint: em `src/core/` proíbe `three`, `render/`, `ui/`, `Math.random`, `window`/`document`
- [ ] Publicar no GitHub (criar o repositório remoto e dar push) para o CI rodar

**Pronto quando:** `npm test` verde e a tela mostra a cidade-demo em PS1.

### Sprint 1 — Cidade parada e visível
- Carregar `public/cities/*.json` via `fetch` + validação com erro na tela.
- `CityView`: vias como quads ao longo das arestas (largura ∝ faixas, cor por `kind`), cruzamentos, prédios instanciados por tipo (`InstancedMesh`).
- `CameraRig`: pan (WASD/arrastar), zoom (roda), rotação Q/E em 90° com interpolação, limites do mapa.
- `Picking`: raio → plano y=0 → nó/aresta mais próximo (distância ponto-segmento); painel mostra dados.
- Loader de `.glb` com fallback para placeholder.
- **Decisão a tomar:** editor de cidade (spec §13). Proposta: script `scripts/grid-to-city.ts` que converte um grid ASCII/CSV da planilha do Design em `city.json`.

### Sprint 2 — Gente e carros se movendo
- `Simulation` com relógio, acumulador e velocidades (pausa, 1×, 2×, 4×).
- `Agents`: geração de cidadãos a partir de `district.population` e prédios `res`; destino em `com/ind/school`; horários com pico ~8h/~18h (distribuição do `balance.json`).
- Atribuição de rotas: A\* com custo dinâmico; recálculo incremental (só para quem parte no tick).
- Fluxo por aresta (veículos/h em janela móvel) → BPR → custo.
- `VehicleView`: `InstancedMesh` de carros, amostragem 1:N, interpolação ao longo da aresta.
- Teste de determinismo: mesma seed ⇒ mesmo estado após N ticks (hash do estado).

### Sprint 3 — Ferramentas e KPIs
- `Commands`: `SetOneWay`, `SetSpeedLimit`, `SetSignalTiming`, `ReserveBusLane`; undo/redo; custo e saldo.
- Pré-visualização: rodar uma simulação "sombra" curta para estimar impacto (ou heurística, se pesado).
- `Kpis`: tempo médio, congestionamento, divisão modal, emissões, saldo.
- `Overlays`: cor por aresta (verde→amarelo→vermelho) atualizada a cada N ticks.
- HUD HTML: dinheiro, relógio, velocidade, KPIs, barra de ferramentas, atalhos (spec §8).

### Sprint 4 — Transporte público
- `Transit`: linhas (paradas, headway, frota), ônibus na rede, faixa exclusiva ignora BPR.
- Lotação e espera; escolha modal logit (carro × ônibus × a pé) com parâmetros do `balance.json`.
- Ferramenta de criar/editar linha.

### Sprint 5 — Vertical slice
- `Save`: serializar estado (JSON compacto + versão), < 100 ms; autosave.
- Desempenho: meta 60 FPS com 2.000 agentes visíveis; render sob demanda quando pausado.
- Tutorial interativo (roteiro do Design), toggles PS1 no menu.

### Sprint 6 — Polimento
- Bugs, otimização, build final publicada.

---

## 4. Riscos técnicos e mitigação

| Risco | Mitigação |
|---|---|
| A\* para milhares de agentes por tick | Cache de rotas por par origem-destino-zona, recalcular só a cada N ticks ou quando o custo mudar > X% |
| Vertex snapping "dançando" demais em vista aérea | Intensidade em uniform; padrão leve; desliga no menu |
| Gargalo da Engenharia (1 pessoa) | Placeholders procedurais, dados mock, validador com mensagens claras para o Design se virar sozinho |
| Determinismo quebrado por ordem de iteração | Arrays ordenados por ID; nada de iterar `Set`/`Map` com inserção dependente de tempo |
| Simulação travando a UI | `core/` sem DOM/three desde o dia 1 → mover para Worker é trocar o transporte de mensagens |

---

## 5. Como rodar

Pré-requisito: **Node.js 20+** (https://nodejs.org).

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes do core
npm run build    # build de produção em dist/
```

Teclas (protótipo): `WASD`/arrastar = mover, roda = zoom, `Q/E` = girar, `P` = alterna perspectiva/ortográfica,
`1` jitter on/off, `2` affine on/off, `3` dither on/off, `R` = alterna altura low-res 240/360/480.
Clique em dois cruzamentos = rota A\*; `C` = "hora do rush" aleatória (BPR muda a rota), `X` = zera fluxos, `T` = overlay de congestionamento.

Outra cidade: `http://localhost:5173/?city=cities/minha.json` (arquivo em `public/cities/`). Se o JSON tiver erro, a tela lista todos os problemas.

> A cidade-demo (`public/cities/demo.json`, 48×48, 4 bairros, 2 avenidas com semáforo) foi gerada por script.
> Quando o Design tiver a primeira cidade, ela substitui esta.
