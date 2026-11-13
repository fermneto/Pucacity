# Engenharia (PC3) — core, testes e infraestrutura

Dono: PC3 (ver [`planning.md`](planning.md) §2). Escopo: `src/core/**`, `tests/**`, `package.json`, `tsconfig.json`, `vite.config.ts`, `.github/**`, este arquivo.

## Como rodar

```bash
npm install
npm run check      # typecheck (src + tests) + testes do core
npm run build      # build de produção em dist/
npm test           # só os testes (vitest)
```

A CI (`.github/workflows/ci.yml`) roda typecheck, testes e build em todo PR e guarda `dist/` como artefato. `npm run shots` (Playwright) ainda não entrou na CI.

## Decisões

| Tema | Decisão |
|---|---|
| Unidades | 1 tile = 10 m; `edge.width` em metros; `edge.speed` = limite em km/h; veículos em m/s (`data/arte/veiculos.json`); tempo em minutos de jogo |
| Pureza do `core` | Sem `three`, `render/`, `ui/`, `window`/`document`, `Math.random`. Garantido por `tests/core/Architecture.test.ts` (o ESLint com typescript-eslint ainda não suporta TypeScript 7) |
| Aleatoriedade | `core/Rng.ts` (mulberry32 com seed) |
| Dados | O core lê direto `src/core/CityFile.ts` (contrato), `data/arte/veiculos.json`, `data/arte/elementos-radicais.json` e `config/balance.json` |
| Faixas | `lanes` conta faixas **por sentido**. Sem a faixa própria, o veículo usa a vizinha mais lenta (`LANE_FALLBACK`) com `balance.lanes._sharedLanePenalty.speedFactor` |
| Congestionamento | BPR **por faixa** (`balance.congestion.alpha/beta`) |
| Travessias | Cada `crossing` vira, nos 2 sentidos, uma ligação **radical** (só `manobras: true` e com a velocidade mínima de `elementos-radicais.json`; tempo = `balance.radical.*.crossSeconds`) mais a **rota acessível** (`lift`, `walkway`, `transit_only`). A `rail_walkway` sem `access` ganha a passarela implícita (`crossingIsAccessible`) |
| Elevador de Bolha | Tempo de `balance.radical.elevador_bolha.crossSeconds`, capacidade `balance.tools.elevadorBolha.capacityPerMinute` com BPR, o que forma fila |
| Rotas | A\* **por modo** (`findPath(graph, vehicle, a, b)`). A heurística usa a maior velocidade possível (do veículo ou da travessia mais rápida), portanto é admissível; os testes comparam com Dijkstra na vitrine |
| Validação | `validateCity` devolve **erros** (a cidade não carrega) e **avisos** (via sem calçada, travessia sem rota acessível), com o caminho do campo |

## API pronta (onda 1)

| Módulo | O que faz |
|---|---|
| `CityLoader.ts` | `validateCity`, `parseCity`, `loadCity`: valida o `CityFile` inteiro (incluindo canals, features, characters, scenario) |
| `enums.ts` | Listas de valores válidos; quebra a compilação se `CityFile.ts` mudar sem atualizar aqui |
| `Vehicles.ts` | `VEHICLES`, `vehicle(kind)`, `MVP_VEHICLES`: perfis a partir de `veiculos.json` |
| `Crossings.ts` | `RADICALS` (velocidade mínima, pontos), `crossingsWithoutAccess(city)` |
| `RoadGraph.ts` | Grafo dirigido (vias + travessias), `laneFor`, `travelTimeMin`, `canUse`, `saturation`, fluxos por faixa |
| `Pathfinding.ts` | `findPath`: A\* por modo, com arestas bloqueadas opcionais |
| `Spatial.ts` | `nearestNode`/`nearestEdge` para picking (o render converte o mouse em tile) |
| `Rng.ts` | PRNG determinístico com estado salvável |

## Próximo (ondas 2–4, ver planning.md §4)

`Simulation.ts` (tick com passo fixo e seed, `getState()` para o `SimView` do PC1), `Agents.ts` (rotinas, posse, escolha modal logit de `balance.modalChoice`), `Transit.ts`, `Commands.ts` (undo), `Kpis.ts`, `Events.ts`, `Save.ts`.

## Questões abertas

| # | Questão | Para | Hoje no código |
|---|---|---|---|
| 1 | A **cadeira de rodas manual faz manobras?** `veiculos.json` diz `manobras: true`; a premissa da SPEC §1 diz que ela não atravessa a rampa | PC1/PC2 | Segue o JSON |
| 2 | Unidade de `balance.lanes.*.capacityPerWidth` (por metro? por minuto?) | PC2 | Ainda usa placeholders em `DEFAULT_TRAFFIC.laneCapacityVph` |
| 3 | `lanes` é por sentido ou total? | PC2 | Por sentido |
| 4 | O Loop Aéreo exige `manobras`? (`balance` tem só `minSpeed`; a regra de `elementos-radicais.json` diz que só `manobras: true` usam elementos) | PC2 | Exige as duas coisas |
| 5 | `signal.phases` é só a contagem; como cada fase sabe quais arestas libera? | PC2/PC3 | Semáforo ainda não entra no custo |
