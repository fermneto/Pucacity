# Pucacity — Como validar o visual

O visual tem duas páginas de validação e um script de capturas automáticas. Tudo roda no navegador, com o mesmo pipeline PS1 do jogo.

```bash
npm install
npm run dev          # abre em http://localhost:5173
```

| Página | URL | Para que serve |
|---|---|---|
| **Vitrine** | `http://localhost:5173/` | A cidade inteira: faixas, prédios, travessias radicais, trânsito de demonstração, HUD e overlays |
| **Laboratório** | `http://localhost:5173/lab.html` | Cada asset isolado e girando, com contagem de triângulos × orçamento, silhuetas, atlas e paleta |

> A vitrine atual tem **1 canal e 4 travessias**. O código já aceita vários canais (`canals[]` no `city.json`) e acrobatas presos à Torre Espiral e ao Mega Half-pipe; esses dois elementos já aparecem no laboratório (aba Radicais), mas ainda não estão no mapa (ver pendências em `docs/merge-plan.md`).
>
> O trânsito da vitrine é **só de demonstração visual** (`src/render/DemoTraffic.ts`). A simulação de verdade (SPEC §4) ainda vai ser feita em `src/core/`.

---

## 1. Vitrine (`/`)

**Controles:** arrastar move · roda dá zoom · **Q/E** gira 90° · **T** overlay de tráfego · **A** overlay de acessibilidade · **P** liga/desliga o PS1 · **Espaço** pausa · **1/2/3** velocidade · **H** esconde o HUD · **G** abre o painel visual · clique numa via ou travessia para ver detalhes.

**Painel visual (G):** resolução interna (240/360/480/720), jitter, affine, dither, cor 15-bit, névoa, **wireframe** (mostra os polígonos) e contador de draw calls/triângulos.

**Atalhos por URL** (úteis para revisar sempre do mesmo ângulo):

| Parâmetro | Valores |
|---|---|
| `cam` | `overview`, `canal`, `loop`, `bowl`, `street`, `towers` |
| `overlay` | `traffic`, `access` |
| `ps1=0` | desliga os efeitos (comparação antes/depois) |
| `t=12` | congela a cena depois de 12 s simulados (sempre a mesma imagem) |
| `res=360` | resolução interna |
| `hud=0` | esconde o HUD |
| `agents=800` | quantidade de cidadãos (teste de carga visual) |

Exemplo: `http://localhost:5173/?cam=canal&t=12&overlay=access`

## 2. Laboratório (`/lab.html`)

| Aba | O que validar |
|---|---|
| **Veículos / Prédios / Radicais / Props** | Cada modelo gira no pipeline real. O rodapé mostra `tris / orçamento` em verde ✓ ou vermelho ✗, e o resumo do topo lista quem estourou. Mostra também o nome do `.glb` do contrato Arte → Engenharia |
| **Silhuetas** | Os 14 veículos na via, em três zooms (perto, médio, visão geral), **com a mesma densidade de pixels do jogo em 240 linhas**. É o teste de legibilidade da câmera aérea |
| **Atlas de texturas** | Os 16 tiles 64×64 ampliados sem filtro, com nome e uso |
| **Paleta** | As 13 cores de mundo e as 35 cores de variação por família, mais uma **multidão sorteada** pelas regras de combinação. Use **Sortear cores** no painel |

O painel (**G**) tem os mesmos ajustes PS1, mais **Girar**, **Wireframe**, **Desaturar** (simula os overlays ligados) e **Sortear cores**. O console do navegador imprime uma tabela com o orçamento de todos os modelos.

## 3. Capturas automáticas

```bash
npm run shots              # todas as vistas → shots/*.png
npm run shots -- loop      # só as que têm "loop" no nome
```

O script sobe o Vite, abre cada vista num Chrome headless (com `t=` fixo, para sair sempre igual) e salva os PNGs em `shots/`. O comando **termina com erro se alguma página tiver erro no console**. Use para:

- **comparar antes/depois** de mexer em shader, textura ou modelo;
- **anexar ao PR** ou mostrar na demo da sprint;
- **revisar sem rodar o jogo** (a Direção de Arte pode olhar só os PNGs).

Por padrão ele usa o Google Chrome instalado. Com outro navegador: `PW_CHANNEL=chromium npm run shots` (depois de `npx playwright install chromium`).

---

## 4. Checklist de revisão

**PS1 cru**
- [ ] Em 240 linhas, os pixels são grandes e nítidos (sem borrão), com dither visível nos gradientes do céu.
- [ ] As texturas não têm filtragem (blocos duros) e os polígonos "tremem" levemente ao mover a câmera.
- [ ] O affine deforma um pouco as texturas de perto, mas os pisos **não** viram arcos gigantes (pisos grandes são subdivididos).
- [ ] Com **P**, dá para comparar com o render limpo; o "cru" vem do pipeline, não dos modelos.

**Frutiger Aero**
- [ ] Céu azul royal → azul bebê, nuvens fofas, sol.
- [ ] Vidro e cromo com reflexo do céu e uma faixa de brilho; água turquesa com bolhas subindo.
- [ ] HUD em gel: gradiente, brilho na metade de cima, borda clara, cantos em degrau.

**Legibilidade (prioridade do SPEC)**
- [ ] As faixas se distinguem sem legenda: calçada bege, lenta turquesa, rápida azul com tracejado amarelo, coletiva roxa hachurada.
- [ ] Com **T**, o overlay verde→amarelo→vermelho fica legível por cima de tudo e os veículos perdem a cor.
- [ ] Com **A**, as travessias sem rota acessível aparecem em vermelho (na vitrine, a de x=16 é proposital).
- [ ] Na aba **Silhuetas**, no zoom "perto", cada tipo é reconhecível pela forma.
- [ ] Daltonismo: no Chrome DevTools → *Rendering* → *Emulate vision deficiencies*, teste deuteranopia e protanopia com o overlay de tráfego ligado.

**Orçamentos e dados**
- [ ] O laboratório mostra **todos dentro do orçamento ✓** em cada aba (veículos ≤ 60, prédios ≤ 200, radicais ≤ 300).
- [ ] A paleta-base tem ≤ 32 cores; as 35 de variação seguem as famílias de `data/arte/paleta.json`.
- [ ] Nenhuma textura, fonte ou modelo de terceiros sem licença registrada (hoje tudo é procedural ou fonte OFL).

---

## 5. Onde mexer

| Quero mudar… | Arquivo |
|---|---|
| Shader PS1 (jitter, affine, névoa, brilho Aero) | `src/render/ps1/Ps1Material.ts` |
| Dither / 15-bit / ampliação | `src/render/ps1/PostFx.ts`, `src/render/Renderer.ts` |
| Texturas | `src/render/textures/Atlas.ts` (um desenho por tile) |
| Veículos e cidadãos | `src/render/models/vehicles.ts` |
| Prédios | `src/render/models/buildings.ts` |
| Elementos radicais | `src/render/models/radical.ts` |
| Props | `src/render/models/props.ts` |
| Cores | `data/arte/paleta.json` |
| HUD | `src/ui/hud.ts`, `src/ui/hud.css` |
| Mapa da vitrine | `scripts/gen-vitrine.mjs` → `node scripts/gen-vitrine.mjs` |
| Acrobatas (espiral, half-pipe) | `src/render/DemoTraffic.ts` (`placeStunt`) |
| Plano de merge dos 3 workers | `docs/merge-plan.md` |

Quando os `.glb` do Blender ficarem prontos, eles substituem os modelos procedurais com o mesmo id (`veh_skate`, `bld_res_1`, …). O laboratório continua servindo para conferir orçamento e legibilidade.
