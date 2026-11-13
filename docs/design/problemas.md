# Catálogo de problemas urbanos

Documento de **Game Design** do PucaCity. Cada problema tem o sintoma que o jogador vê, a causa, as soluções (com custo e trade-off) e o KPI que mede o resultado.

> **Premissa de mundo:** a cidade **não tem carros**. A mobilidade individual é feita por **overboards** (pranchas flutuantes com bateria), além de pedestres e de **plataformas coletivas** (vagões flutuantes, esteiras urbanas, cápsulas). Cargas andam em **drones e carrinhos-plataforma**.
>
> **Premissas provisórias** (confirmar com o time): existe transporte coletivo; a poluição tem dois lados — energética (P3) e ambiental (P4).

---

## 1. Os 8 problemas centrais

### P1. Congestionamento de fluxo
- **Sintoma:** nuvem vermelha no mapa, gente parada nas pistas, viagens de 40 min no pico.
- **Causa:** gargalos, cruzamentos sem prioridade, todos indo ao mesmo lugar às 8h e às 18h.

| Solução | Efeito | Custo / trade-off |
|---|---|---|
| Pistas por velocidade (lenta, normal, expressa) | Separa fluxos | Ocupa espaço da calçada |
| Rotatória magnética / prioridade de cruzamento | Libera o nó | Obra bloqueia o trecho |
| Mão única | Dobra a capacidade | Obriga a voltas maiores |
| Plataforma coletiva | Tira gente da pista | Custo de operação, lotação |
| Horários escalonados (comércio, escola) | Achata o pico | Desagrada comerciantes |

- **KPI:** tempo médio de viagem; % de pistas saturadas.

### P2. Segurança e quedas
- **Sintoma:** ícones de queda no mapa, atropelamentos em frente à escola, reclamação dos moradores.
- **Causa:** velocidade alta, pedestre e overboard dividindo espaço, cruzamento cego.
- **Soluções:** limite de velocidade por zona, travessias elevadas, faixas separadas, sensores de colisão, sinalização, escola de overboard, capacete obrigatório.
- **Trade-off:** velocidade menor reduz queda mas aumenta o tempo de viagem; fiscalização custa verba e gera protesto.
- **KPI:** quedas por 1.000 viagens.

### P3. Energia e bateria (poluição energética)
- **Sintoma:** pranchas que param no meio da rua, filas nas estações de carga, apagão no pico.
- **Causa:** a rede elétrica não aguenta todos carregando ao mesmo tempo.
- **Soluções:** painéis solares, baterias comunitárias, tarifa mais barata de madrugada (desloca a carga), estações de troca, docas de carga nos destinos.
- **Trade-off:** energia limpa custa caro no início; tarifa dinâmica irrita quem trabalha à noite.
- **KPI:** % da demanda atendida; quedas de energia; % de energia limpa.

### P4. Ruído, calor e lixo eletrônico (poluição ambiental)
- **Sintoma:** reclamação de barulho, rua de asfalto que vira forno, pilhas de baterias descartadas.
- **Causa:** turbinas de overboard, muito concreto, ciclo curto de troca de bateria.
- **Soluções:** zonas silenciosas, pistas com material absorvente, arborização, parques, pontos de reciclagem de bateria, política de recolha.
- **Trade-off:** árvores tomam espaço de pista; reciclagem custa operação contínua.
- **KPI:** índice de ruído; temperatura média; % de baterias recicladas.

### P5. Desigualdade e acesso
- **Sintoma:** bairro periférico com viagem de 1h30, moradores sem overboard, serviços longe.
- **Causa:** a rede está concentrada no centro e o overboard é caro.
- **Soluções:** linha coletiva para a periferia, overboard compartilhado ou subsidiado, tarifa social, serviços descentralizados (posto de saúde e escola no bairro).
- **Trade-off:** subsídio pesa no orçamento; descentralizar demora.
- **KPI:** % de moradores com serviços essenciais a ≤ 15 min; diferença de tempo de viagem entre bairros.

### P6. Acessibilidade
- **Sintoma:** idosos e cadeirantes isolados, calçada quebrada, escadas sem rampa.
- **Causa:** a cidade foi pensada para quem anda de overboard.
- **Soluções:** rampas e elevadores, calçadas niveladas, esteiras urbanas, plataformas com assento e espaço para cadeira, paradas frequentes.
- **Trade-off:** obras caras e benefício difícil de "ver"; o jogo mostra o impacto com moradores com nome.
- **KPI:** % de pessoas com mobilidade reduzida que conseguem chegar ao destino.

### P7. Clima e infraestrutura frágil
- **Sintoma:** alagamento corta pistas, tempestade desliga o campo flutuante, ponte interditada.
- **Causa:** drenagem insuficiente, pistas em áreas baixas, falta de rota alternativa.
- **Soluções:** drenagem, rotas redundantes, pontes e passarelas, reserva de energia, plano de contingência.
- **Trade-off:** redundância é cara e parece desperdício até a crise chegar.
- **KPI:** tempo para restabelecer a mobilidade após um evento.

### P8. Uso do espaço, comércio e entregas
- **Sintoma:** drones e carrinhos de carga bloqueando a rua, comerciantes reclamando, praça sem vida.
- **Causa:** espaço limitado disputado por fluxo, entrega, pedestre e comércio.
- **Soluções:** docas de carga, janelas de entrega, zonas de pedestre, plataformas de carga noturna, "ruas vivas" nos fins de semana.
- **Trade-off:** zona de pedestre ajuda a vida do bairro mas pode reduzir as vendas no começo.
- **KPI:** movimento do comércio; tempo de entrega; tempo de pedestre na praça.

---

## 2. O núcleo do jogo: todo problema bate em outro

| Quando você… | Resolve… | Mas piora… |
|---|---|---|
| Aumenta a velocidade | P1 (tempo) | P2 (quedas), P4 (ruído) |
| Cria mais pistas | P1 | P4 (calor), P8 (espaço) |
| Põe plataforma coletiva | P1, P5, P6 | Orçamento, P3 (energia) |
| Reduz velocidade | P2 | P1, P8 (entregas) |
| Planta árvores | P4 | P1 (espaço) |
| Desloca a carga para a madrugada | P3 | P5 (quem trabalha à noite) |

Cada decisão ajuda um grupo e prejudica outro. É isso que cria tensão e dilema.

---

## 3. Surpresa e tensão por problema

| Problema | Evento surpresa | Pressão de tempo |
|---|---|---|
| P1 | Festival leva 5 mil pessoas ao mesmo lugar | Pico se aproxima |
| P2 | Modelo novo (X9), mais rápido, chega às ruas | Quedas sobem a cada dia |
| P3 | Apagão parcial no pico | A bateria da cidade cai por hora |
| P4 | Onda de calor | Temperatura sobe e o fluxo despenca |
| P5 | Greve corta a única linha da periferia | Moradores presos |
| P6 | Idosa precisa chegar ao hospital | Meta com relógio |
| P7 | Chuva forte alaga a avenida principal | Água sobe em 3 min |
| P8 | Carrinho de carga bloqueia a praça durante um evento | Evento ao vivo |

### Outros eventos e crises
- **Tempestade magnética:** overboards perdem estabilidade em certas pistas por 2 dias.
- **Greve dos mecânicos de bateria:** estações de troca fecham.
- **Onda de boato:** todos vão à mesma estação em 3 minutos.
- **Pista fantasma:** uma pista some sem aviso e é preciso descobrir o motivo.
- **Ambulância não passa:** abrir um corredor de emergência antes do pico.

### Dilemas
- Comerciantes querem entregas pela manhã; moradores querem silêncio.
- Banir overboards muito rápidos reduz quedas, mas os entregadores perdem renda.
- Uma empresa oferece estações grátis se puder colocar anúncios.
- Um bairro pede uma pista exclusiva; outro pede a mesma verba para calçadas acessíveis.

### Personagens recorrentes
- **O Fabricante:** quer vender mais e pressiona por regras frouxas.
- **A Associação de Pedestres:** defende calçadas.
- **O Sindicato dos Entregadores:** negocia horários e pistas.
- **Dona Rita:** moradora que reaparece e comenta o que mudou.

---

## 4. Progressão: problema → cenário

| # | Cenário | Problema principal | Secundários | Ferramentas liberadas |
|---|---|---|---|---|
| 1 | Vila Nova (tutorial) | P1 Congestionamento | — | Pista, mão única, rotatória |
| 2 | Centro Antigo | P8 Espaço e entregas | P1 | Zona de pedestre, docas |
| 3 | Porto | P7 Clima e pontes | P1 | Pontes, drenagem, balsas |
| 4 | Morro Alto | P6 Acessibilidade | P5 | Elevadores, rampas, esteiras |
| 5 | Distrito Tech | P3 Energia e bateria | P2 | Painéis solares, baterias comunitárias |
| 6 | Cidade Verde | P4 Ruído, calor, lixo | P3 | Arborização, reciclagem, zonas silenciosas |
| 7 | Zona Sul | P5 Desigualdade | P1, P6 | Tarifa social, linha coletiva, overboard compartilhado |
| 8 | Pucacity | **Todos juntos** | — | Tudo |

Cada cenário ensina **um problema e uma família de soluções**; o último mistura todos.

---

## 5. Metas e estrelas

Cada cenário tem **1 meta principal + 2 metas de equilíbrio**:
- **Principal:** resolver o problema do cenário (ex.: reduzir o tempo médio em 20%).
- **Equilíbrio 1:** não piorar outro indicador acima de X (ex.: quedas não sobem).
- **Equilíbrio 2:** ficar no orçamento ou preservar a satisfação de um grupo.

Estrelas:
- ⭐ resolveu a meta principal;
- ⭐⭐ resolveu sem piorar outro problema;
- ⭐⭐⭐ resolveu, sem piorar, e melhorou a equidade.

---

## 6. Rejogabilidade

- Seed diária e semanal, com ranking.
- Desafios com restrições: "sem construir pistas novas", "orçamento zero".
- Modificadores: "chuva permanente", "2× população", "todos usam o X9".
- Modo Caos: eventos escalam até a cidade cair.
- Estilos de governo reconhecidos no fim: Tecnocrata, Planejador Verde, Populista, Equilibrista.
- Conquistas: "zero quedas por 30 dias", "cidade de 15 minutos", "sobreviveu a 3 apagões".
- Cidades da comunidade: exportar o `city.json` e outros tentam resolver.

---

## 7. Perguntas em aberto

- Existe transporte coletivo (plataformas, cápsulas, esteiras) ou a cidade é 100% individual?
- O overboard é de cada pessoa, alugado ou compartilhado?
- Que tom: realista, solarpunk/otimista ou distópico?
- Duração-alvo de um cenário: 15 minutos ou 1 hora?
