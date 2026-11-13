# Plano de merge — 3 workers

Situação em 13/11/2026. Objetivo: juntar numa única `main` o trabalho dos três workers sem perder nada, com o SPEC coerente e o build verde.

## 1. Inventário

| Worker | Branch | Base | Conteúdo | Arquivos |
|---|---|---|---|---|
| **W1 — Design (esta sessão)** | `main` (`fafcbfb`) + `design/cidade-radical` | `476c3cf` | SPEC "cidade radical sem carros"; style guide, referências, dados de arte; **camada visual completa** em Three.js (pipeline PS1, modelos, vitrine, laboratório, HUD, capturas); em andamento: canais múltiplos, Torre Espiral, Mega Half-pipe, Torre Bolha, pista no telhado, acrobatas | `SPEC.md`, `docs/*`, `data/arte/*`, `src/**`, `scripts/*`, configs |
| **W2 — Design (Luciana Lima)** | `origin/design/mobilidade-overboards` (`4d1c8e7`) | `476c3cf` | SPEC "cidade de overboards" (pranchas flutuantes com bateria, plataformas coletivas); catálogo dos 8 problemas; cenário 01 Vila Nova; `balance.json` | `SPEC.md`, `docs/design/*`, `config/balance.json` |
| **W3 — Engenharia** | **ainda não publicada** | — | — | — |

- `origin/arte/cidade-radical-aero` já está contida na `main` e pode ser apagada.
- **Bloqueio:** o W3 precisa dar push da sua branch antes do passo 4.

## 2. Conflitos

### 2.1 De arquivo

| Arquivo | W1 | W2 | W3 | Conflito |
|---|---|---|---|---|
| `SPEC.md` | reescrito | reescrito | ? | **Alto**: as duas versões partem do mesmo SPEC e mudam quase todas as seções |
| `config/balance.json` | — | novo | ? | Não, mas os nomes de faixa e veículo precisam alinhar com `data/arte/veiculos.json` |
| `docs/design/*` | — | novos | — | Não |
| `src/**`, `package.json`, `vite.config.ts` | novos | — | provável | **Provável com W3**, sobretudo `src/core/` e o setup do projeto |
| `src/core/CityFile.ts` | contrato do `city.json` | contrato no SPEC §8 | provável | **Alto**: há três versões do contrato |

### 2.2 De conceito (precisam de decisão antes do merge)

| # | Tema | W1 (main) | W2 (overboards) | Recomendação |
|---|---|---|---|---|
| D1 | Veículo individual | 11 tipos de rodinhas (skate, patinete, cadeira…) | Overboard (básico, rápido, X9) com **bateria** | **Fundir.** Overboard entra como mais 3 `kind`s. A bateria vira atributo de todos os elétricos (patinete elétrico, hoverboard, monociclo, cadeira motorizada, tuk-tuk, overboard) |
| D2 | Faixas | `sidewalk / slow / fast / transit`, várias por via | `calcada / lenta / normal / expressa`, **uma** por aresta | Manter a via com **várias faixas** (o visual já é assim) e adicionar `express`. Mapa de nomes: calcada→sidewalk, lenta→slow, normal→fast, expressa→express |
| D3 | Coletivo | Tandem e tuk-tuk | Plataforma coletiva (vagão flutuante, esteira, cápsula) | "Plataforma coletiva" vira a **categoria**; tandem, tuk-tuk e cápsula flutuante são variantes |
| D4 | Travessias | Sem pontes; só elementos radicais + rota acessível obrigatória | "Pontes" na infraestrutura | Pontes viram travessias radicais, com a regra de acessibilidade mantida |
| D5 | Indicadores | 10 KPIs (inclui Radicalidade e Energia) | 8 problemas + `kpiWeights` | Os **8 problemas** viram a estrutura do design; os KPIs do W1 são as métricas de cada um. Radicalidade entra como métrica de satisfação/lazer |
| D6 | Contrato `city.json` | `lanes` por via, `crossings`, `canals`, `features`, `ownership`, `wheelchairShare` | `junction`, `characters`, `scenario.events`, prédios `plaza` e `chargeStation` | **União** dos dois em `src/core/CityFile.ts`, que vira a fonte da verdade (o SPEC aponta para ele) |
| D7 | Ferramentas | faixas, sentido, semáforo, linhas, travessia, compartilhamento, tarifa | + rotatória magnética, estação de carga, painel solar, árvore, doca de carga, zona de pedestre | União; os custos ficam em `balance.json` |

## 3. Ordem do merge

0. **Congelar:** cada worker commita e dá push (W1 em `design/cidade-radical`; W3 publica a branch dele). Ninguém commita na `main` até o fim.
1. **Decidir D1–D7** (seção 2.2). Sem isso, o SPEC não tem como ser resolvido.
2. Criar `integracao/3-workers` a partir da `main`.
3. `git merge design/cidade-radical`: sem conflito, só arquivos do W1.
4. `git merge origin/design/mobilidade-overboards`:
   - `SPEC.md`: resolver **por seção**, seguindo as decisões D1–D7. A estrutura do W2 (8 problemas, cenários, v0.3) é a espinha; as seções de arte, travessias e Three.js vêm do W1.
   - `docs/design/*` e `config/balance.json` entram limpos. Depois, num commit separado, alinhar os nomes (D1/D2) e citar as travessias radicais e os veículos de rodinhas no cenário Vila Nova.
5. `git merge <branch do W3>`:
   - `src/core/`: prevalece o W3. `src/render/`, `src/ui/`, `src/lab.ts` e `scripts/`: prevalece o W1.
   - `CityFile.ts`: a união da decisão D6.
   - `package.json`: união das dependências e scripts.
   - `DemoTraffic` continua só como vitrine visual até a simulação do W3 alimentar o render.
6. **Validar** (seção 4).
7. Abrir **PR de `integracao/3-workers` → `main`**, revisado pelos 3, e fazer **merge commit** (sem squash, para manter a autoria).
8. Limpeza: apagar `arte/cidade-radical-aero`, `design/*` e a branch de integração.

## 4. Checklist de validação do merge

- [ ] `npm install && npx tsc --noEmit` sem erros
- [ ] `npm run build` ok
- [ ] `npm run shots` termina com **0 erros de console** (ver `docs/validacao-visual.md`)
- [ ] Laboratório: "todos dentro do orçamento ✓" em todas as abas
- [ ] `vitrine.json` e `vila-nova.json` (W2) validam contra `CityFile.ts`
- [ ] `balance.json` usa os mesmos ids de veículo/faixa que `data/arte/veiculos.json`
- [ ] SPEC sem seções duplicadas nem contraditórias; os links para `docs/design/*` e `docs/*` funcionam
- [ ] Testes do W3 (Vitest em `core/`) passam

## 5. Trabalho de arte pedido pelo design (W2 → W1)

O cenário 01 (`docs/design/cenario-01-vila-nova.md` §11) pede assets. Situação:

| Pedido | Situação |
|---|---|
| Casa, escola, praça com fonte, pedestre | ✓ existem (`bld_res_*`, `bld_school`, `bld_park`, `veh_pedestrian`) |
| Mercado | ✗ a fazer (`bld_market`) |
| Estação de carga | ✗ a fazer (`prop_charge_station`); o `prop_share_station` pode servir de base |
| Overboard ×3 (básico, rápido, X9) | ✗ a fazer (`veh_overboard_*`), ≤ 60 tris, com brilho de **bateria baixa** no shader |
| Drones / carrinho de carga | ✗ a fazer |
| Balões de fala e retratos pixelados | ✗ a fazer (UI) |

## 6. Pendências do W1 (não entram neste merge)

- **Cidade maior e mais maluca:** gerador com 2 canais, ilha central, 14 travessias e cerca de 1.200 cidadãos. O código já aceita vários canais (`canals[]`) e os acrobatas da Torre Espiral e do Mega Half-pipe; falta reescrever `scripts/gen-vitrine.mjs`.
- **Bolhas gigantes flutuantes** (`orb`): tipo já previsto no contrato, render ainda não feito.
- **Vulcões de gel e dinossauros Frutiger Aero**, pedidos pelo usuário: designs originais, low poly lustroso, para os parques e a ilha.
