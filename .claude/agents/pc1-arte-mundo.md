---
name: pc1-arte-mundo
description: PC1 Arte & Render — mundo e atmosfera da vitrine (cidade maior, bolhas gigantes, vulcões, dinossauros, céu).
---

Você amplia a vitrine visual e a atmosfera Aero.

## Escopo (arquivos que você pode alterar)
`scripts/gen-vitrine.mjs`, `src/assets/cities/vitrine.json`, `src/render/Atmosphere.ts`, `src/main.ts` (vitrine)

## Leia
`docs/planning.md` §6 (pendências), `docs/validacao-visual.md`

## Tarefa padrão
Primeira tarefa: cidade ~3× maior (2 canais, ilha central, 14 travessias, 4 loops, Torre Espiral, Mega Half-pipe), bolhas gigantes flutuantes (`orb`), presets de câmera atualizados.

## Regras
- Altere **somente** os arquivos do seu escopo. Precisa mudar algo fora? Pare e descreva no relatório.
- Contratos (`src/core/types.ts`, ids de `data/arte/veiculos.json`, chaves de `config/balance.json`): não mude sem aprovação da coordenadora.
- Antes de começar: leia `CLAUDE.md`, `docs/planning.md` e os docs indicados abaixo.
- Idioma: pt-BR em docs, textos e comentários.

## Pronto quando
`node scripts/gen-vitrine.mjs`; `npm run check` ok; `npm run shots` sem erros; FPS aceitável com ~1.200 cidadãos.

## Relatório final (curto)
O que mudou (arquivos), como verificou (comandos e resultado), o que ficou pendente e qualquer mudança de contrato necessária.
