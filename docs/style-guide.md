# Pucacity — Direção de Arte

> **Pucacity, a cidade radical do Frutiger Aero.**
> Concreto cru de PS1 com vidro lustroso de 2004. Uma cidade onde ninguém anda de carro: o trânsito é feito de rodinhas, e no lugar das pontes há rampas.

Este é o *style guide* da Direção de Arte (entregável do `SPEC.md` §11.1). O jogo é de **gestão de mobilidade com câmera aérea**: toda regra estética abaixo está subordinada à **legibilidade da rede** (SPEC §5). Os dados que o código consome ficam em `data/arte/`:

| Arquivo | Conteúdo |
|---|---|
| `data/arte/paleta.json` | Paleta-base do mundo (13 cores, dentro do limite de ≤ 32 do SPEC) + 35 cores de variação para veículos/moda |
| `data/arte/veiculos.json` | Veículos dos cidadãos e transporte público |
| `data/arte/elementos-radicais.json` | Rampas, loops, gaps e substitutos de pontes |

---

## 1. Pilares visuais

1. **Cru (Crunchy):** baixa resolução, polígonos visíveis, texturas pixeladas e tremidas. Nada de suavizar.
2. **Lustroso (Aero):** céu azul saturado, vidro, água, bolhas, gradientes brilhantes e cromado. É o contraste "limpo" com o concreto sujo.
3. **Atitude (Skate Y2K):** pichação, adesivos, roupa larga, tudo andando sobre rodas. A cidade inteira é um skatepark.
4. **Movimento:** cada rua, praça e prédio deve sugerir uma linha de manobra. Se não dá pra andar de skate em cima, repense.

**Referências de estilo (só para observar, nunca para copiar assets):** a série de skate da era PS1/PS2, jogos de patins com cel-shading do início dos anos 2000, a estética de wallpapers do Windows XP/Vista e o design de eletrônicos de 2000–2008 (iMac G3, MiniDisc, Tamagotchi).

> **Regra de propriedade intelectual:** não usamos texturas, modelos, fontes nem músicas extraídos de jogos comerciais. Os assets de terceiros precisam ser CC0/domínio público ou ter licença que permita uso em jogo, e cada um deve ser registrado em `docs/creditos.md` (a criar quando o primeiro asset entrar).

---

## 2. Renderização "PS1 cru"

| Regra | Valor-alvo | Observação |
|---|---|---|
| Resolução interna | 320×240 (padrão), ampliada com `NearestFilter` | Opções 480×360 e 640×480 (SPEC §7.1) |
| Filtragem de textura | **Nenhuma** (`NearestFilter`) | Sem mipmaps |
| Tamanho de textura | 32×32 / 64×64, tudo num atlas (`assets/textures/atlas.png`) | 1 tile = 1 unidade; 64 texels por tile |
| Profundidade de cor | Quantizar para 15 bits (5-5-5) + dithering ordenado 4×4 | Aplicar no pós-processamento |
| Vértices | Snap em grade de tela (jitter) | Intensidade configurável, de leve a forte |
| Mapeamento | Distorção afim de textura (sem correção de perspectiva) | Mais forte em pisos grandes, onde fica mais visível |
| Iluminação | Cor por vértice + luz ambiente; sem sombras em tempo real | Sombra-blob circular embaixo de personagens e veículos |
| Neblina | Distância curta, cor do céu do horizonte (`ceu_horizonte`) | Disfarça o pop-in, típico da época |
| Polígonos | Prédios 12–200 tris; veículos/cidadãos 20–60; elementos radicais (loop, rampa) até 300 | Câmera aérea: o detalhe vem da silhueta e da cor, não da malha |
| Material | Um único `Ps1Material` (SPEC §7.4) | Vidro/cromo Aero = env map falso no mesmo shader |

**O que quebra o estilo:** PBR realista, bloom exagerado, oclusão de ambiente, normal maps, texturas em alta resolução e antialiasing.

**Legibilidade primeiro:**
- Vista de cima, cada tipo de veículo precisa ser reconhecível pela **silhueta**: skate = retângulo fino, cadeira = quadrado com 2 rodas grandes, tandem = alongado, tuk-tuk = bolha de vidro.
- As 35 cores servem para dar variedade aos cidadãos e **nunca** indicam estado. O estado (congestionamento etc.) fica com os overlays verde→amarelo→vermelho, e com eles ligados os veículos ficam dessaturados.
- As faixas de cada modo (calçada, rodinha lenta, rodinha rápida, coletivo) têm cor de piso e marcação diferentes.
- Jitter e affine são ajustáveis e começam fracos.

---

## 3. Camada Frutiger Aero

A camada Aero é o "brilho" por cima do concreto:

- **Céu:** gradiente vertical de azul-royal a azul-bebê, com nuvens cúmulos brancas e fofas (sprites/billboards). Lens flare simples em sprite.
- **Vidro:** fachadas espelhadas em ciano/verde-água usando um *environment map* fake de 64×64 (reflexo do céu). Prédios de vidro arredondados e cúpulas.
- **Água:** canais e fontes em turquesa vibrante com bolhas (partículas em sprite) subindo.
- **Natureza limpa:** gramados verde-limão impecáveis, árvores redondas e lustrosas, borboletas e peixes em sprite.
- **Materiais "gel":** corrimãos, bancos e placas com gradiente brilhante e um *highlight* branco na metade de cima (o efeito "botão do XP").
- **Cromado:** postes, rails e corrimãos com um reflexo em textura falsa (*sphere map*).

**Proporção sugerida por cena:** 60% concreto/asfalto cru, 25% vidro/água/céu Aero e 15% acentos saturados (grafite, adesivos, veículos).

---

## 4. Arquitetura urbana

- **Base:** concreto aparente, blocos modulares, escadas largas, corrimãos, bancos de concreto, caixas de energia e caçambas. Tudo é obstáculo de skate.
- **Topo Aero:** torres de vidro com cantos arredondados, passarelas tubulares transparentes, letreiros em gel e telões de CRT.
- **Sujeira controlada:** pichações e adesivos em decalques de 32–64 px, chiclete no chão, marcas de roda pretas nas bordas.
- **Sem garagens nem estacionamentos de carro:** no lugar, bicicletários, racks de skate e estações de tuk-tuk.
- **Ruas:** faixas estreitas e pintadas por tipo de veículo (ver seção 7), meio-fios chanfrados que funcionam como mini-rampa e bueiros com tampa de grade grindável.
- **Distritos (proposta):**
  - *Centro Gel:* torres de vidro, praças com fontes e half-pipes cromados.
  - *Vila Concreto:* conjuntos habitacionais, escadarias, pichação pesada.
  - *Orla Bolha:* canais, píeres, rampas sobre a água, quiosques.
  - *Pátio Industrial:* galpões, piscinas vazias, ferro-velho e bowls.
  - *Parque Aero:* colinas verdes, loops e ciclovias suspensas.

---

## 5. Elementos radicais (no lugar de pontes)

Pucacity não tem pontes convencionais: tudo que cruza um rio, canal, avenida ou desnível é um **elemento radical**. A lista completa e os parâmetros ficam em `data/arte/elementos-radicais.json`. Resumo:

- **Rampa-Ponte:** rampa de lançamento + aterrissagem, com gap pontuado.
- **Loop Aéreo:** loop vertical completo de vidro/cromo, presente nas grandes avenidas.
- **Salto Mortal:** gap longo sobre canal ou trilho, com placa de recorde.
- **Half-pipe de esquina:** os cruzamentos têm quarter-pipes nas quinas.
- **Rail-Passarela:** corrimão longo que liga prédios (grind obrigatório).
- **Wallride Tubular:** túnel em meia-cana que atravessa um prédio.
- **Funil Bowl:** praça rebaixada, usada como rotatória.
- **Torre Espiral:** rampa em hélice de 2 voltas em volta de um cilindro de vidro; do topo, o rider salta de volta à praça com mortal duplo.
- **Mega Half-pipe:** U gigante de praça; riders pendulam e fazem aéreos acima do coping.
- **Elevador de Bolha:** cápsula Aero que leva ao topo das rampas altas, para quem não é skatista e para cadeiras de roda.

**Acessibilidade no mundo:** todo elemento radical tem uma **rota alternativa acessível** (rampa suave, elevador de bolha ou tandem/tuk-tuk). Os cidadãos em cadeira de rodas também fazem manobras, mas nunca ficam presos.

**Leitura visual:** a borda de lançamento é sempre pintada com faixa zebrada amarelo/preto, a aterrissagem com uma faixa verde-limão, e os gaps têm placa em gel com o nome.

---

## 6. HUD e tipografia

- **Linguagem:** pílulas e painéis de vidro em gel (gradiente + highlight branco + borda clara de 1 px), cantos bem arredondados e ícones lustrosos tipo "orb".
- **Texto de manobra:** grande, em caixa alta, itálico ou inclinado, com contorno grosso escuro e preenchimento em gradiente (ciano→branco). Combos empilham na parte de baixo da tela; o multiplicador aparece em amarelo-grip.
- **Pontuação/tempo:** canto superior, em fonte arredondada de sistema Y2K sobre pílula de vidro.
- **Medidor de equilíbrio (grind/manual):** barra em gel com uma bolha que desliza.
- **Fontes:** a família Frutiger é comercial e **não** será embarcada. Usar alternativas livres (licença OFL) de estilo humanista arredondado para o HUD, mais uma display condensada/itálica para as manobras. Os candidatos virão da pesquisa de assets e serão registrados em `creditos.md`.
- **Pixel:** o HUD é HTML/CSS (SPEC §8) com **fonte bitmap**. As fontes Aero viram bitmap fonts e os painéis em gel ficam com cantos em degrau pixelado, juntando a "janela chanfrada PS1" do SPEC com o brilho Aero.
- **Painéis do jogo de gestão:** a barra de KPIs, as ferramentas e o painel de seleção seguem a mesma linguagem de gel. O texto grande de manobra aparece como feedback quando um cidadão faz um gap ou loop, ou quando um KPI melhora ("+12% SATISFAÇÃO!").

---

## 7. Cidadãos e trânsito

Os cidadãos funcionam como o trânsito: **não há carros**. Cada veículo tem faixa, velocidade e comportamento próprios (ver `data/arte/veiculos.json`):

- **Veículos individuais:** skate, longboard, patinete (kick), patinete elétrico, patins, cadeira de rodas (manual e motorizada), hoverboard, monociclo elétrico e BMX.
- **Pedestres:** andam nas calçadas e cruzam nas faixas, como sempre.
- **Transporte público:** **bicicletas tandem** (2 a 4 lugares, linhas de bairro) e **tuk-tuks** (linhas principais, com pontos de parada em abrigo Aero).
- **Cores:** cada veículo e cada roupa sorteiam cores da paleta de 35 em `data/arte/paleta.json`, respeitando as regras de combinação desse arquivo.

---

## 8. Moda skater 90/2000

Peças para o sistema de roupas dos cidadãos e do jogador (combináveis):

- **Cabeça:** gorro, boné aba reta ou virado, bandana, fone de arco grande, cabelo espetado com gel, frosted tips, dreads, tranças, moicano.
- **Tronco:** camiseta larga de marca fictícia, moletom com capuz, camisa de flanela aberta, regata, jaqueta corta-vento de nylon colorida, camisa de time.
- **Pernas:** jeans largo (baggy), calça cargo, bermuda abaixo do joelho, calça de nylon de botão lateral.
- **Pés:** tênis de skate gordo (língua grande, cadarço largo), meião branco.
- **Acessórios:** corrente de carteira, munhequeira, cinto de rebite, óculos de lente espelhada, MiniDisc/discman na cintura, mochila de uma alça, joelheira.
- **Marcas:** todas fictícias, criadas para Pucacity (logotipos simples de 16–32 px).

---

## 9. Trilha sonora (direção)

A trilha é parte da identidade, mas **sem faixas licenciadas de jogos comerciais**. Caminhos: músicas originais ou encomendadas, músicas CC0/CC-BY, ou bandas independentes locais com contrato.

- **Gêneros:** skate punk, pop-punk, hip-hop boom-bap, drum'n'bass/breakbeat, nu-metal leve e um eletrônico "Aero" mais calmo para os menus (pads brilhantes, sinos, água).
- **Rádio da cidade:** estações por distrito (Vila Concreto = punk/hip-hop, Centro Gel = eletrônico Aero, etc.).
- **SFX:** rodinhas no concreto/metal/vidro, pop do shape, *grind* em rail, bolhas e "plim" de vidro nas pontuações Aero.

---

## 10. Implementação e validação

A camada visual já está implementada em Three.js (`src/render/`, `src/ui/`). Toda a arte atual é **procedural**: atlas desenhado em código, modelos low poly gerados por `MeshBuilder` e fontes OFL. Por isso ainda não há assets de terceiros.

Como validar: **`docs/validacao-visual.md`** (vitrine, laboratório e capturas automáticas).

**Achados da primeira validação:**
- Na resolução 240 e no zoom de visão geral, os veículos viram poucos pixels e os tipos não se distinguem; a leitura por silhueta só funciona no zoom próximo. Caminhos: limitar o zoom máximo de afastamento, usar 360 linhas como padrão ou mostrar ícones por tipo no overlay.
- Pisos grandes precisam ser subdivididos (≈1 tile), senão o affine warping vira arcos enormes.
- Torres muito altas escondem os elementos radicais; mantenha a altura ≤ ~22 m perto de loops e travessias.

**Modelos atuais** (orçamento verificado no laboratório):
- Veículos (14): todos os `kind`s de `veiculos.json` + `veh_tandem`, `veh_tandem_4`, `veh_tuktuk`.
- Prédios (11): `bld_res_1/2/3` (o 3 tem pista no telhado), `bld_com_1/2/3` (o 3 é a Torre Bolha de esferas), `bld_ind_1`, `bld_school`, `bld_hospital`, `bld_park`, `bld_skatepark`.
- Radicais (11): rampa-ponte, loop aéreo, salto mortal, rail-passarela, wallride, quarter, bowl, elevador + cápsula, **torre espiral**, **mega half-pipe**.
- Props (7): árvore, poste, banco, parada, estação de compartilhamento, telão CRT, nuvem.

Merge com o design de overboards: ver `docs/planning.md` (inclui os assets pedidos pelo cenário Vila Nova).

## 11. Próximos passos

1. Fechar o mood board com as referências pesquisadas (Sprint 0).
2. Fazer um *greybox* de um quarteirão com uma Rampa-Ponte e um Loop Aéreo, já no `Ps1Material` em Three.js.
3. Montar o pacote de texturas inicial (concreto, asfalto, vidro, grama, pichação) a partir das fontes livres pesquisadas.
4. Fazer o protótipo do HUD de manobra.
5. Criar `docs/creditos.md` com a licença de cada asset de terceiros.
