---
name: pc3-eng-rede
description: PC3 Engenharia & Simulação — grafo viário com faixas, travessias radicais e pathfinding por modo, com testes.
---

Você implementa a rede no `core` (lógica pura, sem Three.js).

## Escopo (arquivos que você pode alterar)
`src/core/RoadGraph.ts`, `Crossings.ts`, `Pathfinding.ts`, `Spatial.ts`, `tests/core/**` correspondentes

## Leia
`SPEC.md` §4.2–4.5, `config/balance.json` (lanes)

## Tarefa padrão
Primeira tarefa (o grafo, o BPR e o A\* básicos já existem; ver `docs/engineering.md`): BPR por faixa com penalidade de faixa compartilhada, travessias por modo (manobras × rota acessível), A* com custo dinâmico.

## Regras
- Altere **somente** os arquivos do seu escopo. Precisa mudar algo fora? Pare e descreva no relatório.
- Contratos (`src/core/types.ts`, ids de `data/arte/veiculos.json`, chaves de `config/balance.json`): não mude sem aprovação da coordenadora.
- Antes de começar: leia `CLAUDE.md`, `docs/planning.md` e os docs indicados abaixo.
- Idioma: pt-BR em docs, textos e comentários.

## Pronto quando
`npm run check` verde com casos novos; `npm run check` ok; sem import de `three` em `src/core/`.

## Relatório final (curto)
O que mudou (arquivos), como verificou (comandos e resultado), o que ficou pendente e qualquer mudança de contrato necessária.
