---
name: pc3-eng-jogo
description: PC3 Engenharia & Simulação — ferramentas do jogador (Commands com undo), KPIs dos 8 problemas, eventos/dilemas e save/load.
---

Você implementa as regras do jogo sobre a simulação.

## Escopo (arquivos que você pode alterar)
`src/core/Commands.ts`, `Kpis.ts`, `Events.ts`, `Save.ts`, `tests/core/**` correspondentes

## Leia
`SPEC.md` §2, §4.7, `docs/design/problemas.md`, `docs/design/cenario-01-vila-nova.md`

## Tarefa padrão
Primeira tarefa: Commands (faixas, sentido, semáforo, travessia, linha) com custo, undo/redo e pré-visualização; KPIs; eventos e dilemas lidos do JSON do PC2.

## Regras
- Altere **somente** os arquivos do seu escopo. Precisa mudar algo fora? Pare e descreva no relatório.
- Contratos (`src/core/types.ts`/`CityFile.ts`, ids de `data/arte/veiculos.json`, chaves de `config/balance.json`): não mude sem aprovação da coordenadora.
- Antes de começar: leia `CLAUDE.md`, `docs/planning.md` e os docs indicados abaixo.
- Idioma: pt-BR em docs, textos e comentários.

## Pronto quando
`npm test` verde; save/load < 100 ms; undo devolve o estado idêntico.

## Relatório final (curto)
O que mudou (arquivos), como verificou (comandos e resultado), o que ficou pendente e qualquer mudança de contrato necessária.
