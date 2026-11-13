# Cenário 04 — Morro Alto

**Problema principal:** P6 Acessibilidade · **secundário:** P5 Desigualdade e acesso (ver [problemas.md](problemas.md)).
**Duração-alvo:** ~15 minutos reais · **14 dias** de jogo.
**Objetivo de design:** a acessibilidade vira o **tema central**. Família de soluções nova: **Elevadores de Bolha extras, rampas, Loop Aéreo e tuk-tuk acessível com tarifa social**. O morro mostra que, quando a rota acessível falha, quem mora no alto fica isolado.

> **Terreno com elevação está fora do escopo do MVP** ([`SPEC.md`](../../SPEC.md) §3). O morro é representado só por **elementos radicais com altura própria** (Torre Espiral, Mega Half-pipe, Elevador de Bolha) e por travessias entre "patamares" de um mapa plano: cada patamar é uma área separada ligada por travessias. Valores numéricos são provisórios e vivem em [`config/balance.json`](../../config/balance.json).

---

## 1. Situação inicial

O Morro Alto tem três patamares (Base, Meio e Topo) ligados por poucas travessias radicais: ~64×64 tiles, ~2.000 moradores. A Base é o Terminal das Bolhas; o Meio tem comércio e escola; o Topo tem moradia e o posto de saúde. A **Torre Espiral** liga Base e Meio e só serve a quem faz manobras; o **Mega Half-pipe** ocupa a praça do Meio. O **Elevador de Bolha** do Meio tem fila e leva um grupo por vez. Os moradores do Topo têm menos veículos próprios (`ownership` baixo), então dependem do coletivo e do elevador.

| Bairro | Patamar | Papel | Detalhe |
|---|---|---|---|
| Terminal das Bolhas | Base | Interconexão | Chegada de tuk-tuk e do resto da cidade |
| Vila do Meio | Meio | Comércio | Torre Espiral e Mega Half-pipe |
| Pátio da Escola | Meio | Serviço | Fluxo de crianças |
| Topo do Morro | Topo | Moradia e posto de saúde | Poucos veículos próprios; serviço longe |
| Avenida do Corte | Base | Via larga | Atravessada pelo Loop Aéreo |

### Personagens
**Recorrentes:**
- **Dona Rita** (cadeira motorizada): agora mora no Topo; protagonista da meta de acessibilidade.
- **Associação de Cadeirantes:** pressiona por rotas acessíveis e comenta cada mudança.
- **Bia** (skate): adora a Torre Espiral e o Loop Aéreo.

**Novos:**
- **Seu Dito** (idoso, bengala, Topo): depende do tuk-tuk e do elevador para ir ao posto de saúde.
- **Léo e Mari** (crianças, Meio): precisam chegar à escola e testam as rampas.
- **Dona Cida** (agente de saúde, Topo): coordena visitas e precisa de corredor para socorrista de patins.

---

## 2. Ferramentas

| Ferramenta | Disponível desde | Observação |
|---|---|---|
| Sentido, divisão de faixas, limite, semáforo, travessia, linha de tuk-tuk | Início | Herdadas |
| Zona de pedestre, docas, Funil Bowl, drenagem, cobertura de vidro, Salto Mortal, Rail-Passarela, plano de contingência | Início | Cenários 2 e 3 |
| **Elevador de Bolha extra** | Início — **novo** (mais de um por travessia) | Capacidade por cápsula; forma fila |
| **Rampa acessível** (calçada de inclinação suave) | Início — **nova** | Barata, mas ocupa largura |
| **Loop Aéreo** (elemento de travessia) | Dia 3 — **novo** | Exige velocidade mínima; rota acessível = tuk-tuk |
| **Tarifa social** | Dia 5 — **nova** | Reduz o custo ao Topo; pesa no orçamento |

**Raio-x (overlays):** mapa de isolamento (acessibilidade por rota), fila nos elevadores, tempo de viagem por bairro (equidade), serviços essenciais a ≤ 15 min.

---

## 3. Metas

| Tipo | Meta | Medida |
|---|---|---|
| **Principal** | **100% dos moradores do Topo** com rota acessível ao posto de saúde e à escola, em ≤ 25 min | Dia 14 |
| **Equilíbrio 1** | Diferença de tempo de viagem Topo × Base ≤ **15 min** (P5) | Dia 14 |
| **Equilíbrio 2** | Quedas por 1.000 viagens ≤ dia 1 e saldo ≥ 0; orçamento inicial 8.000 | Dia 14 |

**Estrelas**
- ⭐ Meta principal.
- ⭐⭐ Principal + equilíbrios 1 e 2.
- ⭐⭐⭐ Tudo isso + Dona Rita, Seu Dito e Léo/Mari ≥ 60% satisfeitos e **todas as travessias com 2 ou mais rotas acessíveis**.

---

## 4. Roteiro de jogo (~15 min)

| Tempo | O que acontece | Aprendizado |
|---|---|---|
| 0:00–1:30 | Abertura: Dona Rita espera o elevador e perde a consulta; o raio-x mostra o Topo isolado | Diagnosticar isolamento |
| 1:30–4:00 | **Mini-tutorial:** colocar um 2º Elevador de Bolha no Meio e ver a fila cair | Capacidade × fila |
| 4:00–7:00 | Jogador livre; testa rampas e liga o Topo ao Meio por tuk-tuk | Soluções complementares |
| 7:00–9:00 | Dia 5: tarifa social e dilema de equidade | P5 entra |
| 9:00–12:00 | **Dia 9 — Elevador quebra com Seu Dito a caminho do posto** (§5) | Evento principal |
| 12:00–14:00 | Dia 11: **dilema** (§6); ajustes finais | Escolha com custo |
| 14:00–15:00 | Balanço: mapa de isolamento, KPIs, estrelas, desbloqueios | Fechamento |

---

## 5. Evento principal — Elevador de Bolha quebra

- **Quando:** dia 9, 7h–9h (pico da manhã; aviso só 3 min antes, pelo rádio de emergência).
- **Efeito:** o único Elevador de Bolha que serve o Topo para; Seu Dito precisa chegar ao posto de saúde; 120 pessoas ficam sem rota acessível.
- **Pressão de tempo:** **meta com relógio de 20 min** para abrir uma rota alternativa até o posto.
- **Soluções esperadas:** tuk-tuk de emergência na faixa coletiva, rampa acessível provisória, 2º Elevador de Bolha em outro ponto, corredor de emergência para socorrista de patins, plano de contingência.
- **Falha:** sem rota em 20 min, "paciente ilhado": satisfação de Seu Dito e da Associação −20 e uma meta de acessibilidade trava.

## 6. Dilemas

### Dia 5 — Tarifa social ou elevador extra?
> *Seu Dito diz que o tuk-tuk custa caro. A Associação quer um 2º Elevador de Bolha. O orçamento só dá para um.*

| Opção | Efeito |
|---|---|
| A. Tarifa social | Equidade sobe; saldo cai a cada dia |
| B. 2º Elevador de Bolha | Capacidade sobe; custo único; quem não tem veículo ainda paga o tuk-tuk |
| C. Esperar | Economiza; isolamento aumenta |

### Dia 11 — Loop Aéreo ou rampa?
> *Bia quer um Loop Aéreo sobre a Avenida do Corte (mais pontos de gap). A Associação lembra que a rota acessível dele é o tuk-tuk, que hoje lota.*

| Opção | Efeito |
|---|---|
| A. Loop Aéreo | Radicalidade sobe; acessibilidade cai sem mais tuk-tuks |
| B. Rampa acessível larga | Acessibilidade sobe; radicalidade estagna |
| C. Loop Aéreo + linha extra de tuk-tuk | Equilíbrio; custo alto |

O resultado influencia o ponto de partida do **cenário 5 (Pátio Industrial)**: a equidade define o orçamento e a posse de veículos elétricos no pátio.

---

## 7. Curva de dificuldade

| Dia | Pressão |
|---|---|
| 1–3 | Baixa — aprender elevador e rampa |
| 4 | Média — população cresce 10% |
| 5 | Dilema da tarifa social |
| 6–8 | Média — fila nos elevadores |
| 9 | **Alta** — elevador quebra |
| 10 | Média — consequências |
| 11 | Dilema do Loop Aéreo |
| 12–14 | Média — ajustes finais |

---

## 8. Desbloqueios e recompensas

| Condição | Desbloqueia |
|---|---|
| Cumprir a meta principal | Cenário 05 — Pátio Industrial |
| Sobreviver ao evento sem "paciente ilhado" | Carta "Corredor de emergência" |
| 3 estrelas | Carta "Elevador de Bolha de reserva" |
| Todas as travessias com 2 ou mais rotas | **Mega Half-pipe** liberado como obra nos cenários seguintes |

---

## 9. Texto de tutorial (rascunho)

1. "O Topo do Morro está isolado. Abra o raio-x de acessibilidade."
2. "Um elevador só não dá. Capacidade também é rota."
3. "Rampa barata ajuda, mas ocupa a largura da calçada."
4. "Um elevador vai quebrar. Tenha uma rota reserva."

---

## 10. Checklist de playtest

- [ ] O mapa de isolamento deixa claro quem está sem rota?
- [ ] O jogador entende que Torre Espiral e Loop Aéreo não substituem a rota acessível?
- [ ] O relógio de 20 min do dia 9 gera tensão sem parecer injusto?
- [ ] A tarifa social tem efeito perceptível em menos de 2 dias de jogo?
- [ ] 3 estrelas exigem decisões diferentes de 1 estrela?
- [ ] Os patamares funcionam como "morro" sem terreno com elevação?
- [ ] O cenário termina em ~15 min?

## 11. Dados necessários (para Engenharia e Arte)

**Engenharia**
- `assets/cities/morro-alto.json`: três patamares como áreas planas ligadas por travessias (`loop_aereo` com `tuktuk`; `rampa_ponte` e `salto_mortal` com `elevador_bolha`); `ownership` baixo no Topo; serviços (posto de saúde, escola).
- Conceitos novos a modelar (não existem hoje em `data/arte/`): rampa acessível, elevador com várias cápsulas, tarifa social, KPIs `isolamento` e `diferenca_de_tempo_entre_bairros`.
- Eventos: `elevador_quebra`, rádio de emergência, balões de fala (Rita, Dito, Cida, Léo e Mari, Bia).

**Arte** (ids reais de `data/arte/`)
- Elementos radicais: `torre_espiral`, `mega_halfpipe`, `loop_aereo`, `elevador_bolha`, `rampa_ponte`, `salto_mortal`, `rail_passarela`.
- Veículos: `pedestre`, `cadeira_rodas`, `cadeira_motorizada`, `skate`, `patinete`, `patins`, `tuktuk`, `tandem`.
- Modelos novos: rampa acessível de gel, cápsula de elevador extra, parada de tuk-tuk acessível, posto de saúde, bengala (acessório).
