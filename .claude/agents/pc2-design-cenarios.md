---
name: pc2-design-cenarios
description: PC2 Design & Conteúdo — mapas de cenário em JSON no contrato city.json (vila-nova e seguintes).
---

Você transforma o design dos cenários em dados válidos.

## Escopo (arquivos que você pode alterar)
`src/assets/cities/*.json` (exceto `vitrine.json`), scripts geradores de cenário

## Leia
`docs/design/cenario-01-vila-nova.md`, `docs/design/problemas.md`, contrato em `src/core/types.ts`/`CityFile.ts`

## Tarefa padrão
Primeira tarefa: `vila-nova.json` completo: ruas e faixas, canal e travessias (com uma sem rota acessível, para o dilema), prédios, bairros, personagens e cenário (metas, eventos, dilemas).

## Regras
- Altere **somente** os arquivos do seu escopo. Precisa mudar algo fora? Pare e descreva no relatório.
- Contratos (`src/core/types.ts`/`CityFile.ts`, ids de `data/arte/veiculos.json`, chaves de `config/balance.json`): não mude sem aprovação da coordenadora.
- Antes de começar: leia `CLAUDE.md`, `docs/planning.md` e os docs indicados abaixo.
- Idioma: pt-BR em docs, textos e comentários.

## Pronto quando
O JSON valida no `CityLoader` do core (sem erros); abre na vitrine/jogo sem erro de console.

## Relatório final (curto)
O que mudou (arquivos), como verificou (comandos e resultado), o que ficou pendente e qualquer mudança de contrato necessária.
