# Cenário 02 — Centro Gel

**Problema principal:** P8 Uso do espaço, comércio e entregas · **secundário:** P1 Congestionamento de faixas (ver [problemas.md](problemas.md)).
**Duração-alvo:** ~15 minutos reais · **14 dias** de jogo.
**Objetivo de design:** ensinar que a **largura da rua é disputada** por fluxo, entrega, pedestre e lazer, e que dar o espaço a um grupo tira de outro. Família de soluções nova: **zona de pedestre, docas/racks de entrega, janelas de horário e Funil Bowl**. Mantém tudo do cenário 1 (divisão de faixas, limite, semáforo, travessia, tuk-tuk).

> Valores numéricos são provisórios e vivem em [`config/balance.json`](../../config/balance.json). Este cenário usa recursos da v0.2 do [`SPEC.md`](../../SPEC.md) (BMX, patins, hoverboard, Funil Bowl, Quarter-pipe de Esquina), previstos para a fase "Cenários 2 a 4".

---

## 1. Situação inicial

O Centro Gel é o coração comercial da cidade: ~64×64 tiles, ~2.400 moradores e muito mais gente de passagem. As vitrines de gel brilham, mas a rua principal (Avenida das Vitrines) é disputada o dia todo: entregadores de BMX param na faixa rápida, a calçada some atrás de mesinhas e a Praça do Gel está vazia porque ninguém consegue chegar nela. Aqui não há canal; a Avenida é larga e é atravessada por um **Loop Aéreo** (usado só por quem faz manobras), com o tuk-tuk como rota acessível.

| Bairro | Papel | Detalhe |
|---|---|---|
| Avenida das Vitrines | Comércio | Eixo principal; gargalo de entregas e pedestres |
| Praça do Gel | Lazer | Vazia e sem skatepark; candidata a "rua viva" e Funil Bowl |
| Mercadão | Comércio e doca | 60% das entregas; sem doca própria |
| Vila Gel | Moradia | Moradores reclamam de barulho e rua tomada |
| Beco dos Pedais | Oficinas | Origem de boa parte dos entregadores |

### Personagens
**Recorrentes (herdados do cenário 1):**
- **Seu Osvaldo** (comerciante): agora dono de loja na Avenida; teme a zona de pedestre.
- **Dona Rita** (68, cadeira motorizada): quer calçada larga e rota acessível até a Praça do Gel.
- **Bia** (13, skate): quer um skatepark na praça.

**Novos:**
- **Tuco** (entregador de BMX): negocia horários, faixas e doca; é o fio condutor do cenário.
- **Dona Zefa** (padeira, Vila Gel): quer a rua tranquila no fim de semana, mas depende de entrega às 5h.

---

## 2. Ferramentas

| Ferramenta | Disponível desde | Observação |
|---|---|---|
| Sentido da via, divisão de faixas, limite, semáforo, travessia, linha de tuk-tuk | Início | Herdadas do cenário 1 |
| Quarter-pipe de esquina | Início (se reduziu quedas em 30% no cenário 1; senão, dia 4) | Acelera conversões |
| **Zona de pedestre** (rua fechada por horário) | Início — **nova** | Ensina o trade-off vendas × vida do bairro |
| **Doca / rack de entrega** | Início — **nova** | Tira a entrega da faixa rápida |
| **Janela de horário de entrega** | Dia 3 — **nova** | Política por faixa e hora |
| **Funil Bowl** (rotatória) | Após a meta intermediária (dia 6) — **nova** | Ocupa a praça inteira |

**Raio-x (overlays):** ocupação por faixa, **entregas paradas** (novo), vida do comércio (vendas por quarteirão), acessibilidade, quedas.

---

## 3. Metas

| Tipo | Meta | Medida |
|---|---|---|
| **Principal** | Subir o **movimento do comércio em 15%** sem aumentar o tempo médio de viagem | Dia 14 vs. dia 1 |
| **Equilíbrio 1** | **95% de acessibilidade** até a Praça do Gel e o Mercadão | Dia 14 |
| **Equilíbrio 2** | Quedas por 1.000 viagens ≤ dia 1 e saldo ≥ 0; orçamento inicial 6.000 | Dia 14 |

**Estrelas**
- ⭐ Meta principal.
- ⭐⭐ Principal + equilíbrios 1 e 2.
- ⭐⭐⭐ Tudo isso + satisfação de Seu Osvaldo **e** Dona Zefa ≥ 60% e tempo médio de entrega do Tuco ≤ 20 min (equidade entre comerciante, morador e entregador).

---

## 4. Roteiro de jogo (~15 min)

| Tempo | O que acontece | Aprendizado |
|---|---|---|
| 0:00–1:30 | Abertura: Tuco bloqueia a faixa rápida; o raio-x de entregas mostra BMX parado em vermelho | Diagnosticar largura disputada |
| 1:30–4:00 | **Mini-tutorial:** instalar uma doca no Mercadão e ver a faixa rápida liberar | Doca como alternativa à faixa |
| 4:00–7:00 | Jogador livre; testa zona de pedestre na Praça do Gel; vendas oscilam; dilema do dia 5 | Zona de pedestre custa no curto prazo |
| 7:00–9:00 | **Dia 7 — Feira de Gel:** evento ao vivo (§5) | Surpresa e tensão |
| 9:00–12:00 | Libera o **Funil Bowl**; rotatória na Praça ou "rua viva" | Espaço de lazer × fluxo |
| 12:00–14:00 | Dia 10: **dilema** (§6); ajustes finais | Escolha com custo |
| 14:00–15:00 | Balanço: KPIs, comentários, estrelas, desbloqueios | Fechamento |

---

## 5. Evento principal — Feira de Gel e blitz dos BMX

- **Quando:** dia 7, 10h–18h (aviso de 24h pelo rádio).
- **Efeito:** +1.200 visitantes ao Centro; **40 entregadores de BMX** chegam juntos para atender o dobro de pedidos e tomam a Praça do Gel e a faixa rápida da Avenida.
- **Soluções esperadas:** doca/rack extra no Mercadão, janela de entrega antecipada, zona de pedestre temporária na Praça (com rota acessível), Funil Bowl, linha de tuk-tuk, calçada ampliada, limite de velocidade.
- **Falha:** se a ocupação da Avenida passar de 150% por mais de 30 min, "feira travada": vendas −20%, satisfação −10 e três quedas.
- **Pressão de tempo:** contador regressivo até as 10h; a cada hora de atraso, mais BMX entram.

## 6. Dilemas

### Dia 5 — Praça do Gel
> *Bia quer um skatepark; Dona Rita quer calçada larga e sombra; o Fabricante oferece pagar o skatepark em troca de anúncios em gel.*

| Opção | Efeito |
|---|---|
| A. Funil Bowl com skatepark | Radicalidade sobe; precisa de rota acessível até a borda |
| B. Calçada larga e bancos | Acessibilidade sobe; radicalidade estagna |
| C. Aceitar o patrocínio | Saldo sobe; satisfação cai (anúncios) |

### Dia 10 — Avenida só para pedestres?
> *Seu Osvaldo teme perder clientes se a Avenida virar zona de pedestre aos sábados. Dona Zefa e Dona Rita querem a rua viva. Tuco avisa que sem entrega às 6h as vitrines ficam vazias.*

| Opção | Efeito |
|---|---|
| A. Zona de pedestre sáb/dom com janela de entrega às 6h | Bairro mais vivo; vendas oscilam; custo de fiscalização |
| B. Zona de pedestre integral, entrega só por doca no Mercadão | Mais vida; Osvaldo perde clientes no curto prazo; Tuco anda mais |
| C. Manter como está | Saldo estável; três grupos descontentes |

O resultado influencia o ponto de partida do **cenário 3 (Orla Bolha)**: radicalidade e satisfação definem quantos visitantes chegam à orla.

---

## 7. Curva de dificuldade

| Dia | Pressão |
|---|---|
| 1–2 | Baixa — aprender a doca |
| 3–4 | Média — janela de horário e vendas oscilando |
| 5 | Dilema da Praça |
| 6 | Libera o Funil Bowl |
| 7 | **Alta** — Feira de Gel |
| 8–9 | Média — consequências |
| 10 | Dilema da Avenida |
| 11–14 | Média — ajustes e meta próxima |

---

## 8. Desbloqueios e recompensas

| Condição | Desbloqueia |
|---|---|
| Cumprir a meta principal | Cenário 03 — Orla Bolha |
| Sobreviver à Feira sem "feira travada" | Política permanente "janela de horário" |
| 3 estrelas | Carta de política "Rua viva" (zona de pedestre grátis nos fins de semana) |
| Reduzir entregas paradas em 50% | **Wallride Tubular** (usado no cenário 3 para cortar o prédio da orla) |

---

## 9. Texto de tutorial (rascunho)

1. "O Centro Gel brilha, mas a rua não cabe todo mundo. Veja onde as entregas estão paradas."
2. "Uma doca tira o BMX da faixa rápida. Coloque uma no Mercadão."
3. "Zona de pedestre é bonita, mas Seu Osvaldo vai sentir no caixa."
4. "Uma feira se aproxima. Prepare a Avenida."

---

## 10. Checklist de playtest

- [ ] O jogador entende que doca e janela de horário resolvem coisas diferentes?
- [ ] O efeito da zona de pedestre aparece nas vendas em menos de 1 dia de jogo?
- [ ] A Feira de Gel gera tensão sem parecer injusta?
- [ ] 3 estrelas exigem escolhas diferentes de 1 estrela?
- [ ] O Funil Bowl é vantajoso em algumas ruas e prejudicial em outras?
- [ ] O Loop Aéreo tem a rota acessível (tuk-tuk) visível?
- [ ] O cenário termina em ~15 min?

## 11. Dados necessários (para Engenharia e Arte)

**Engenharia**
- `assets/cities/centro-gel.json`: vias com faixas, avenida larga com travessia, prédios, bairros, `ownership` por veículo (BMX e hoverboard comuns).
- Travessia: `loop_aereo` com `rota_acessivel: tuktuk`, conforme `data/arte/elementos-radicais.json`.
- Conceitos novos a modelar (não existem hoje em `data/arte/`): doca/rack de entrega, zona de pedestre por horário, janela de horário de entrega, KPIs `comercio` e `tempo_de_entrega`.
- Eventos: `feira_de_gel`, notícia de rádio, balões de fala (Tuco, Dona Zefa, Osvaldo, Rita, Bia).

**Arte** (ids reais de `data/arte/`)
- Elementos radicais: `funil_bowl`, `quarter_esquina`, `wallride_tubular`, `loop_aereo`, `elevador_bolha`, `rampa_ponte`.
- Veículos: `pedestre`, `skate`, `bmx`, `patinete`, `patins`, `hoverboard`, `cadeira_motorizada`, `cadeira_rodas`, `tuktuk`.
- Modelos novos: doca de entrega, rack de BMX, mesinhas e vitrines em gel, banca da feira.
