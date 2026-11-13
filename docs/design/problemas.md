# Catálogo de problemas urbanos

Documento de **Game Design** do PucaCity. Cada problema tem o sintoma que o jogador vê, a causa, as soluções (com custo e trade-off) e o KPI que mede o resultado.

> **Mundo (de acordo com o [`SPEC.md`](../../SPEC.md) e o [`style-guide.md`](../style-guide.md)):** a cidade radical do Frutiger Aero, **sem carros**. Moradores andam a pé, de cadeira de rodas, skate, patinete, patins, hoverboard, BMX etc. O transporte coletivo é de **tuk-tuk** (linhas principais) e **tandem** (linhas de bairro). Rios, canais e avenidas são atravessados por **elementos radicais** (Rampa-Ponte, Loop Aéreo, Salto Mortal, Rail-Passarela), cada um com uma **rota acessível** (Elevador de Bolha, passarela de vidro, tuk-tuk).
>
> Faixas: **calçada**, **rodinha lenta**, **rodinha rápida**, **coletiva**. A ferramenta central é **redistribuir a largura da via** entre elas.

---

## 1. Os 8 problemas centrais

### P1. Congestionamento de faixas
- **Sintoma:** faixa de rodinha rápida em vermelho, skatistas parados atrás de um patinete lento, viagens de 40 min no pico.
- **Causa:** largura mal distribuída, cruzamentos sem prioridade, todos indo ao mesmo lugar às 8h e às 18h.

| Solução | Efeito | Custo / trade-off |
|---|---|---|
| Divisão de faixas | Dá espaço a quem mais usa | Tira de outra faixa; alguém sofre |
| Mão única por faixa | Dobra a capacidade | Voltas maiores |
| Semáforo / onda verde | Reduz paradas | Pedestre espera mais |
| Quarter-pipe de esquina | Acelera conversões da rodinha rápida | Risco de queda, obra |
| Funil Bowl (rotatória) | Libera o cruzamento | Ocupa praça inteira |
| Linha de tuk-tuk | Tira gente das faixas | Operação cara, lotação |
| Horários escalonados (comércio, escola) | Achata o pico | Desagrada comerciantes |

- **KPI:** tempo médio de viagem; % de faixas saturadas.

### P2. Segurança e quedas
- **Sintoma:** ícones de queda no mapa, atropelamento em frente à escola, queda no Loop Aéreo.
- **Causa:** velocidades diferentes na mesma faixa, falta de faixa própria, cruzamento cego, elementos radicais perigosos.
- **Soluções:** limite de velocidade, faixas separadas, travessia elevada, rede de segurança nos saltos, socorristas de patins, escola de skate, capacete obrigatório.
- **Trade-off:** limite baixo reduz queda mas aumenta o tempo e tira a "vibe"; fiscalização custa verba e gera protesto.
- **KPI:** quedas e colisões por 1.000 viagens.

### P3. Energia e bateria
- **Sintoma:** patinete elétrico, hoverboard, cadeira motorizada e tuk-tuk parando no meio da via; fila nas estações de carga; apagão no pico.
- **Causa:** a rede elétrica não aguenta todos carregando ao mesmo tempo.
- **Soluções:** estações de carga, painéis solares, baterias comunitárias, tarifa de carga por horário, compartilhamento (menos baterias paradas).
- **Trade-off:** energia limpa custa caro no início; tarifa dinâmica irrita quem trabalha à noite.
- **KPI:** consumo atendido (%); quedas de energia; % de energia limpa.

### P4. Ruído, calor e lixo eletrônico
- **Sintoma:** reclamação de barulho de rodinha no concreto, praças que viram forno, baterias e rodinhas descartadas.
- **Causa:** muito concreto cru, rodinhas em pisos duros, ciclo curto de troca de bateria.
- **Soluções:** piso absorvente em zonas silenciosas, arborização, praças Aero com água e sombra, pontos de reciclagem de bateria.
- **Trade-off:** árvores tomam largura da via; piso macio reduz velocidade; reciclagem custa operação contínua.
- **KPI:** índice de ruído; temperatura média; % de baterias recicladas.

### P5. Desigualdade e acesso
- **Sintoma:** bairro periférico com viagem de 1h30, moradores sem veículo próprio, serviços longe.
- **Causa:** a rede está concentrada no centro; patinete elétrico e hoverboard são caros (posse por bairro em `ownership`).
- **Soluções:** linha de tuk-tuk ou tandem para a periferia, estações de compartilhamento subsidiadas, tarifa social, serviços descentralizados (escola e posto no bairro).
- **Trade-off:** subsídio pesa no orçamento; descentralizar demora.
- **KPI:** % de moradores com serviços essenciais a ≤ 15 min; diferença de tempo entre bairros.

### P6. Acessibilidade
- **Sintoma:** usuários de cadeira de rodas isolados do outro lado do canal, calçada quebrada, fila no Elevador de Bolha.
- **Causa:** travessia só por rampa radical ou elevador sem capacidade.
- **Soluções:** Elevador de Bolha extra, passarela de vidro, tuk-tuk acessível, calçada larga, rampas.
- **Trade-off:** obra cara e benefício "invisível"; o jogo mostra o impacto com moradores com nome.
- **KPI:** % de moradores, incluindo cadeirantes, que chegam ao destino.
- **Regra do jogo:** toda travessia radical precisa de rota acessível; sem ela, o KPI cai e uma meta do cenário pode travar.

### P7. Clima e infraestrutura frágil
- **Sintoma:** chuva deixa a pista escorregadia, canal transborda, vento fecha o Loop Aéreo.
- **Causa:** drenagem insuficiente, falta de rota alternativa, elemento radical sem proteção.
- **Soluções:** drenagem, coberturas de vidro, rotas redundantes, rede de segurança, plano de contingência.
- **Trade-off:** redundância é cara e parece desperdício até a crise chegar.
- **KPI:** tempo para restabelecer a mobilidade após um evento.

### P8. Uso do espaço, comércio e entregas
- **Sintoma:** entregadores de BMX bloqueando a rua do mercado, comerciantes reclamando, praça sem vida, skatepark sem acesso.
- **Causa:** a largura limitada é disputada por fluxo, entrega, pedestre e lazer.
- **Soluções:** docas e racks de entrega, janelas de horário, zonas de pedestre, "ruas vivas" nos fins de semana, skateparks nos bairros certos.
- **Trade-off:** zona de pedestre ajuda a vida do bairro mas pode reduzir as vendas no começo.
- **KPI:** movimento do comércio; tempo de entrega; radicalidade (uso de elementos radicais).

---

## 2. O núcleo do jogo: todo problema bate em outro

| Quando você… | Resolve… | Mas piora… |
|---|---|---|
| Alarga a faixa rápida | P1 | P2 (quedas), P6 (calçada estreita), P4 |
| Troca uma Rampa-Ponte por Salto Mortal | Radicalidade, P1 | P2, P6 se faltar rota acessível |
| Adiciona Elevador de Bolha | P6 | Orçamento, fila |
| Põe linha de tuk-tuk | P1, P5, P6 | Orçamento, P3 (energia) |
| Reduz o limite de velocidade | P2 | P1, P8 (entregas), radicalidade |
| Planta árvores | P4 | P1 (largura de via) |
| Desloca a carga para a madrugada | P3 | P5 (quem trabalha à noite) |

Sem o "vilão" carro, o conflito vem **da disputa por largura**, **das travessias** e **da acessibilidade**. Cada decisão ajuda um grupo e prejudica outro, o que cria tensão e dilema.

---

## 3. Surpresa e tensão por problema

| Problema | Evento surpresa | Pressão de tempo |
|---|---|---|
| P1 | Campeonato de skate leva 1.500 pessoas ao bowl | Pico se aproxima |
| P2 | Queda em cadeia no Loop Aéreo; modelo novo de patinete elétrico mais rápido | Quedas sobem a cada dia |
| P3 | Apagão parcial no pico | A bateria da cidade cai por hora |
| P4 | Onda de calor | Temperatura sobe e o fluxo despenca |
| P5 | Greve dos tuk-tuks corta a única linha da periferia | Moradores presos |
| P6 | Elevador de Bolha quebra com idosa precisando do hospital | Meta com relógio |
| P7 | Chuva forte: pista escorregadia e canal sobe | Água sobe em 3 min |
| P8 | Entregadores de BMX tomam a praça durante um evento | Evento ao vivo |

### Outros eventos e crises
- **Pista escorregadia:** chuva dobra o risco de queda nas faixas rápidas.
- **Vento no Loop Aéreo:** elemento fechado por 1 dia; desvio obrigatório.
- **Boato no rádio:** todos vão à mesma parada em 3 minutos.
- **Obra emergencial:** uma travessia fecha e é preciso descobrir a rota alternativa.
- **Ambulância (socorrista de patins) não passa:** abrir um corredor de emergência antes do pico.
- **Bairro novo:** população cresce 10% sem aviso.

### Dilemas
- Comerciantes querem entrega de manhã; moradores querem a rua livre.
- Skatistas querem um Salto Mortal (mais pontos de gap); o grupo de cadeirantes quer mais elevadores com a mesma verba.
- Limite de velocidade menor reduz quedas, mas os entregadores perdem renda.
- Uma empresa oferece estações de carga grátis se puder colocar anúncios em gel.
- Um bairro pede um skatepark; outro pede calçadas largas.

### Personagens recorrentes
- **Dona Rita** (68, cadeira motorizada): comenta cada mudança de acessibilidade.
- **Bia** (13, skate): testa limites de velocidade e elementos radicais.
- **Seu Osvaldo** (comerciante): teme perder vendas.
- **Tuco** (entregador de BMX): negocia horários e faixas.
- **O Fabricante:** quer vender mais e pressiona por regras frouxas.
- **A Associação de Cadeirantes:** defende rotas acessíveis.

---

## 4. Progressão: problema → cenário

| # | Cenário | Problema principal | Secundários | Ferramentas liberadas |
|---|---|---|---|---|
| 1 | Vila Nova (tutorial) | P1 Congestionamento | P6 | Sentido, divisão de faixas, limite, semáforo, travessia (Rampa-Ponte / Elevador), linha de tuk-tuk |
| 2 | Centro Gel | P8 Espaço e entregas | P1 | Zona de pedestre, docas, Funil Bowl |
| 3 | Orla Bolha | P7 Clima e canais | P6 | Cobertura de vidro, drenagem, Salto Mortal, Rail-Passarela |
| 4 | Morro Alto | P6 Acessibilidade | P5 | Elevadores extras, rampas, Loop Aéreo |
| 5 | Pátio Industrial | P3 Energia e bateria | P2 | Estações de carga, painéis solares, baterias comunitárias |
| 6 | Cidade Verde | P4 Ruído, calor, lixo | P3 | Arborização, piso absorvente, reciclagem |
| 7 | Vila Concreto | P5 Desigualdade | P1, P6 | Tarifa social, tandem, compartilhamento subsidiado |
| 8 | Pucacity | **Todos juntos** | — | Tudo |

Nomes de bairros 2, 3 e 7 reaproveitam as propostas de distritos do `style-guide.md` (Centro Gel, Orla Bolha, Vila Concreto, Pátio Industrial). Cada cenário ensina **um problema e uma família de soluções**; o último mistura todos.

---

## 5. Metas e estrelas

Cada cenário tem **1 meta principal + 2 metas de equilíbrio**:
- **Principal:** resolver o problema do cenário (ex.: reduzir o tempo médio em 20%).
- **Equilíbrio 1:** acessibilidade acima do limite (ex.: ≥ 95%).
- **Equilíbrio 2:** não piorar quedas e ficar no orçamento.

Estrelas:
- ⭐ resolveu a meta principal;
- ⭐⭐ resolveu sem piorar outro problema;
- ⭐⭐⭐ resolveu, sem piorar, e melhorou a equidade e a satisfação de um grupo-chave.

---

## 6. Rejogabilidade

- Seed diária e semanal, com ranking.
- Desafios com restrições: "sem criar elementos radicais", "orçamento zero", "só tuk-tuk".
- Modificadores: "chuva permanente", "2× população", "todos de patinete elétrico".
- Modo Caos: eventos escalam até a cidade cair.
- Estilos de governo reconhecidos no fim: **Tecnocrata**, **Planejador Verde**, **Skatista Radical** (alta radicalidade e quedas), **Inclusivo**, **Equilibrista**.
- Conquistas: "zero quedas por 30 dias", "100% de acessibilidade", "sobreviveu a 3 apagões", "novo recorde no Salto Mortal".
- Cidades da comunidade: exportar o `city.json` e outros tentam resolver.

---

## 7. Perguntas em aberto

- A poluição fica dividida entre P3 (energia) e P4 (ruído/calor/lixo)?
- Qual o tom: solarpunk/otimista ou mais sujo e punk?
- Duração-alvo de um cenário: 15 minutos ou 1 hora?
- Entregas existem no MVP ou ficam para o cenário 2?
