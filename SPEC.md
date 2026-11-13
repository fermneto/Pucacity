# PucaCity — Spec do Projeto

Jogo de gestão de **mobilidade urbana** numa cidade **sem carros**, onde as pessoas se deslocam de **overboards** (pranchas flutuantes com bateria), a pé e em **plataformas coletivas**. Estética **PlayStation 1 (PS1)**, rodando no navegador com **Three.js**.

O jogador **não constrói a cidade do zero**: recebe uma cidade que já existe, com problemas, e precisa reorganizar o fluxo, a energia e o espaço público para ela funcionar melhor.

> **Histórico de direção:** simulador 2D de construção → estética PS1 3D → mobilidade numa cidade pré-existente → **cidade sem carros, com overboards**, e foco em **surpresa/tensão** e **progressão/rejogabilidade**.
>
> **Documentos de design (fonte de verdade das regras e do conteúdo):**
> - [`docs/design/problemas.md`](docs/design/problemas.md) — catálogo dos 8 problemas urbanos, soluções, eventos e progressão
> - [`docs/design/cenario-01-vila-nova.md`](docs/design/cenario-01-vila-nova.md) — primeiro cenário (tutorial)
> - [`config/balance.json`](config/balance.json) — parâmetros de equilíbrio (provisórios)

---

## 1. Visão geral

**Premissa:** a cidade está travada: pistas lotadas de overboards, baterias acabando no meio da rua, calçadas quebradas e bairros isolados. Você é o(a) responsável pela mobilidade. Com orçamento limitado, reorganize pistas, cruzamentos, estações de carga, plataformas coletivas e regras, e veja as pessoas reagirem.

**Fantasia do jogador:** planejador urbano que ajusta o sistema e observa o efeito em milhares de pequenos cidadãos com nome e opinião.

**Plataforma:** navegador desktop (Chrome/Firefox/Safari).

**Público:** fãs de jogos de gestão e de sistemas (SimCity, Cities: Skylines, Mini Metro, Block'hood) e de estética retrô.

**Princípios**
- **A cidade é dado, não construção:** o mapa vem de um arquivo; o jogador muda a mobilidade, não o layout dos prédios.
- **Todo ganho tem custo:** cada intervenção ajuda um grupo e prejudica outro.
- **Causa e efeito legíveis:** toda mudança aparece no mapa em segundos.
- **Surpresa e tensão** e **progressão e rejogabilidade** são os dois focos de diversão.
- **Simulação separada da renderização:** `core/` não conhece o Three.js.
- **Estética PS1 a serviço da legibilidade.** Efeitos ajustáveis.

---

## 2. Mundo e modos de deslocamento

| Modo | Característica |
|---|---|
| **Pedestre** | Lento, sem custo, depende de calçada e travessia |
| **Overboard** | Individual; tem **bateria**, velocidade e risco de queda; tipos: básico, rápido, X9 |
| **Plataforma coletiva** | Vagão flutuante / esteira / cápsula com linhas, paradas, frequência e lotação |
| **Carga** | Drones e carrinhos-plataforma; usam docas e janelas de entrega |

**Infraestrutura:** pistas (lenta, normal, expressa), calçadas, travessias, rotatórias magnéticas, pontes, estações de carga, painéis solares, baterias comunitárias, docas, paradas.

**Poluição** tem dois lados: **energética** (bateria e rede elétrica) e **ambiental** (ruído, calor, lixo eletrônico).

---

## 3. Os 8 problemas urbanos

Detalhados em [`docs/design/problemas.md`](docs/design/problemas.md).

| # | Problema | Resumo | KPI principal |
|---|---|---|---|
| P1 | Congestionamento de fluxo | Gargalos e picos de 8h e 18h | Tempo médio de viagem |
| P2 | Segurança e quedas | Velocidade e pedestre dividindo espaço | Quedas por 1.000 viagens |
| P3 | Energia e bateria | Rede não aguenta carga simultânea | % de demanda atendida |
| P4 | Ruído, calor e lixo eletrônico | Turbinas, asfalto, baterias descartadas | Índice de ruído / temperatura |
| P5 | Desigualdade e acesso | Periferia isolada | % com serviços a ≤ 15 min |
| P6 | Acessibilidade | Cidade pensada para quem anda de overboard | % de PMR que chega ao destino |
| P7 | Clima e infraestrutura frágil | Chuva, alagamento, pontes | Tempo de recuperação |
| P8 | Uso do espaço, comércio e entregas | Fluxo × pedestre × carga | Movimento do comércio |

**Núcleo do jogo:** os problemas se chocam (mais velocidade resolve P1 mas piora P2 e P4). Ver tabela de conflitos em `problemas.md`.

---

## 4. Objetivo, modos e progressão

**Meta por cenário:** 1 meta principal + 2 de equilíbrio, com 1 a 3 estrelas:
- ⭐ resolveu a meta principal;
- ⭐⭐ resolveu sem piorar outro problema;
- ⭐⭐⭐ resolveu, sem piorar, e melhorou a equidade.

**Campanha (8 cenários):** cada cidade ensina um problema e libera novas ferramentas; a última mistura tudo.

| # | Cenário | Problema principal |
|---|---|---|
| 1 | Vila Nova (tutorial) | P1 |
| 2 | Centro Antigo | P8 |
| 3 | Porto | P7 |
| 4 | Morro Alto | P6 |
| 5 | Distrito Tech | P3 |
| 6 | Cidade Verde | P4 |
| 7 | Zona Sul | P5 |
| 8 | Pucacity | Todos |

**Rejogabilidade:** sandbox, seed diária/semanal com ranking, desafios com restrições, modificadores, modo Caos, estilos de governo (Tecnocrata, Planejador Verde, Populista, Equilibrista), conquistas e cidades da comunidade (`city.json` exportável).

**Surpresa e tensão:** eventos (festival, apagão, chuva, onda de calor, tempestade magnética, greve), crises curtas, dilemas e personagens recorrentes. Detalhes em `problemas.md` §3.

---

## 5. Escopo

### MVP (v0.1)
- **Cenário 1 — Vila Nova** completo e jogável (~15 min).
- Rede viária com pistas e mão única; pedestres e overboards como agentes.
- Ferramentas: sentido da via, tipo de pista, limite de velocidade, rotatória magnética, travessia, 1 linha de plataforma coletiva.
- Escolha modal (pé / overboard / plataforma) e bateria simples.
- Overlays: fluxo, quedas, tempo de viagem; HUD com KPIs e metas.
- Evento do festival, 1 dilema, balão de reclamação dos moradores, 3 personagens com nome.
- Pipeline visual PS1 (baixa resolução, névoa, textura sem filtro; jitter/affine opcionais).
- Salvar/carregar.

### v0.2
- Cenários 2 a 4; P6, P7 e P8; eventos adicionais.
- Energia (P3) e ruído/calor (P4): painéis solares, baterias comunitárias, arborização, reciclagem.
- Políticas como cartas, árvore de desbloqueio e estilos de governo.
- Seed diária, desafios, modo Caos.

### v0.3
- Cenários 5 a 8, desigualdade (P5), conquistas, cidades da comunidade, importação de cidade real (OSM), simulação em Web Worker.

### Fora de escopo
- Construir/zonear prédios livremente; terreno com elevação; multiplayer; simulação física realista de colisões.

---

## 6. Mecânicas e simulação

### 6.1 Cidadãos
- Têm **casa**, **destinos**, **horário**, **grupo** (adulto, idoso, estudante, entregador), **overboard** com bateria e **barra de paciência** (protestos se esvaziar).
- Rotina diária: trabalho de manhã, volta à tarde, lazer à noite. Picos às ~8h e ~18h.
- **Escolha modal:** `desutilidade = tempo·wt + custo·wc + risco·wr + (1−conforto)·wf` (pesos em `balance.json`), com ruído; menor vence.
- Se um modo melhora, mais gente migra para ele.

### 6.2 Fluxo
- Rede = grafo dirigido (nós = cruzamentos, arestas = trechos com tipo de pista, capacidade, velocidade).
- Rota: A\* / Dijkstra com custo = tempo atual (inclui congestionamento).
- Congestionamento: função BPR `t = t0·(1 + α·(fluxo/capacidade)^β)`; veículos visíveis são amostra do fluxo.
- **Quedas:** probabilidade por trecho = risco do overboard × multiplicador da pista × densidade × presença de pedestres.

### 6.3 Bateria e energia
- Cada overboard consome bateria por tile; abaixo do limite, o cidadão procura estação de carga.
- A demanda de carga soma-se na rede elétrica; acima da oferta, há **apagão parcial** no pico.
- Soluções: estações, painéis solares, baterias comunitárias, tarifa por horário.

### 6.4 Plataformas coletivas
- Linha = paradas + frequência + frota; custo operacional por dia; lotação com espera e desistência.

### 6.5 Ferramentas do jogador
Sentido de via, tipo de pista, limite de velocidade, rotatória magnética, travessia/calçada/rampa, zona de pedestre, doca de carga, estação de carga, painel solar, bateria comunitária, arborização, linha coletiva, tarifa e políticas. Cada uma é um **Command** com custo, prazo de obra, undo/redo e prévia de impacto. Obras **bloqueiam o trecho** enquanto duram.

### 6.6 Tempo e economia
1 tick = 1 minuto de jogo; 1 dia = 1440 ticks (comprimido por velocidade). Orçamento por cenário; receitas de tarifas/multas; custos de obra e operação.

---

## 7. Direção de arte (PS1)

| Característica PS1 | Como reproduzir |
|---|---|
| Baixa resolução (~320×240) | Render target pequeno ampliado com `NearestFilter` |
| Texturas pequenas, sem filtro | 32×32 / 64×64, `NearestFilter`, sem mipmaps |
| Vertex jitter | Vertex shader arredonda posições em espaço de tela |
| Affine texture warping | Truque `uv * w` no shader |
| Iluminação por vértice | Cores de vértice *baked*; sem luzes dinâmicas |
| Dither + cor 15-bit | Pós-processo Bayer 4×4 + quantização |
| Névoa curta | Fog no shader |
| Modelos low-poly | Prédios 12–200 tri; overboards, pedestres e drones 20–60 tri |

**Legibilidade para um jogo de fluxo:**
- Pistas lenta/normal/expressa, calçada, trilho e parada devem ser distinguíveis por cor, textura e forma.
- Overboards pequenos e com cor por tipo; a **bateria baixa** tem sinal visual (brilho vermelho).
- Overlays de dados (verde → amarelo → vermelho) claros por cima do visual PS1.
- Efeitos PS1 intensos com **controle de intensidade**.
- **Balões de fala** e retratos pixelados para moradores com nome.

**Referências de feeling:** SimCity 2000 (PS1), Driver, Ape Escape, Silent Hill (névoa), Mini Metro (clareza de rede).

---

## 8. Arquitetura e dados

```
src/
  core/                # Lógica pura, sem Three.js (testável)
    City.ts            # carrega city.json; prédios, bairros, POIs
    RoadGraph.ts       # nós, arestas, pistas, capacidade
    Pathfinding.ts     # A*/Dijkstra com custo dinâmico
    Agents.ts          # cidadãos, rotinas, escolha modal, bateria
    Energy.ts          # rede elétrica, estações, apagões
    Transit.ts         # linhas, paradas, veículos, lotação
    Events.ts          # eventos, dilemas, crises
    Simulation.ts      # tick(), sistemas
    Kpis.ts            # métricas, metas, estrelas
    Commands.ts        # ferramentas do jogador (undo/redo)
    Save.ts
  render/              # Tudo que toca Three.js
    Renderer.ts
    ps1/Ps1Material.ts
    ps1/PostFx.ts
    CityView.ts
    AgentView.ts       # overboards, pedestres, drones (instanciados)
    Overlays.ts        # heatmaps de fluxo, quedas, calor, ruído, bateria
    Picking.ts
    CameraRig.ts
  ui/                  # HUD em HTML/CSS (fonte bitmap)
  assets/models, textures, cities
  main.ts
config/balance.json
docs/design/*.md
```

**Fluxo:** `input → Command → core muda → eventos → render atualiza só o afetado`.

**Stack:** TypeScript + Vite + Three.js; Vitest em `core/`. Simulação em Web Worker (v0.3).

**Formato da cidade (contrato Design ↔ Engenharia ↔ Arte):**

```ts
interface CityFile {
  name: string;
  size: { w: number; h: number };
  nodes: { id: number; x: number; y: number; junction?: 'plain' | 'roundabout' | 'priority' }[];
  edges: { id: number; from: number; to: number;
           lane: 'lenta' | 'normal' | 'expressa' | 'calcada';
           oneWay: boolean; width: number }[];
  buildings: { id: number; x: number; y: number;
               kind: 'res' | 'com' | 'ind' | 'school' | 'hospital' | 'park' | 'plaza' | 'chargeStation';
               capacity: number; model: string; rotation: 0 | 1 | 2 | 3 }[];
  districts: { id: number; name: string; income: 'low' | 'mid' | 'high'; population: number }[];
  characters?: { id: string; name: string; group: string; home: number; work?: number }[];
  scenario?: { id: string; goals: Goal[]; budget: number; durationDays: number; events: string[] };
}
```

Parâmetros de equilíbrio vêm de `config/balance.json` (Design edita, Engenharia valida).

---

## 9. Como usar o Three.js

### 9.1 Baixa resolução
```ts
const target = new THREE.WebGLRenderTarget(320, 240, {
  minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
});
renderer.setRenderTarget(target); renderer.render(scene, camera);
renderer.setRenderTarget(null);   renderer.render(postScene, postCamera);
```
CSS: `image-rendering: pixelated`.

### 9.2 Vertex snapping e affine
```glsl
uniform vec2 uResolution;
varying vec2 vUv; varying float vW;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 p = clip; p.xyz /= p.w;
  p.xy = floor(p.xy * uResolution * 0.5 + 0.5) / (uResolution * 0.5);
  p.xyz *= clip.w; gl_Position = p;
  vW = clip.w; vUv = uv * clip.w;
}
// fragment: uv = vUv / vW  (cancela a correção de perspectiva → affine)
```
O WebGL não tem `noperspective`; use o truque. O efeito é sutil em vista aérea; intensidade ajustável.

### 9.3 Material único
Um `ShaderMaterial` PS1 (textura, cor de vértice, névoa, snapping, affine) para tudo. Evite `MeshStandardMaterial`.

### 9.4 Agentes instanciados
- Prédios e trechos de pista: `InstancedMesh` por modelo (estático).
- Overboards, pedestres e drones: `InstancedMesh` por tipo; matriz atualizada por frame a partir da posição interpolada na aresta.
- Mostrar só uma **amostra** dos agentes (1 visível por N reais) para manter 60 FPS.
- Estados visuais por instância via `setColorAt` (bateria baixa, queda, parado).

### 9.5 Pistas, rotas e paradas
Geometria extrudada ao longo das arestas (textura por tipo de pista); cruzamentos como quads; linhas coletivas como malha fina colorida; rota de um cidadão selecionado como polilinha.

### 9.6 Overlays
`DataTexture` ou *vertex colors* por aresta: ocupação, quedas, ruído, calor, bateria. Atualizar a cada N ticks.

### 9.7 Câmera e seleção
`PerspectiveCamera` com FOV baixo ou ortográfica; pan, zoom, rotação em passos de 90°. Raio contra y=0 → tile; depois nó/aresta mais próximo no grafo.

### 9.8 Loop e desempenho
Simulação em passo fixo com acumulador; render desacoplado; sob demanda quando pausado. Meta: 60 FPS com ~2.000 agentes visíveis em GPU integrada. Reutilizar geometrias e materiais, `.dispose()`, monitorar `renderer.info`.

### 9.9 Pós-processo (dither + 15-bit)
```glsl
const mat4 bayer = mat4(0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.) / 16.0;
float d = bayer[int(mod(gl_FragCoord.x,4.))][int(mod(gl_FragCoord.y,4.))] - 0.5;
vec3 c = floor((color + d / 32.0) * 31.0 + 0.5) / 31.0;
```

> **Dica:** comece com resolução baixa + `NearestFilter` + névoa (≈70% do visual) e adicione jitter, affine e dither depois.

---

## 10. Interface do usuário

- **Barra superior:** orçamento, data/hora, velocidade, KPIs, meta do cenário, contador de eventos.
- **Barra de ferramentas:** sentido, pista, limite, rotatória, travessia, linha coletiva, estação de carga, energia, árvore.
- **Raio-x:** abas de overlay (fluxo, quedas, energia/bateria, ruído, calor, acessibilidade).
- **Painel de seleção:** fluxo, velocidade média, lotação, custo.
- **Rádio e notícias:** avisos de eventos (24h antes quando possível) e comentários dos moradores.
- **Balões de moradores** e painel de **dilemas** com 2–3 opções.
- **Balanço do dia/cenário:** KPIs, estrelas, estilo de governo, desbloqueios.
- Fonte bitmap e janelas chanfradas ao estilo PS1.
- Atalhos: `Espaço` pausa, `1/2/3` velocidade, `Q/E` gira, `Esc` cancela, `Ctrl+Z` desfaz, `T` raio-x.

---

## 11. Áudio

Trilha lo-fi/sintetizada; zumbido de overboard, estação, sinal de alerta e rádio em baixa taxa (11–22 kHz). Ruído de fundo reflete a densidade de fluxo; alerta sonoro antes de eventos.

---

## 12. Requisitos não funcionais

- 60 FPS com 2.000 agentes visíveis em notebook com GPU integrada.
- Carregamento < 3 s; salvamento < 100 ms.
- Simulação determinística por *seed* (cenários reproduzíveis).
- Cobertura de testes em `core/` (pathfinding, escolha modal, bateria, KPIs, eventos).

---

## 13. Divisão de trabalho — equipe de 3 pessoas

| Papel | Responde por | Entrega principal |
|---|---|---|
| **Direção de Arte** | Identidade PS1, modelos, texturas, UI, áudio | Kit visual legível e coerente |
| **Game Design** | Regras, problemas, cenários, equilíbrio, tutorial, texto | Jogo divertido, claro e balanceado |
| **Engenharia** | Three.js, simulação, ferramentas, build, desempenho | Jogo rodando, estável e testável |

### 13.1 Direção de Arte
- *Style guide* PS1: paleta (≤ 32 cores base), regras de texturas, orçamento de polígonos.
- Modelos (Blender): prédios, pistas/cruzamentos, overboards (3 tipos), pedestres, drones, paradas, estações de carga, painéis solares, árvores, props de evento.
- Atlas de texturas; cores de vértice (luz baked).
- UI/HUD: fonte bitmap, ícones, janelas, **retratos e balões** dos moradores, cores de overlay testadas para daltonismo.
- Áudio: trilha e efeitos.
- **Entregáveis:** `assets/models/*.glb` (origem na base, 1 tile = 1 unidade, nomes padronizados), `assets/textures/atlas.png` + `atlas.json`, `docs/style-guide.md`.

### 13.2 Game Design
- Manter `docs/design/*.md` e `config/balance.json`.
- Projetar cidades (`assets/cities/*.json`) e cenários: metas, orçamento, eventos, dilemas, curva de dificuldade.
- Escrever os textos: moradores, rádio, tutorial, dilemas.
- Conduzir playtests semanais e consolidar o que mudar.
- **Entregáveis:** `docs/design/`, `assets/cities/`, `config/balance.json`, `docs/playtests/`.

### 13.3 Engenharia
- Setup (Vite + TS), CI, lint e testes.
- `core/` (grafo, rotas, agentes, bateria, energia, transporte, eventos, KPIs, comandos) e `render/` (shaders PS1, instâncias, overlays).
- Carregar/validar `city.json` e `balance.json`; carregar `.glb` e atlas.
- UI em HTML conforme a arte; áudio; save/load; determinismo; debug (inspetor de agentes, FPS, toggles PS1).
- **Entregáveis:** `src/`, `tests/`, build publicável, `docs/engineering.md`.

### 13.4 Contratos entre as áreas
| De → Para | Contrato |
|---|---|
| Design → Engenharia | `city.json` + `balance.json` (esquema validado) e fórmulas descritas em `docs/design` |
| Arte → Engenharia | `.glb` + atlas + nomes (`bld_res_1.glb`, `veh_overboard_basic.glb`, …) |
| Design ↔ Arte | Lista de assets por cenário; feedback de legibilidade |
| Engenharia → todos | Build jogável a cada sprint; página de visualização de assets; log de ajuste |

---

## 14. Roteiro (sugestão: 12 semanas, 6 sprints de 2 semanas)

> A duração é uma proposta; ajuste ao prazo real. Cada sprint termina com **build jogável** e playtest.

### Sprint 0 — Fundação (semana 1)
| Arte | Design | Engenharia |
|---|---|---|
| Mood board, paleta, style guide v0 | Pitch, os 8 problemas, esquema do `city.json` | Repo, CI, Vite + Three.js, render 320×240, cubo com `Ps1Material` |

**Marco:** contrato `city.json`/`.glb` e estilo visual acordados.

### Sprint 1 — Vila Nova parada e visível (semanas 1–2)
| Arte | Design | Engenharia |
|---|---|---|
| Kit de pistas, 5 prédios, textura base | `vila-nova.json` v1, mapa dos gargalos | Carregar a cidade, desenhar pistas e prédios, câmera, picking |

**Marco:** Vila Nova renderizada em PS1.

### Sprint 2 — Gente em movimento (semanas 3–4)
| Arte | Design | Engenharia |
|---|---|---|
| Overboards (3), pedestre, esboço do HUD | Rotinas, picos, fórmula modal v1 | Grafo, A\*, agentes, instâncias, tick/velocidade, bateria simples |

**Marco:** moradores vão de casa ao trabalho; o Mercado engarrafa.

### Sprint 3 — Ferramentas e KPIs (semanas 5–6)
| Arte | Design | Engenharia |
|---|---|---|
| UI de ferramentas e painéis, cores dos overlays | Metas, custos, curva do cenário 1 | Comandos (sentido, pista, limite), BPR, KPIs, overlay de fluxo e quedas |

**Marco:** o jogador muda uma rua e vê o KPI mudar.

### Sprint 4 — Surpresa e plataforma coletiva (semanas 7–8)
| Arte | Design | Engenharia |
|---|---|---|
| Parada, plataforma, retratos e balões | Festival, dilema, rádio, tutorial | Eventos, plataforma coletiva, lotação, desbloqueios |

**Marco:** o festival gera tensão e a plataforma é a recompensa.

### Sprint 5 — Vertical slice (semanas 9–10)
| Arte | Design | Engenharia |
|---|---|---|
| Efeitos PS1 completos, polish, trilha | Cenário 1 com 3 estrelas, balanceamento | Save/load, desempenho, tutorial interativo, toggles PS1 |

**Marco:** **vertical slice** — Vila Nova jogável do início ao fim.

### Sprint 6 — Polimento e conteúdo (semanas 11–12)
| Arte | Design | Engenharia |
|---|---|---|
| Pacote final de assets, acessibilidade visual | Cenário 2 (rascunho jogável), ajustes pós-playtest | Correção de bugs, otimização, build publicado |

**Marco:** **MVP v0.1 lançável**.

### Depois do MVP
v0.2 (cenários 2–4, energia, ruído/calor, políticas, seed diária) e v0.3 (cenários 5–8, desigualdade, comunidade, OSM, Web Worker).

### Rituais
- Daily assíncrono: ontem / hoje / bloqueios.
- Playtest semanal com 2–3 pessoas de fora.
- Demo + retro no fim de cada sprint.
- **Definition of Done:** funciona na build, não quebra os testes, segue o style guide e está documentado.

---

## 15. Riscos e decisões em aberto

- **O que é um "overboard"?** Hoverboard individual com bateria? Pessoal, alugado ou compartilhado? *(premissa atual: individual, com bateria)*
- **Existe transporte coletivo?** *(premissa atual: sim, plataformas coletivas)*
- **Poluição:** energética (P3) e ambiental (P4) *(premissa atual: ambas, em cenários distintos)*.
- **Tom:** realista, solarpunk ou distópico? Afeta eventos e textos.
- **Duração do cenário:** 15 minutos *(premissa atual)* ou 1 hora?
- **Simulação:** fluxo (BPR) + amostra visual no MVP; simulação por agente só em trechos críticos depois.
- **Legibilidade × estética:** efeitos PS1 podem atrapalhar a leitura da rede; manter toggles e testar desde o Sprint 1.
- **Câmera:** perspectiva (mais PS1) × ortográfica (mais legível).
- **Carga de conteúdo:** criar `city.json` à mão é trabalhoso; pode valer um editor/script cedo.
- **Gargalo na Engenharia:** mitigar com contratos claros e dados mockados desde o dia 1.
- **Distribuição:** itch.io / web grátis (a definir).
