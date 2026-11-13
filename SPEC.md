# PucaCity — Spec do Projeto

Jogo de gestão de **mobilidade urbana** com estética **PlayStation 1 (PS1)**, rodando no navegador com **Three.js**.

O jogador **não constrói a cidade do zero**: recebe uma cidade que já existe — com ruas, prédios, moradores e problemas — e precisa **reorganizar o trânsito e o transporte** para ela funcionar melhor.

> **Histórico de direção:** começou como simulador de cidade 2D (construção de zonas) → passou para estética PS1 3D → agora o foco do jogo é **mobilidade numa cidade pré-existente**. As mecânicas de zoneamento/crescimento deixam de ser o centro; a simulação de deslocamento das pessoas passa a ser.

---

## 1. Visão geral

**Premissa:** a cidade está engarrafada, o ônibus demora, o ciclista tem medo e o pedestre não tem calçada. Você é o(a) responsável pela mobilidade. Com orçamento limitado, mude sentidos de ruas, semáforos, linhas de ônibus/metrô, ciclovias, faixas e tarifas, e veja as pessoas reagirem.

**Fantasia do jogador:** planejador urbano que ajusta o sistema e observa o efeito em milhares de pequenos cidadãos.

**Plataforma:** navegador desktop (Chrome/Firefox/Safari).

**Público:** fãs de jogos de gestão/puzzle de sistemas (Mini Motorways, Mini Metro, Cities: Skylines) e de estética retrô.

**Princípios**
- **A cidade é dado, não construção:** o mapa vem de um arquivo; o jogador muda a *mobilidade*, não o layout dos prédios.
- **Causa e efeito legíveis:** toda intervenção deve ter consequência visível (cores de congestionamento, filas, agentes).
- **Simulação separada da renderização:** `core/` não conhece o Three.js.
- **Estética PS1 a serviço da legibilidade**, nunca contra ela. Efeitos ajustáveis.

---

## 2. Objetivo e condições de jogo

**Meta:** melhorar os indicadores da cidade dentro de um orçamento e de um prazo (em dias/meses de jogo).

**Indicadores (KPIs)**
| KPI | O que mede |
|---|---|
| Tempo médio de viagem | Minutos por deslocamento, média dos cidadãos |
| Congestionamento | % das vias acima da capacidade nos horários de pico |
| Divisão modal | % a pé / bicicleta / ônibus / metrô / carro |
| Emissões | Poluição gerada pelo tráfego |
| Segurança | Acidentes por período |
| Acessibilidade | % de moradores com serviço essencial a ≤ 15 min sem carro |
| Equidade | Diferença de tempo de viagem entre bairros ricos e pobres |
| Saldo | Receita (tarifas, multas, pedágios) − custos (obras, operação) |
| Satisfação | Nota geral dos cidadãos |

**Modos**
- **Cenários (principal):** cada cidade/mapa tem metas fixas (ex.: "reduzir o tempo médio em 20% sem gastar mais que X"). Estrelas de 1 a 3.
- **Sandbox:** sem metas; experimente livremente.
- **Eventos:** surpresas que quebram o equilíbrio — obra, chuva, jogo de futebol, greve, acidente, bairro novo.

---

## 3. Escopo

### MVP (v0.1)
- 1 cidade pequena, feita à mão (~48×48 tiles), com bairros residenciais, comerciais, industriais e serviços.
- Rede viária com ruas de 1–2 sentidos; carros e pedestres como agentes.
- Ferramentas: **sentido da via**, **semáforo (tempos)**, **limite de velocidade**, **faixa de ônibus**.
- Transporte público básico: **linhas de ônibus** (criar/editar paradas e frequência).
- Cidadãos com rotina casa → trabalho → casa e escolha de modo (carro × ônibus × a pé).
- Mapas de calor de tráfego; HUD com KPIs principais; pausa e velocidade.
- Pipeline visual PS1 (baixa resolução, névoa, textura sem filtro; jitter/affine opcionais).
- Salvar/carregar; 1 cenário com 3 metas.

### v0.2
- **Bicicleta:** ciclovias/ciclofaixas e nível de estresse do ciclista.
- **Metrô/BRT/trem**, integração entre modos, tarifa e bilhete único.
- **Estacionamento** (vagas, preço), **pedágio urbano**, **rodízio**.
- **Pedestres:** calçadas, travessias, faixas elevadas.
- Acidentes, ambulâncias e emergências; eventos dinâmicos.
- Vários cenários e progressão; dia/noite e clima.
- Importação de cidade real a partir de dados abertos (OpenStreetMap) por script offline.

### Fora de escopo (por ora)
- Construir/zonear prédios livremente; terreno com elevação; multiplayer; simulação microscópica realista (troca de faixa, física de veículos).

---

## 4. Mecânicas e simulação

### 4.1 A cidade pré-existente
Carregada de um arquivo `city.json` (ver §6): grafo viário, prédios com tipo e capacidade, população por bairro e pontos de interesse. O jogador pode ter áreas bloqueadas (patrimônio, rio) onde não se pode intervir.

### 4.2 Cidadãos (agentes)
- Cada cidadão tem **casa**, **destinos** (trabalho/escola/lazer/compras), **horário** e **renda** (afeta opções de modo).
- Rotina diária em ticks: ida ao trabalho de manhã, volta à tarde, viagens de lazer à noite. Picos às ~8h e ~18h.
- **Escolha modal:** para cada viagem, estima-se *tempo + custo + conforto/segurança* de cada modo disponível e escolhe-se o de menor "desutilidade" (modelo logit simples, com ruído).
- Se a cidade melhora um modo, **mais pessoas migram para ele** → o jogador vê o efeito.

### 4.3 Tráfego
- Rede = grafo dirigido (nós = cruzamentos, arestas = trechos de via com capacidade, velocidade, faixas).
- **Rota:** A\* / Dijkstra com custo = tempo de viagem atual (inclui congestionamento) → caminhos mudam conforme a rede lota.
- **Congestionamento (versão leve para o MVP):** tempo de percurso por aresta cresce com a ocupação (função BPR: `t = t0 · (1 + 0.15 · (fluxo/capacidade)^4)`). Os veículos visíveis são amostra dos fluxos.
- **Cruzamentos:** semáforo com ciclo e fases; prioridade e conversões geram filas.
- Evolução futura: simulação por veículo (car-following simples) em vias críticas.

### 4.4 Transporte público
- **Linha** = sequência de paradas + frequência (headway) + frota.
- Veículos andam pela rede (ônibus sofrem congestionamento; faixa exclusiva ou metrô não).
- **Lotação:** acima da capacidade, passageiros esperam mais ou desistem.
- Custos: operação por veículo/hora; receita por tarifa.

### 4.5 Ferramentas do jogador (comandos)
| Ferramenta | Efeito |
|---|---|
| Sentido de via | Muda mão única/dupla |
| Semáforo | Ajusta ciclo, fases, onda verde |
| Limite de velocidade | Afeta tempo, segurança e emissões |
| Faixa de ônibus / ciclovia | Reserva espaço (reduz capacidade de carros) |
| Linha de ônibus / metrô | Cria, edita paradas, frequência, frota |
| Estacionamento / pedágio | Muda custo e atratividade do carro |
| Travessia / calçada | Segurança e conforto do pedestre |
| Tarifa | Preço do transporte público |

Toda ferramenta é um **Command** com custo, undo/redo e pré-visualização do impacto estimado.

### 4.6 Tempo e economia
1 tick = 1 minuto de jogo (ajustável); 1 dia = 1440 ticks (comprimível por velocidade). Orçamento mensal: receita de tarifas/multas/pedágio vs. custos de obras e operação.

---

## 5. Direção de arte (PS1)

| Característica PS1 | Como reproduzir |
|---|---|
| Baixa resolução (~320×240) | Render target pequeno ampliado com `NearestFilter` |
| Texturas pequenas, sem filtro | 32×32 / 64×64, `NearestFilter`, sem mipmaps |
| Vertex jitter | Vertex shader arredonda posições em espaço de tela |
| Affine texture warping | Truque `uv * w` no shader |
| Iluminação por vértice | Cores de vértice *baked*; sem luzes dinâmicas |
| Dither + cor 15-bit | Pós-processo Bayer 4×4 + quantização |
| Névoa curta | Fog no shader / `scene.fog` |
| Modelos low-poly | Prédios 12–200 triângulos, veículos 20–60 |

**Prioridades específicas para um jogo de mobilidade (legibilidade):**
- Vias, faixas, ciclovias, trilhos e paradas devem ser **imediatamente distinguíveis** (cor + textura + forma).
- **Veículos pequenos e distintos** por tipo (carro, ônibus, caminhão, bicicleta, pedestre).
- **Overlays de dados** claros (verde → amarelo → vermelho) por cima do visual PS1.
- Efeitos PS1 intensos (jitter, affine) com **controle de intensidade** para não atrapalhar a leitura do mapa.

**Referências de feeling:** SimCity 2000 (PS1), Driver, Ape Escape, Silent Hill (névoa), Mini Metro/Mini Motorways (clareza de rede).

---

## 6. Arquitetura e dados

```
src/
  core/                # Lógica pura, sem Three.js (testável)
    City.ts            # carrega city.json; prédios, bairros, POIs
    RoadGraph.ts       # nós, arestas, capacidade, semáforos
    Pathfinding.ts     # A*/Dijkstra com custo dinâmico
    Agents.ts          # cidadãos, rotinas, escolha modal
    Transit.ts         # linhas, paradas, veículos, lotação
    Simulation.ts      # tick(), sistemas, eventos
    Kpis.ts            # métricas e metas do cenário
    Commands.ts        # ferramentas do jogador (undo/redo)
    Save.ts
  render/              # Tudo que toca Three.js
    Renderer.ts        # render target low-res, resize
    ps1/Ps1Material.ts # snap + affine + vertex color + fog
    ps1/PostFx.ts      # upscale nearest + dither + 15-bit
    CityView.ts        # InstancedMesh de prédios/vias
    VehicleView.ts     # instâncias de veículos/pedestres
    Overlays.ts        # heatmaps de tráfego, rotas, cobertura
    Picking.ts         # Raycaster → via/nó/parada
    CameraRig.ts
  ui/                  # HUD em HTML/CSS (fonte bitmap)
  assets/
    models/            # .glb low-poly
    textures/          # atlas
    cities/            # city.json por cenário
  main.ts
```

**Fluxo:** `input → Command → core muda → eventos → render atualiza só o afetado`. A simulação roda em passo fixo; o render lê o estado.

**Stack:** TypeScript + Vite + Three.js; Vitest em `core/`. Simulação em Web Worker (v0.2) para não travar a interface.

**Formato da cidade (contrato entre as três áreas):**

```ts
interface CityFile {
  name: string;
  size: { w: number; h: number };
  nodes: { id: number; x: number; y: number; signal?: SignalCfg }[];
  edges: { id: number; from: number; to: number; lanes: number;
           speed: number; oneWay: boolean; kind: 'street' | 'avenue' | 'highway';
           lanesReserved?: ('bus' | 'bike')[] }[];
  buildings: { id: number; x: number; y: number; kind: 'res' | 'com' | 'ind' | 'school' | 'hospital' | 'park';
               capacity: number; model: string; rotation: 0 | 1 | 2 | 3 }[];
  districts: { id: number; name: string; income: 'low' | 'mid' | 'high'; population: number }[];
  scenario?: { goals: Goal[]; budget: number; durationDays: number };
}
```

Qualquer pessoa da equipe pode editar `city.json`; a engenharia valida o esquema.

---

## 7. Como usar o Three.js

### 7.1 Baixa resolução
```ts
const target = new THREE.WebGLRenderTarget(320, 240, {
  minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
});
renderer.setRenderTarget(target); renderer.render(scene, camera);
renderer.setRenderTarget(null);   renderer.render(postScene, postCamera);
```
CSS: `image-rendering: pixelated`. Opções 320×240 / 480×360 / 640×480.

### 7.2 Vertex snapping
```glsl
uniform vec2 uResolution;
varying vec2 vUv; varying float vW;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 p = clip; p.xyz /= p.w;
  p.xy = floor(p.xy * uResolution * 0.5 + 0.5) / (uResolution * 0.5);
  p.xyz *= clip.w; gl_Position = p;
  vW = clip.w; vUv = uv * clip.w;   // para affine
}
```

### 7.3 Affine warping
O WebGL não tem `noperspective`. O vertex envia `uv * w` e `w`; o fragment divide (`vUv / vW`), o que cancela a correção de perspectiva. O efeito aparece em polígonos grandes e próximos — em vista aérea é sutil. Use intensidade ajustável.

### 7.4 Material único
Um `ShaderMaterial` PS1 (textura, cor de vértice, névoa, snapping, affine) para tudo. Evite `MeshStandardMaterial`.

### 7.5 Instâncias para a cidade móvel
- **Prédios e trechos de via:** `InstancedMesh` por modelo (estático, atualiza só quando muda).
- **Veículos e pedestres:** `InstancedMesh` por tipo, matrizes atualizadas todo frame a partir da posição interpolada ao longo da aresta (`posição = lerp(nóA, nóB, t)`). Milhares de agentes continuam sendo poucas draw calls.
- Mostre só uma **amostra** dos agentes simulados (ex.: 1 veículo visível por N reais) para manter 60 FPS.

### 7.6 Vias, trilhos e rotas
- Geração das vias como geometria extrudada ao longo das arestas (plano com textura de asfalto/faixas); cruzamentos como quads.
- Linhas de transporte: `Line2`/malha fina colorida sobre a via; paradas como modelos pequenos.
- Rota de um cidadão selecionado: polilinha sobre a malha.

### 7.7 Overlays de tráfego
`DataTexture` ou *vertex colors* por aresta: ocupação → verde/amarelo/vermelho. Atualize a cada N ticks, não todo frame.

### 7.8 Câmera e seleção
`PerspectiveCamera` com FOV baixo (35–45°) inclinada, ou ortográfica para clareza; pan, zoom e rotação em passos de 90°. Seleção por raio contra y=0 → tile; depois, vizinhos mais próximos no grafo (ponto-segmento) para escolher via/nó/parada.

### 7.9 Loop e desempenho
- Simulação em passo fixo com acumulador; render desacoplado.
- Renderização sob demanda quando pausado e sem movimento de câmera.
- Meta: 60 FPS com ~2.000 agentes visíveis em GPU integrada.
- Reuse geometrias/materiais, `.dispose()`, monitore `renderer.info`.

### 7.10 Pós-processo (dither + 15-bit)
```glsl
const mat4 bayer = mat4(0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.) / 16.0;
float d = bayer[int(mod(gl_FragCoord.x,4.))][int(mod(gl_FragCoord.y,4.))] - 0.5;
vec3 c = floor((color + d / 32.0) * 31.0 + 0.5) / 31.0;
```

> **Dica:** comece com resolução baixa + `NearestFilter` + névoa (≈70% do visual) e só depois adicione jitter, affine e dither.

---

## 8. Interface do usuário

- **Barra superior:** dinheiro, data/hora, velocidade, KPIs resumidos, meta do cenário.
- **Barra de ferramentas:** via, semáforo, ônibus, metrô, ciclovia, estacionamento, tarifa.
- **Painel de seleção:** ao clicar numa via/parada/linha mostra fluxo, velocidade média, lotação, custo.
- **Abas de overlay:** tráfego, transporte público, emissões, acidentes, acessibilidade.
- **Gráficos** de KPIs ao longo do tempo (série simples, estilo pixelado).
- **Fonte bitmap** e janelas chanfradas ao estilo PS1.
- Atalhos: `Espaço` pausa, `1/2/3` velocidade, `Q/E` gira câmera, `Esc` cancela, `Ctrl+Z` desfaz, `T` overlay de tráfego.
- **Tutorial** curto no primeiro cenário (3–4 passos guiados).

---

## 9. Áudio

Trilha lo-fi/sintetizada; sons de buzina, ônibus, sinal e estação em baixa taxa (11–22 kHz). Intensidade do ruído de trânsito reflete o congestionamento.

---

## 10. Requisitos não funcionais

- 60 FPS com 2.000 agentes visíveis em notebook com GPU integrada.
- Carregamento < 3 s; salvamento < 100 ms.
- Simulação determinística por *seed* (cenários reproduzíveis e testáveis).
- Cobertura de testes na simulação (`core/`), em especial pathfinding, escolha modal e KPIs.

---

## 11. Divisão de trabalho — equipe de 3 pessoas

| Papel | Responde por | Entrega principal |
|---|---|---|
| **Direção de Arte** | Identidade visual PS1, modelos, texturas, UI, áudio | Kit visual legível e coerente |
| **Game Design** | Regras, equilíbrio, cenários, cidade, tutorial, texto | Jogo divertido, compreensível e balanceado |
| **Engenharia** | Three.js, simulação, ferramentas, build, desempenho | Jogo rodando, estável e testável |

### 11.1 Direção de Arte
**Responsabilidades**
- Definir o *style guide* PS1: paleta (≤ 32 cores base), regras de texturas, orçamento de polígonos, referências.
- Modelar e texturizar (Blender): prédios, vias/cruzamentos, veículos, pedestres, paradas, estações, props.
- Atlas de texturas; pintar cores de vértice (luz *baked*).
- Design da **UI/HUD**: fonte bitmap, ícones, janelas, cores de overlays (testadas para daltonismo).
- Áudio: trilha e efeitos.
- Revisar legibilidade em baixa resolução com os efeitos PS1 ligados.

**Entregáveis e formato**
- `assets/models/*.glb` (origem no centro/base, escala 1 tile = 1 unidade, nomes padronizados).
- `assets/textures/atlas.png` + `atlas.json` (UVs).
- Pasta `ui/` com sprites e fontes; `docs/style-guide.md`.

### 11.2 Game Design
**Responsabilidades**
- Documentar regras e fórmulas (escolha modal, custos, tarifas, metas) em `docs/design/`.
- Projetar a(s) **cidade(s)**: desenhar o mapa, bairros, pontos de dor do trânsito, e produzir `city.json` (com ferramenta de edição ou planilha + script).
- Projetar **cenários**: metas, orçamento, prazo, eventos, curva de dificuldade, estrelas.
- Equilibrar parâmetros em arquivos de dados (`config/balance.json`), sem depender de código.
- Desenhar **tutorial**, textos, nomes de bairros e feedback ao jogador.
- Conduzir **playtests** semanais e consolidar o que mudar.

**Entregáveis e formato**
- `docs/design/*.md` (GDD enxuto), `assets/cities/*.json`, `config/balance.json`, `docs/playtests/`.

### 11.3 Engenharia
**Responsabilidades**
- Setup do repositório (Vite + TS), CI, lint e testes.
- Implementar `core/` (grafo, rotas, agentes, transporte, KPIs, comandos) e `render/` (shaders PS1, instâncias, overlays).
- Carregar/validar `city.json` e `balance.json`; carregar `.glb` e atlas.
- Construir a UI em HTML conforme o design da arte; integrar áudio.
- Desempenho, *save/load*, determinismo e ferramentas de debug (inspetor de agentes, fps, toggles PS1).
- Expor ao design **parâmetros ajustáveis** e ao art um **modo de visualização** de assets.

**Entregáveis**
- Código em `src/`, testes em `tests/`, build publicável, `docs/engineering.md`.

### 11.4 Contratos entre as áreas
| De → Para | Contrato |
|---|---|
| Design → Engenharia | `city.json` + `balance.json` (esquema validado) e especificação das fórmulas |
| Arte → Engenharia | `.glb` + atlas + convenção de nomes (`bld_res_1.glb`, `veh_bus.glb`, …) |
| Design ↔ Arte | Lista de assets necessários por cenário; feedback de legibilidade |
| Engenharia → todos | Build jogável a cada fim de sprint; página de visualização de assets; log de tuning |

---

## 12. Roteiro (sugestão: 12 semanas, 6 sprints de 2 semanas)

> A duração é uma proposta; ajuste ao prazo real do projeto. Em cada sprint há uma **build jogável** e um playtest.

### Sprint 0 — Fundação (semana 1, antes do Sprint 1)
| Arte | Design | Engenharia |
|---|---|---|
| Mood board, paleta, style guide v0, orçamento de polígonos | Pitch de 1 página, KPIs, escopo do MVP, esquema do `city.json` (com a Eng.) | Repo, CI, Vite + Three.js, render target 320×240, cubo com `Ps1Material` |

**Marco:** todos concordam com o contrato `city.json`/`.glb` e o estilo visual.

### Sprint 1 — Cidade parada e visível (semanas 1–2)
| Arte | Design | Engenharia |
|---|---|---|
| Kit de vias (reta, curva, T, cruzamento), 5 prédios, textura base | Primeira cidade em papel/planilha; lista de problemas de trânsito | Carregar `city.json`, desenhar vias e prédios, câmera, picking |

**Marco:** cidade low-poly renderizada em PS1 com câmera funcional.

### Sprint 2 — Gente e carros se movendo (semanas 3–4)
| Arte | Design | Engenharia |
|---|---|---|
| Carro, ônibus, pedestre; ícones de ferramenta; esboço do HUD | Rotinas diárias, picos, fórmula de escolha modal v1 | Grafo, A\*, agentes com rotina, veículos instanciados, tick/velocidade |

**Marco:** cidadãos vão de casa ao trabalho e voltam; vias congestionam.

### Sprint 3 — Primeiras ferramentas e KPIs (semanas 5–6)
| Arte | Design | Engenharia |
|---|---|---|
| UI de ferramentas e painéis; cores dos overlays; semáforos 3D | Metas do cenário 1, custos de ferramentas, curva de dificuldade | Comandos (sentido, semáforo, velocidade), congestionamento BPR, KPIs, overlay de tráfego |

**Marco:** jogador muda uma rua e vê o KPI mudar.

### Sprint 4 — Transporte público (semanas 7–8)
| Arte | Design | Engenharia |
|---|---|---|
| Parada, ônibus, estação; ícones de linha; áudio base | Regras de linhas, frequência, tarifa, lotação; tutorial (roteiro) | Linhas de ônibus, lotação, escolha modal com transporte, faixa de ônibus |

**Marco:** criar uma linha de ônibus tira carros da rua.

### Sprint 5 — Vertical slice (semanas 9–10)
| Arte | Design | Engenharia |
|---|---|---|
| Efeitos PS1 completos (jitter, affine, dither), polish, trilha | Cenário 1 completo com 3 estrelas; eventos; balanceamento | Save/load, desempenho, tutorial interativo, toggles PS1 |

**Marco:** **vertical slice** — um cenário jogável do início ao fim, bonito e legível.

### Sprint 6 — Polimento e conteúdo (semanas 11–12)
| Arte | Design | Engenharia |
|---|---|---|
| Pacote final de assets, UI revisada, acessibilidade visual | Cenário 2 (ou sandbox), ajustes pós-playtest | Correção de bugs, otimização, build final publicado |

**Marco:** **MVP v0.1 lançável**.

### Depois do MVP (v0.2)
Bicicleta, metrô, estacionamento/pedágio, acidentes, mais cenários, importação de cidade real (OSM), simulação em Web Worker.

### 12.1 Rituais da equipe
- **Daily curto** (assíncrono é suficiente): ontem / hoje / bloqueios.
- **Playtest semanal** com 2–3 pessoas de fora; Design consolida o feedback.
- **Demo + retro** no fim de cada sprint.
- **Definition of Done:** funciona na build, não quebra os testes, respeita o style guide e está documentado.

---

## 13. Riscos e decisões em aberto

- **Escopo da simulação:** modelar fluxo (BPR) é simples e barato; simulação por veículo é mais fiel, mas cara. *Recomendação:* fluxo + amostra visual no MVP.
- **Legibilidade × estética:** efeitos PS1 podem atrapalhar a leitura da rede. Manter toggles e testar em playtest desde o Sprint 1.
- **Cidade fictícia ou real?** Começar fictícia e feita à mão; importar cidade real só em v0.2.
- **Carga de conteúdo:** criar `city.json` à mão é trabalhoso. Pode valer uma pequena ferramenta (editor/script) cedo — decidir no Sprint 1.
- **Câmera:** perspectiva (mais PS1) × ortográfica (mais legível).
- **Equipe de 3:** risco de gargalo na Engenharia. Mitigação: contratos claros, assets e dados mockados desde o dia 1, trabalho do Design/Arte sem depender de código.
- **Monetização/distribuição:** itch.io / web grátis? (a definir)
