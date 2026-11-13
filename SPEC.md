# PucaCity — Spec do Projeto

Jogo de gestão de **mobilidade urbana** numa **cidade radical sem carros**, com estética **PlayStation 1 (PS1) + Frutiger Aero + cultura skate dos anos 90/2000**, rodando no navegador com **Three.js**.

O jogador **não constrói a cidade do zero**: recebe uma cidade que já existe, com ruas, prédios, moradores e problemas, e precisa **reorganizar o trânsito de rodinhas e o transporte coletivo** para ela funcionar melhor.

> **Histórico de direção:** começou como simulador de cidade 2D (construção de zonas) → passou para estética PS1 3D → foco em **mobilidade numa cidade pré-existente** → agora é a **cidade radical do Frutiger Aero**: **não existem carros**. Os moradores circulam a pé, de cadeira de rodas, skate, patinete, patins, hoverboard etc. O transporte coletivo é feito de **bicicletas tandem e tuk-tuks**, e no lugar das pontes há **rampas, loops e saltos**.

Documentos relacionados: `docs/style-guide.md` (direção de arte), `docs/referencias.md` (assets livres e referências), `data/arte/*.json` (paleta, veículos, elementos radicais).

**Game Design (fonte de verdade de regras e conteúdo):** [`docs/design/problemas.md`](docs/design/problemas.md) (os 8 problemas urbanos, soluções, eventos, dilemas e progressão), [`docs/design/cenario-01-vila-nova.md`](docs/design/cenario-01-vila-nova.md) (primeiro cenário) e [`config/balance.json`](config/balance.json) (números de equilíbrio, provisórios).

---

## 1. Visão geral

**Premissa:** Pucacity está um caos sobre rodinhas. A faixa dos skates está lotada, o patinete divide espaço com quem está a pé, o tuk-tuk demora, a cadeira de rodas não consegue atravessar o canal porque a única travessia é uma rampa de salto, e o Loop Aéreo da avenida tem fila. Você é o(a) responsável pela mobilidade. Com orçamento limitado, redistribua faixas, ajuste semáforos, crie linhas de tandem e tuk-tuk, escolha o elemento radical de cada travessia e garanta rotas acessíveis. Depois, veja os moradores reagirem.

**Fantasia do jogador:** planejador urbano de uma cidade-skatepark que ajusta o sistema e vê milhares de pequenos cidadãos rolando, pulando gaps e fazendo loops.

**Plataforma:** navegador desktop (Chrome/Firefox/Safari).

**Público:** fãs de jogos de gestão e de quebra-cabeça de sistemas (Mini Motorways, Mini Metro, Cities: Skylines) e da estética retrô Y2K.

**Princípios**
- **A cidade é dado, não construção:** o mapa vem de um arquivo. O jogador muda a *mobilidade*, não o layout dos prédios.
- **Sem carros:** todo deslocamento é a pé, sobre rodinhas ou em transporte coletivo (tandem/tuk-tuk). Não existe carro em nenhum lugar do jogo.
- **Ninguém fica preso:** toda travessia radical tem uma rota acessível. Acessibilidade é métrica e regra, não enfeite.
- **Todo ganho tem custo:** cada intervenção ajuda um grupo e prejudica outro (ver tabela de conflitos em `docs/design/problemas.md`).
- **Surpresa e tensão** e **progressão e rejogabilidade** são os dois focos de diversão do jogo.
- **Causa e efeito legíveis:** toda intervenção deve ter consequência visível (cores de congestionamento, filas, agentes).
- **Simulação separada da renderização:** `core/` não conhece o Three.js.
- **Estética a serviço da legibilidade**, nunca contra ela. Efeitos PS1 ajustáveis.

---

## 2. Objetivo e condições de jogo

**Meta:** melhorar os indicadores da cidade dentro de um orçamento e de um prazo (em dias/meses de jogo).

**Indicadores (KPIs)**
| KPI | O que mede |
|---|---|
| Tempo médio de viagem | Minutos por deslocamento, média dos cidadãos |
| Congestionamento | % das faixas acima da capacidade nos horários de pico |
| Divisão modal | % a pé / cadeira de rodas / rodinha lenta / rodinha rápida / coletivo |
| Energia | Consumo dos veículos elétricos (patinete elétrico, hoverboard, monociclo, cadeira motorizada, tuk-tuk) |
| Segurança | Quedas e colisões por período (conflitos entre faixas e velocidades diferentes) |
| Acessibilidade | % de moradores, **incluindo os usuários de cadeira de rodas**, com serviço essencial a ≤ 15 min |
| Equidade | Diferença de tempo de viagem entre bairros ricos e pobres |
| Radicalidade | Uso dos elementos radicais (gaps, loops, saltos): a "vibe" da cidade |
| Saldo | Receita (tarifas, compartilhamento, eventos) − custos (obras, operação) |
| Satisfação | Nota geral dos cidadãos |

**Modos**
- **Cenários (principal):** cada mapa tem metas fixas (ex.: "reduzir o tempo médio em 20% e chegar a 95% de acessibilidade sem gastar mais que X"). Estrelas de 1 a 3.
- **Sandbox:** sem metas; experimente livremente.
- **Eventos:** surpresas que quebram o equilíbrio, como obra, chuva (pista escorregadia), campeonato de skate (multidão num bowl), greve dos tuk-tuks, queda num loop, bairro novo.

### 2.1 Os 8 problemas urbanos
Detalhados em [`docs/design/problemas.md`](docs/design/problemas.md), cada um com sintoma, causa, soluções, trade-off e KPI.

| # | Problema | Resumo no mundo de rodinhas | KPI principal |
|---|---|---|---|
| P1 | Congestionamento de faixas | Largura mal distribuída; picos de 8h e 18h | Tempo médio de viagem |
| P2 | Segurança e quedas | Velocidades diferentes na mesma faixa; elementos radicais perigosos | Quedas por 1.000 viagens |
| P3 | Energia e bateria | Elétricos (patinete, hoverboard, cadeira motorizada, tuk-tuk) sobrecarregam a rede | % de consumo atendido |
| P4 | Ruído, calor e lixo eletrônico | Rodinhas em concreto, praças-forno, baterias descartadas | Ruído / temperatura |
| P5 | Desigualdade e acesso | Periferia isolada; veículo próprio caro | % com serviços a ≤ 15 min |
| P6 | Acessibilidade | Travessia radical sem rota acessível; fila no Elevador de Bolha | % que chega ao destino |
| P7 | Clima e infraestrutura frágil | Chuva, canal, vento no Loop | Tempo de recuperação |
| P8 | Uso do espaço, comércio e entregas | Disputa por largura entre fluxo, entrega, pedestre e lazer | Comércio / radicalidade |

**Núcleo do jogo:** os problemas se chocam (alargar a faixa rápida resolve P1 mas piora P2 e P6).

### 2.2 Surpresa e tensão
- **Eventos com aviso** (rádio, 24h antes quando possível): campeonato de skate, chuva (pista escorregadia), apagão, onda de calor, greve dos tuk-tuks, vento no Loop Aéreo, elevador quebrado, bairro novo.
- **Crises curtas** (2–4 min): abrir corredor para o socorrista de patins, descobrir a rota alternativa quando uma travessia fecha.
- **Dilemas** com 2–3 opções, todas com custo (ex.: Salto Mortal × segundo Elevador de Bolha).
- **Barra de paciência** por grupo de moradores (idosos, estudantes, entregadores, cadeirantes, comerciantes); esvaziada, gera protesto.
- **Personagens recorrentes** com nome e balão de fala (Dona Rita, Bia, Seu Osvaldo, Tuco).
- Eventos têm *seed*: o cenário diário é igual para todos.

### 2.3 Progressão e rejogabilidade
- **Metas e estrelas:** 1 principal + 2 de equilíbrio; ⭐ resolveu, ⭐⭐ sem piorar outro problema, ⭐⭐⭐ melhorou também a equidade/satisfação.
- **Campanha de 8 cenários**, cada um com um problema principal e ferramentas novas: Vila Nova (P1), Centro Gel (P8), Orla Bolha (P7), Morro Alto (P6), Pátio Industrial (P3), Cidade Verde (P4), Vila Concreto (P5) e Pucacity (todos).
- **Desbloqueios por meta** (ex.: sobreviver ao campeonato libera a linha de tuk-tuk) e **políticas** como cartas, em número limitado por vez.
- **Rejogabilidade:** sandbox, seed diária/semanal com ranking, desafios com restrições, modificadores, modo Caos, estilos de governo (Tecnocrata, Planejador Verde, Skatista Radical, Inclusivo, Equilibrista), conquistas e cidades da comunidade (`city.json` exportável).

---

## 3. Escopo

### MVP (v0.1)
- 1 cidade pequena, feita à mão (~48×48 tiles), com bairros residenciais, comerciais, industriais e de serviços, cortada por **um canal**.
- **Faixas:** calçada, rodinha lenta, rodinha rápida e coletiva.
- **Agentes:** pedestre, cadeira de rodas (manual), skate e patinete. São os representantes de cada faixa.
- **Transporte coletivo:** **linhas de tuk-tuk** (criar/editar paradas e frequência).
- **Elementos radicais:** **Rampa-Ponte** (travessia rápida, só para quem faz manobras) e **Elevador de Bolha** (rota acessível, com capacidade limitada).
- **Ferramentas:** sentido da via, semáforo (tempos), divisão de faixas, limite de velocidade, linha de tuk-tuk, elemento de travessia.
- Cidadãos com rotina casa → trabalho → casa e escolha de modo entre os veículos que possuem e o coletivo.
- Mapas de calor de tráfego; HUD com KPIs principais; pausa e velocidade.
- Pipeline visual PS1 (baixa resolução, névoa, textura sem filtro; jitter/affine opcionais) com camada Frutiger Aero (céu, vidro, gel).
- **Cenário 1 — Vila Nova** (ver `docs/design/cenario-01-vila-nova.md`): 3 metas com estrelas, evento do campeonato de skate, 2 dilemas, 3 personagens com balão de fala e desbloqueio da linha de tuk-tuk.
- Aviso de eventos pelo rádio e balanço do dia com KPIs.
- Salvar/carregar.

### v0.2
- Todos os veículos individuais: longboard, patinete elétrico, patins, cadeira motorizada, hoverboard, monociclo elétrico e BMX.
- **Linhas de tandem** (2–4 lugares, bairro) integradas às de tuk-tuk; tarifa e bilhete único.
- **Elementos radicais completos:** Loop Aéreo, Salto Mortal, Rail-Passarela, Wallride Tubular, Quarter-pipe de Esquina e Funil Bowl (ver `data/arte/elementos-radicais.json`).
- **Estações de compartilhamento** (patinetes e hoverboards de aluguel) e racks de skate.
- **Pedestres:** travessias, calçadas largas, faixas elevadas.
- Quedas e acidentes, socorristas de patins, eventos dinâmicos (campeonatos, chuva).
- Cenários 2 a 4 e demais eventos (P7, P8, P6); energia (P3) e ruído/calor (P4) com estações de carga, painéis solares e arborização.
- Políticas como cartas, árvore de desbloqueio, estilos de governo, seed diária, desafios e modo Caos.
- Dia/noite e clima.
- Importação de cidade real a partir de dados abertos (OpenStreetMap) por script offline. As pontes reais viram elementos radicais.

### Fora de escopo (por ora)
- Carros, ônibus, metrô ou qualquer veículo motorizado de grande porte.
- Construir/zonear prédios livremente; terreno com elevação (só os elementos radicais têm altura própria); multiplayer; física real de manobras. As manobras são animações sobre o trajeto, não simulação.

---

## 4. Mecânicas e simulação

### 4.1 A cidade pré-existente
Carregada de um arquivo `city.json` (ver §6): grafo viário com faixas por tipo, **travessias** (sobre rios, canais e avenidas expressas) ocupadas por elementos radicais, prédios com tipo e capacidade, população por bairro e pontos de interesse. Pode haver áreas bloqueadas (patrimônio, rio) onde não se pode intervir.

### 4.2 Veículos e faixas
| Faixa | Quem usa | Velocidade típica |
|---|---|---|
| Calçada | Pedestre, cadeira de rodas manual | 1–3 m/s |
| Rodinha lenta | Patinete, patins, cadeira motorizada, hoverboard | 2,5–6 m/s |
| Rodinha rápida | Skate, longboard, patinete elétrico, monociclo, BMX | 4–8,5 m/s |
| Coletiva | Tandem, tuk-tuk | 4–9 m/s |

- Cada trecho de via tem uma **largura** dividida entre as faixas. Redistribuir a largura é a principal ferramenta.
- Sem a faixa própria, o veículo usa a vizinha mais lenta. A velocidade cai e o risco de colisão sobe, o que pesa no KPI de Segurança.
- Parâmetros de cada veículo (velocidade, faixa, se faz manobras) ficam em `data/arte/veiculos.json`. Os números de balanceamento ficam em `config/balance.json`.

### 4.3 Cidadãos (agentes)
- Cada cidadão tem **casa**, **destinos** (trabalho/escola/lazer/compras), **horário**, **renda** e **veículos próprios** (ex.: skate + patinete; ou só a pé).
- **Usuários de cadeira de rodas** sempre se deslocam de cadeira (manual ou motorizada) ou de coletivo acessível. Eles nunca "trocam de modo", e cabe à cidade garantir as rotas.
- Rotina diária em ticks: ida ao trabalho de manhã, volta à tarde, viagens de lazer à noite (inclusive *sessões* no skatepark). Picos às ~8h e ~18h.
- **Escolha modal:** para cada viagem, estima-se *tempo + custo + conforto/segurança + diversão* de cada opção disponível (veículos próprios, compartilhados, coletivo, a pé) e escolhe-se a de menor "desutilidade" (logit simples, com ruído). A **diversão** vem dos elementos radicais na rota: um skatista aceita uma rota um pouco mais longa se ela tiver um loop.
- Se a cidade melhora uma opção, **mais pessoas migram para ela**, e o jogador vê o efeito.

### 4.4 Tráfego
- Rede = grafo dirigido (nós = cruzamentos, arestas = trechos de via com faixas, capacidade por faixa e velocidade).
- **Rota:** A\* / Dijkstra **por modo** (cada veículo só usa as arestas e travessias permitidas para ele), com custo = tempo atual (inclui congestionamento).
- **Congestionamento (MVP):** o tempo de percurso por faixa cresce com a ocupação (função BPR: `t = t0 · (1 + 0.15 · (fluxo/capacidade)^4)`). Os agentes visíveis são uma amostra dos fluxos.
- **Cruzamentos:** semáforo com ciclo e fases por faixa; os quarter-pipes de esquina aceleram as conversões das rodinhas rápidas.

### 4.5 Elementos radicais e travessias
- Rios, canais e avenidas expressas **só podem ser atravessados por elementos radicais**. Não há pontes comuns.
- Cada elemento tem **quem pode usar** (só veículos com manobras, ou velocidade mínima), **capacidade**, **tempo de travessia**, **risco de queda** e **bônus de diversão**.
- **Rota acessível obrigatória:** cada travessia precisa de uma alternativa para quem não faz manobras (Elevador de Bolha, passarela de vidro ou linha de coletivo). Se faltar, o KPI de Acessibilidade cai e o cenário pode travar uma meta.
- O Elevador de Bolha tem capacidade limitada e forma fila, o que cria o dilema *velocidade radical × inclusão*.

### 4.6 Transporte coletivo
- **Linha** = sequência de paradas + frequência (headway) + frota, de **tuk-tuk** (linhas principais) ou **tandem** (linhas de bairro, v0.2).
- Os veículos andam pela faixa coletiva. Sem ela, dividem a faixa lenta e sofrem congestionamento.
- **Lotação:** acima da capacidade, os passageiros esperam mais ou desistem.
- Os tuk-tuks são acessíveis (rampa para cadeira de rodas); os tandems, não.
- Custos: operação por veículo/hora; receita por tarifa.

### 4.7 Ferramentas do jogador (comandos)
| Ferramenta | Efeito |
|---|---|
| Sentido de via | Muda mão única/dupla, por faixa |
| Divisão de faixas | Redistribui a largura entre calçada / lenta / rápida / coletiva |
| Semáforo | Ajusta ciclo, fases por faixa, onda verde |
| Limite de velocidade | Afeta tempo, segurança e energia |
| Linha de tuk-tuk / tandem | Cria, edita paradas, frequência, frota |
| Elemento de travessia | Escolhe/troca o elemento radical de uma travessia e sua rota acessível |
| Elemento radical urbano | Instala quarter-pipe de esquina, rail ou bowl em pontos permitidos |
| Estação de compartilhamento | Patinetes e hoverboards de aluguel (v0.2) |
| Travessia de pedestre / calçada | Segurança e conforto de quem anda a pé ou de cadeira |
| Tarifa | Preço do coletivo e do compartilhamento |

Toda ferramenta é um **Command** com custo, undo/redo e pré-visualização do impacto estimado.

### 4.8 Tempo e economia
1 tick = 1 minuto de jogo (ajustável); 1 dia = 1440 ticks (comprimível por velocidade). Orçamento mensal: receita de tarifas, compartilhamento e eventos vs. custos de obras e operação.

---

## 5. Direção de arte

Detalhada em `docs/style-guide.md`. Resumo: **concreto cru de PS1 com vidro lustroso Frutiger Aero**, em uma cidade-skatepark cheia de atitude da virada dos anos 2000.

| Característica PS1 | Como reproduzir |
|---|---|
| Baixa resolução (~320×240) | Render target pequeno ampliado com `NearestFilter` |
| Texturas pequenas, sem filtro | 32×32 / 64×64, `NearestFilter`, sem mipmaps |
| Vertex jitter | Vertex shader arredonda posições em espaço de tela |
| Affine texture warping | Truque `uv * w` no shader |
| Iluminação por vértice | Cores de vértice *baked*; sem luzes dinâmicas |
| Dither + cor 15-bit | Pós-processo Bayer 4×4 + quantização |
| Névoa curta | Fog no shader / `scene.fog` |
| Modelos low-poly | Prédios 12–200 triângulos, veículos/cidadãos 20–60, elementos radicais até 300 |

**Camada Frutiger Aero:** céu azul saturado com nuvens, vidro e cromo com reflexo falso (env map no mesmo shader), água turquesa com bolhas, gramados verde-limão e painéis de UI em gel.

**Prioridades para um jogo de mobilidade (legibilidade):**
- Calçada, faixa lenta, faixa rápida, faixa coletiva, travessias e paradas devem ser **imediatamente distinguíveis** (cor do piso + marcação + forma).
- **Cada tipo de veículo é reconhecível pela silhueta** vista de cima: skate fino, cadeira com rodas grandes, tandem alongado, tuk-tuk em bolha de vidro.
- As **35 cores de variação** (`data/arte/paleta.json`) servem só para dar variedade aos cidadãos e veículos e nunca indicam estado. Com os overlays ligados, os veículos ficam dessaturados.
- **Overlays de dados** claros (verde → amarelo → vermelho) por cima do visual.
- Efeitos PS1 intensos (jitter, affine) com **controle de intensidade**.

**Referências de feeling (só estilo):** série de skate da era PS1 (THPS2), Jet Set Radio, SSX Tricky, Crazy Taxi, Wipeout 3, Ape Escape, UI do Windows Vista/Wii, Mini Metro/Mini Motorways (clareza de rede). Lista completa em `docs/referencias.md`. **Nenhum asset de jogo comercial é usado.**

---

## 6. Arquitetura e dados

```
src/
  core/                # Lógica pura, sem Three.js (testável)
    City.ts            # carrega city.json; prédios, bairros, POIs
    RoadGraph.ts       # nós, arestas, faixas por tipo, semáforos
    Crossings.ts       # travessias, elementos radicais, rotas acessíveis
    Pathfinding.ts     # A*/Dijkstra por modo, com custo dinâmico
    Agents.ts          # cidadãos, veículos próprios, rotinas, escolha modal
    Transit.ts         # linhas de tuk-tuk/tandem, paradas, lotação
    Events.ts          # eventos, dilemas, crises, paciência dos grupos
    Energy.ts          # bateria, estações de carga, apagões (v0.2)
    Simulation.ts      # tick(), sistemas
    Kpis.ts            # métricas e metas do cenário
    Commands.ts        # ferramentas do jogador (undo/redo)
    Save.ts
  render/              # Tudo que toca Three.js
    Renderer.ts        # render target low-res, resize
    ps1/Ps1Material.ts # snap + affine + vertex color + fog + env map Aero
    ps1/PostFx.ts      # upscale nearest + dither + 15-bit
    CityView.ts        # InstancedMesh de prédios/vias
    RadicalView.ts     # rampas, loops, elevadores; animação de manobras
    VehicleView.ts     # instâncias de cidadãos/veículos por tipo
    Overlays.ts        # heatmaps de tráfego, rotas, cobertura, acessibilidade
    Picking.ts         # Raycaster → via/nó/parada/travessia
    CameraRig.ts
  ui/                  # HUD em HTML/CSS (fonte bitmap, painéis em gel)
  assets/
    models/            # .glb low-poly
    textures/          # atlas
    cities/            # city.json por cenário
  main.ts
data/arte/             # paleta, veículos e elementos radicais (Direção de Arte)
config/balance.json    # números de balanceamento (Game Design)
```

**Fluxo:** `input → Command → core muda → eventos → render atualiza só o afetado`. A simulação roda em passo fixo; o render lê o estado.

**Stack:** TypeScript + Vite + Three.js; Vitest em `core/`. Simulação em Web Worker (v0.2) para não travar a interface.

**Formato da cidade (contrato entre as três áreas):**

```ts
type LaneKind = 'sidewalk' | 'slow' | 'fast' | 'transit';
type VehicleKind = 'pedestrian' | 'wheelchair' | 'wheelchair_powered' | 'skate' | 'longboard'
  | 'kick_scooter' | 'e_scooter' | 'skates' | 'hoverboard' | 'e_unicycle' | 'bmx'
  | 'tandem' | 'tuktuk';
type RadicalKind = 'ramp_bridge' | 'air_loop' | 'death_jump' | 'rail_walkway';
type AccessKind = 'bubble_lift' | 'glass_walkway' | 'transit_only';

interface CityFile {
  name: string;
  size: { w: number; h: number };
  nodes: { id: number; x: number; y: number; signal?: SignalCfg }[];
  edges: { id: number; from: number; to: number; width: number; speed: number;
           oneWay: boolean; kind: 'street' | 'avenue' | 'boulevard';
           lanes: Partial<Record<LaneKind, number>> }[];
  crossings: { id: number; from: number; to: number; over: 'river' | 'canal' | 'expressway';
               radical: RadicalKind; access?: AccessKind; locked?: boolean }[];
  buildings: { id: number; x: number; y: number; kind: 'res' | 'com' | 'ind' | 'school' | 'hospital' | 'park' | 'skatepark';
               capacity: number; model: string; rotation: 0 | 1 | 2 | 3 }[];
  districts: { id: number; name: string; income: 'low' | 'mid' | 'high'; population: number;
               ownership: Partial<Record<VehicleKind, number>>;   // % de moradores com cada veículo
               wheelchairShare: number }[];
  characters?: { id: string; name: string; group: string; vehicle: VehicleKind; home: number; work?: number }[];
  scenario?: { id: string; goals: Goal[]; budget: number; durationDays: number; events: string[]; dilemmas: string[] };
}
```

Qualquer pessoa da equipe pode editar `city.json`; a engenharia valida o esquema.

**Extensões propostas pela Direção de Arte** (usadas na vitrine `src/assets/cities/vitrine.json`; tipos em `src/core/CityFile.ts`):
- `canal?: { y0, y1 }`: faixa de água a ser atravessada pelas travessias.
- `features?: { kind, x, y, rot }[]`: elementos radicais urbanos (`air_loop`, `wallride`, `quarter`, `bowl`) e props (`stop_shelter`, `share_station`, `crt_billboard`, `tree`, `lamp`, `bench`), com `rot` em quartos de volta.

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
Um `ShaderMaterial` PS1 (textura, cor de vértice, névoa, snapping, affine) para tudo. Vidro e cromo Aero usam um *env map* falso de 64×64 (reflexo do céu) no mesmo shader, ligado por *define*. Evite `MeshStandardMaterial`.

### 7.5 Instâncias para a cidade móvel
- **Prédios, trechos de via e elementos radicais:** `InstancedMesh` por modelo (estático, atualiza só quando muda).
- **Cidadãos e veículos:** `InstancedMesh` por tipo de veículo, com matrizes atualizadas todo frame a partir da posição interpolada ao longo da aresta (`posição = lerp(nóA, nóB, t)`). Nos elementos radicais, a posição segue a curva da peça (arco do salto, círculo do loop). A cor vem por `instanceColor`, sorteada da paleta de 35 cores.
- Mostre só uma **amostra** dos agentes simulados (ex.: 1 visível por N reais) para manter 60 FPS.

### 7.6 Vias, faixas e rotas
- Vias geradas como geometria extrudada ao longo das arestas, com uma tira por faixa (cor e textura próprias); cruzamentos como quads.
- Elementos radicais são `.glb` posicionados nas travessias e escalados para o vão.
- Linhas de coletivo: `Line2`/malha fina colorida sobre a faixa coletiva; paradas como modelos pequenos.
- Rota de um cidadão selecionado: polilinha sobre a malha.

### 7.7 Overlays de tráfego
`DataTexture` ou *vertex colors* por faixa: ocupação → verde/amarelo/vermelho. Overlay de acessibilidade destaca travessias sem rota acessível. Atualize a cada N ticks, não todo frame.

### 7.8 Câmera e seleção
`PerspectiveCamera` com FOV baixo (35–45°) inclinada, ou ortográfica para clareza; pan, zoom e rotação em passos de 90°. Seleção por raio contra y=0 → tile; depois, vizinhos mais próximos no grafo (ponto-segmento) para escolher via/nó/parada/travessia.

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

- **Linguagem visual:** painéis e pílulas de vidro em gel no estilo Frutiger Aero, com cantos pixelados e **fonte bitmap** (gerada de fontes OFL; ver `docs/referencias.md`).
- **Barra superior:** dinheiro, data/hora, velocidade, KPIs resumidos, meta do cenário.
- **Barra de ferramentas:** faixas, sentido, semáforo, tuk-tuk/tandem, travessias radicais, compartilhamento, tarifa.
- **Painel de seleção:** ao clicar numa via/parada/linha/travessia mostra fluxo por faixa, velocidade média, lotação, fila do elevador, custo.
- **Abas de overlay:** tráfego, coletivo, acessibilidade, segurança, energia.
- **Feedback "radical":** texto grande e inclinado, no estilo dos jogos de skate dos anos 2000, quando algo bom acontece ("+12% SATISFAÇÃO!", "NOVO RECORDE NO SALTO MORTAL!").
- **Gráficos** de KPIs ao longo do tempo (série simples, estilo pixelado).
- Atalhos: `Espaço` pausa, `1/2/3` velocidade, `Q/E` gira câmera, `Esc` cancela, `Ctrl+Z` desfaz, `T` overlay de tráfego, `A` overlay de acessibilidade.
- **Tutorial** curto no primeiro cenário (3–4 passos guiados).

---

## 9. Áudio

Trilha no clima da virada dos anos 2000 (skate punk, pop-punk, drum'n'bass, hip-hop) e eletrônico "Aero" calmo nos menus, só com faixas originais ou de licença livre (nada de trilhas licenciadas de jogos comerciais). Efeitos em baixa taxa (11–22 kHz): rodinhas no concreto, no metal e no vidro, *pop* do shape, *grind*, campainha do tandem, motor elétrico do tuk-tuk, bolhas do elevador. A intensidade do ruído de rodinhas reflete o congestionamento.

---

## 10. Requisitos não funcionais

- 60 FPS com 2.000 agentes visíveis em notebook com GPU integrada.
- Carregamento < 3 s; salvamento < 100 ms.
- Simulação determinística por *seed* (cenários reproduzíveis e testáveis).
- Cobertura de testes na simulação (`core/`), em especial pathfinding por modo, travessias/acessibilidade, escolha modal e KPIs.
- Assets de terceiros apenas com licença livre, registrados em `docs/creditos.md`.

---

## 11. Divisão de trabalho — equipe de 3 pessoas

| Papel | Responde por | Entrega principal |
|---|---|---|
| **Direção de Arte** | Identidade visual PS1 + Aero, modelos, texturas, UI, áudio | Kit visual legível e coerente |
| **Game Design** | Regras, equilíbrio, cenários, cidade, tutorial, texto | Jogo divertido, compreensível e balanceado |
| **Engenharia** | Three.js, simulação, ferramentas, build, desempenho | Jogo rodando, estável e testável |

### 11.1 Direção de Arte
**Responsabilidades**
- Manter o *style guide* (`docs/style-guide.md`): paleta-base (≤ 32 cores) + 35 cores de variação, regras de texturas, orçamento de polígonos, referências.
- Modelar e texturizar (Blender) prédios, vias/faixas, cruzamentos, **elementos radicais** (rampas, loops, elevadores), **cidadãos e veículos** (13 tipos), paradas e props. Partir dos kits livres de `docs/referencias.md`; tandem, tuk-tuk, BMX e patins precisam ser modelados.
- Atlas de texturas; pintar cores de vértice (luz *baked*).
- Design da **UI/HUD**: fonte bitmap, ícones, painéis em gel, cores de overlays (testadas para daltonismo).
- Áudio: trilha e efeitos.
- Revisar legibilidade em baixa resolução com os efeitos PS1 ligados.

**Entregáveis e formato**
- `assets/models/*.glb` (origem no centro/base, escala 1 tile = 1 unidade, nomes padronizados).
- `assets/textures/atlas.png` + `atlas.json` (UVs).
- Pasta `ui/` com sprites e fontes; `docs/style-guide.md`; `data/arte/*.json`; `docs/creditos.md`.

### 11.2 Game Design
**Responsabilidades**
- Documentar regras e fórmulas (escolha modal com diversão, faixas, travessias, custos, tarifas, metas) em `docs/design/`.
- Projetar a(s) **cidade(s)**: mapa, bairros, canais/rios, travessias, pontos de dor do trânsito, e produzir `city.json`.
- Projetar **cenários**: metas, orçamento, prazo, eventos, curva de dificuldade, estrelas.
- Equilibrar parâmetros em arquivos de dados (`config/balance.json`), sem depender de código.
- Desenhar **tutorial**, textos, nomes de bairros e feedback ao jogador.
- Conduzir **playtests** semanais e consolidar o que mudar.

**Entregáveis e formato**
- `docs/design/*.md` (GDD enxuto), `assets/cities/*.json`, `config/balance.json`, `docs/playtests/`.

### 11.3 Engenharia
**Responsabilidades**
- Setup do repositório (Vite + TS), CI, lint e testes.
- Implementar `core/` (grafo com faixas, travessias, rotas por modo, agentes, coletivo, KPIs, comandos) e `render/` (shaders PS1 + Aero, instâncias, elementos radicais, overlays).
- Carregar/validar `city.json`, `balance.json` e `data/arte/*.json`; carregar `.glb` e atlas.
- Construir a UI em HTML conforme o design da arte; integrar áudio.
- Desempenho, *save/load*, determinismo e ferramentas de debug (inspetor de agentes, fps, toggles PS1).
- Expor ao design **parâmetros ajustáveis** e ao art um **modo de visualização** de assets.

**Entregáveis**
- Código em `src/`, testes em `tests/`, build publicável, `docs/engineering.md`.

### 11.4 Contratos entre as áreas
| De → Para | Contrato |
|---|---|
| Design → Engenharia | `city.json` + `balance.json` (esquema validado) e especificação das fórmulas |
| Arte → Engenharia | `.glb` + atlas + `data/arte/*.json` + convenção de nomes (`bld_res_1.glb`, `veh_skate.glb`, `veh_tuktuk.glb`, `rad_air_loop.glb`, …) |
| Design ↔ Arte | Lista de assets por cenário; feedback de legibilidade |
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
| Kit de vias com faixas (reta, curva, T, cruzamento), 5 prédios, textura base, céu Aero | Primeira cidade em papel/planilha, com canal e travessias; lista de problemas de trânsito | Carregar `city.json`, desenhar vias com faixas e prédios, câmera, picking |

**Marco:** cidade low-poly renderizada em PS1 com câmera funcional.

### Sprint 2 — Gente rolando (semanas 3–4)
| Arte | Design | Engenharia |
|---|---|---|
| Pedestre, cadeira de rodas, skate, patinete; ícones de ferramenta; esboço do HUD em gel | Rotinas diárias, picos, posse de veículos por bairro, escolha modal v1 | Grafo com faixas, A\* por modo, agentes com rotina, instâncias por tipo, tick/velocidade |

**Marco:** cidadãos vão de casa ao trabalho e voltam, cada um na sua faixa; as faixas congestionam.

### Sprint 3 — Ferramentas, KPIs e travessias (semanas 5–6)
| Arte | Design | Engenharia |
|---|---|---|
| Rampa-Ponte e Elevador de Bolha; UI de ferramentas e painéis; cores dos overlays; semáforos 3D | Metas do cenário 1, custos de ferramentas, regras de travessia e acessibilidade | Comandos (faixas, sentido, semáforo, travessia), BPR, KPIs, overlays de tráfego e acessibilidade, animação de salto |

**Marco:** o jogador redistribui uma faixa ou troca uma travessia e vê o KPI mudar.

### Sprint 4 — Transporte coletivo (semanas 7–8)
| Arte | Design | Engenharia |
|---|---|---|
| Tuk-tuk, parada Aero; retratos e balões dos moradores; ícones de linha; áudio base | Regras de linhas, frequência, tarifa, lotação; campeonato, dilemas, rádio e tutorial (roteiro) | Linhas de tuk-tuk, lotação, escolha modal com coletivo, faixa coletiva; motor de eventos, dilemas e desbloqueios |

**Marco:** o campeonato gera tensão, e criar uma linha de tuk-tuk (a recompensa) desafoga as faixas e leva os usuários de cadeira de rodas para o outro lado do canal.

### Sprint 5 — Vertical slice (semanas 9–10)
| Arte | Design | Engenharia |
|---|---|---|
| Efeitos PS1 completos (jitter, affine, dither), polish Aero, feedback "radical" no HUD, trilha | Cenário 1 completo com 3 estrelas; eventos; balanceamento | Save/load, desempenho, tutorial interativo, toggles PS1 |

**Marco:** **vertical slice** — um cenário jogável do início ao fim, bonito e legível.

### Sprint 6 — Polimento e conteúdo (semanas 11–12)
| Arte | Design | Engenharia |
|---|---|---|
| Pacote final de assets, UI revisada, acessibilidade visual, `creditos.md` | Cenário 2 (ou sandbox), ajustes pós-playtest | Correção de bugs, otimização, build final publicado |

**Marco:** **MVP v0.1 lançável**.

### Depois do MVP (v0.2)
Demais veículos, tandem, Loop Aéreo e demais elementos radicais, compartilhamento, quedas/acidentes, mais cenários, importação de cidade real (OSM), simulação em Web Worker.

### 12.1 Rituais da equipe
- **Daily curto** (assíncrono é suficiente): ontem / hoje / bloqueios.
- **Playtest semanal** com 2–3 pessoas de fora; Design consolida o feedback.
- **Demo + retro** no fim de cada sprint.
- **Definition of Done:** funciona na build, não quebra os testes, respeita o style guide e está documentado.

---

## 13. Riscos e decisões em aberto

- **Escopo da simulação:** modelar fluxo (BPR) é simples e barato; simulação por agente é mais fiel, mas cara. *Recomendação:* fluxo por faixa + amostra visual no MVP.
- **Muitos tipos de veículo:** 13 tipos podem confundir a leitura e o balanceamento. *Mitigação:* o MVP tem só 4 tipos + tuk-tuk; os KPIs agrupam por faixa.
- **Tensão sem carros:** sem o "vilão" carro, o conflito vem da disputa por largura de via, das travessias radicais e da acessibilidade. Validar cedo em playtest que isso gera dilemas interessantes. O catálogo de problemas, a tabela de conflitos e os eventos de `docs/design/problemas.md` são a resposta de design a esse risco.
- **Radicalidade × inclusão × segurança:** o dilema Salto Mortal × Elevador de Bolha é o coração da tensão; garantir que o jogo não premie só a opção "radical".
- **Eventos e dilemas dão trabalho de conteúdo:** manter o catálogo em dados (`config/balance.json`, `assets/cities/*.json`) e escrever textos em lote por cenário.
- **Acessibilidade × radical:** os elementos radicais não podem virar barreira. A regra "toda travessia tem rota acessível" é obrigatória e testada.
- **Legibilidade × estética:** efeitos PS1 e brilho Aero podem atrapalhar a leitura da rede. Manter toggles e testar em playtest desde o Sprint 1.
- **Cidade fictícia ou real?** Começar fictícia e feita à mão; importar cidade real só em v0.2.
- **Carga de conteúdo:** criar `city.json` à mão é trabalhoso. Pode valer uma pequena ferramenta (editor/script) cedo — decidir no Sprint 1.
- **Câmera:** perspectiva (mais PS1) × ortográfica (mais legível).
- **Equipe de 3:** risco de gargalo na Engenharia. Mitigação: contratos claros, assets e dados mockados desde o dia 1, trabalho do Design/Arte sem depender de código.
- **Licenças de assets:** usar só fontes livres verificadas; nada de assets de jogos comerciais.
- **Monetização/distribuição:** itch.io / web grátis? (a definir)
