# Pucacity — instruções para sessões do Claude Code

Jogo de gestão de mobilidade numa **cidade radical sem carros** (skates, patinetes, cadeiras de rodas, hoverboards…, coletivo de tandem e tuk-tuk, travessias radicais no lugar de pontes), com estética **PS1 + Frutiger Aero**, em **Three.js + TypeScript + Vite**. Idioma do projeto: **português (pt-BR)**.

## Leia primeiro
1. `docs/planning.md`: divisão em **3 computadores**, quem é dono de cada pasta, ondas até o MVP, fluxo de integração.
2. `docs/sessoes/pcN-*.md`: o roteiro de início da sessão **do seu computador**.
3. `SPEC.md` (visão geral) e o doc da sua área.

## Qual computador é esta sessão?
Pergunte ao usuário se não estiver claro: **PC1 Arte & Render** (fermneto) · **PC2 Design & Conteúdo** (Luciana) · **PC3 Engenharia & Simulação** (corre). Trabalhe **só nas pastas do seu PC** (tabela em `docs/planning.md` §2).

## Sub-agentes
Definidos em `.claude/agents/` com o prefixo do computador (`pc1-*`, `pc2-*`, `pc3-*`). A sessão principal é a **coordenadora**:
- dispara os sub-agentes do seu PC **em paralelo**, cada um em worktree isolado (`isolation: "worktree"`);
- revisa o resultado, roda as verificações e abre o PR.

Sub-agentes não mexem fora do escopo e não alteram contratos sem avisar.

## Regras de git
- **Sempre** `git fetch` antes de começar: os outros computadores dão push o tempo todo.
- Branch por tarefa: `pc1/<tarefa>`, `pc2/<tarefa>`, `pc3/<tarefa>`, a partir da `origin/main` atual.
- PRs pequenos. `git rebase origin/main` antes do PR. Nada de force-push na `main`.
- **Contratos** (`src/core/types.ts` / `CityFile.ts`, ids em `data/arte/veiculos.json`, `config/balance.json`): mudança só em PR próprio, avisando os três.

## Verificação antes de qualquer PR
```bash
npx tsc --noEmit        # tipos
npm run build           # build de produção
npm test                # testes do core (quando o vitest estiver integrado — Onda 0)
npm run shots           # capturas visuais; falha se houver erro no console (ver docs/validacao-visual.md)
```
Mudou modelo? O laboratório (`/lab.html`) precisa mostrar "todos dentro do orçamento ✓".

## Regras de conteúdo
- Nenhum asset de jogo comercial (texturas, modelos, músicas, fontes). Só CC0, CC-BY (com crédito em `docs/creditos.md`) ou OFL. Ver `docs/referencias.md`.
- Designs originais: referências servem só de estilo, nunca para copiar.
- Toda travessia radical tem rota acessível (regra do SPEC).
