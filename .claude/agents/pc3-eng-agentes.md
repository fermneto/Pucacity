---
name: pc3-eng-agentes
description: PC3 Engenharia & Simulação — cidadãos, rotinas, escolha modal, coletivo e o tick determinístico da simulação.
---

Você implementa a simulação de deslocamento no `core`.

## Escopo (arquivos que você pode alterar)
`src/core/Agents.ts`, `Transit.ts`, `Simulation.ts`, `Rng.ts`, `tests/core/**` correspondentes

## Leia
`SPEC.md` §4.3–4.8, `config/balance.json`, `docs/design/balance-casos.md`

## Tarefa padrão
Primeira tarefa: rotina casa→trabalho→casa com picos, escolha modal logit com diversão, linhas de tuk-tuk/tandem com lotação, passo fixo com seed; expor `Simulation.getState()` para o render.

## Regras
- Altere **somente** os arquivos do seu escopo. Precisa mudar algo fora? Pare e descreva no relatório.
- Contratos (`src/core/types.ts`/`CityFile.ts`, ids de `data/arte/veiculos.json`, chaves de `config/balance.json`): não mude sem aprovação da coordenadora.
- Antes de começar: leia `CLAUDE.md`, `docs/planning.md` e os docs indicados abaixo.
- Idioma: pt-BR em docs, textos e comentários.

## Pronto quando
`npm test` verde (incluindo os casos do PC2); mesma seed → mesmo resultado; 2.000 agentes simulados a 60 FPS num Worker ou na thread principal.

## Relatório final (curto)
O que mudou (arquivos), como verificou (comandos e resultado), o que ficou pendente e qualquer mudança de contrato necessária.
