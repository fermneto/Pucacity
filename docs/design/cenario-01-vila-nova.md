# Cenário 01 — Vila Nova (tutorial)

**Problema principal:** P1 Congestionamento de faixas · **secundário:** P6 Acessibilidade (ver [problemas.md](problemas.md)).
**Duração-alvo:** ~15 minutos reais · **14 dias** de jogo.
**Objetivo de design:** ensinar o ciclo *diagnosticar → intervir → ver o efeito → ajustar*, apresentar a **divisão de faixas** e a **regra da rota acessível**, e dar a primeira surpresa (campeonato de skate). O jogador deve terminar entendendo que **toda solução tem um custo**.

> Valores numéricos são provisórios e vivem em [`config/balance.json`](../../config/balance.json). O cenário usa só o que está no MVP do [`SPEC.md`](../../SPEC.md): agentes pedestre, cadeira de rodas, skate e patinete; faixas calçada/lenta/rápida/coletiva; Rampa-Ponte, Elevador de Bolha e linha de tuk-tuk.

---

## 1. Situação inicial

Vila Nova é uma cidade pequena (~48×48 tiles, ~1.200 moradores) cortada por **um canal**. Todo mundo vai ao Centro ao mesmo tempo. A Rua do Mercado é o único eixo entre o bairro residencial, a escola e o comércio, e vira um engarrafamento de rodinhas às 8h e às 18h. A única travessia do canal é uma **Rampa-Ponte**, e o **Elevador de Bolha** tem fila: quem está de cadeira de rodas leva 35 min para atravessar.

| Bairro | Papel | Detalhe |
|---|---|---|
| Residencial Norte | Moradia | 60% da população; viagens longas ao Centro |
| Centro / Mercado | Comércio | Destino de trabalho e compras; gargalo |
| Escola Municipal | Serviço | Fluxo de crianças e pais no horário de entrada |
| Praça do Bowl | Lazer | Palco do campeonato de skate (dia 7) |
| Zona Leste | Casas e oficinas | Menos movimento; rota alternativa; do outro lado do canal |

### Personagens com nome
- **Dona Rita** (68, cadeira motorizada, mora na Zona Leste): reclama da fila do Elevador de Bolha.
- **Bia** (13, skate): usa a faixa rápida, testa limites e elementos radicais.
- **Seu Osvaldo** (comerciante do Mercado): teme perder vendas se a rua mudar.

---

## 2. Ferramentas disponíveis

| Ferramenta | Disponível desde | Observação |
|---|---|---|
| Sentido da via (por faixa) | Início | Primeira ferramenta ensinada |
| Divisão de faixas | Início | Núcleo do cenário: redistribuir a largura |
| Limite de velocidade | Início | Ensina o trade-off tempo × segurança |
| Semáforo (ciclo/fases) | Após meta intermediária | Onda verde na Rua do Mercado |
| Elemento de travessia | Início | Rampa-Ponte × Elevador de Bolha (capacidade limitada) |
| Linha de tuk-tuk | Bloqueada → libera após o campeonato | Recompensa de progressão |

**Raio-x (overlays):** tráfego por faixa, acessibilidade, quedas.

---

## 3. Metas

| Tipo | Meta | Medida |
|---|---|---|
| **Principal** | Reduzir o tempo médio de viagem em **20%** | Média do dia 14 vs. dia 1 |
| **Equilíbrio 1** | Chegar a **95% de acessibilidade** (inclui cadeirantes) | Dia 14 |
| **Equilíbrio 2** | Quedas por 1.000 viagens não aumentam e saldo ≥ 0 | Dia 14 ≤ dia 1; orçamento inicial 5.000 |

**Estrelas**
- ⭐ Meta principal cumprida.
- ⭐⭐ Principal + equilíbrios 1 e 2.
- ⭐⭐⭐ Tudo isso + satisfação do Seu Osvaldo ≥ 60% (o comércio não saiu perdendo).

---

## 4. Roteiro de jogo (~15 min)

| Tempo | O que acontece | Aprendizado |
|---|---|---|
| 0:00–1:30 | Cena de abertura: Dona Rita reclama; o raio-x mostra a Rua do Mercado em vermelho e o canal sem rota acessível | Diagnosticar com overlays |
| 1:30–4:00 | **Tutorial guiado:** redistribuir a largura da Rua do Mercado entre calçada, lenta e rápida | Ferramenta + feedback |
| 4:00–7:00 | Jogador livre; Bia sofre quedas na faixa rápida; ajusta o limite | Velocidade × segurança |
| 7:00–9:00 | **Dia 7 — Campeonato de skate no bowl:** 1.500 pessoas chegam em 20 min de jogo | Surpresa e tensão |
| 9:00–12:00 | Jogador redistribui fluxo; libera a **linha de tuk-tuk** como recompensa | Progressão |
| 12:00–14:00 | Dia 11: **dilema** (ver §6); depois ajustes finais | Escolha com custo |
| 14:00–15:00 | Balanço: KPIs, comentários dos moradores, estrelas, desbloqueios | Fechamento |

---

## 5. Evento principal — Campeonato de skate no bowl

- **Quando:** dia 7, 17h–22h (aviso de 24h pelo rádio).
- **Efeito:** +1.500 viagens à Praça do Bowl; o Funil de pedestres e a faixa rápida saturam; muita gente de skate e BMX vem de fora.
- **Soluções esperadas:** ampliar a faixa rápida só durante o evento, mudar o sentido, limitar a velocidade, abrir a zona de pedestre na praça, usar a linha de tuk-tuk.
- **Falha:** se a ocupação da Rua do Mercado passar de 150% por mais de 30 min, "multidão parada": satisfação −10 e três quedas.
- **Pressão de tempo:** contador regressivo até o início do evento.

## 6. Dilemas

### Dia 11 — Entregas na Rua do Mercado
> *Seu Osvaldo pede para manter as entregas de manhã na Rua do Mercado, mas isso volta a travar a faixa rápida. Dona Rita pede a rua livre.*

| Opção | Efeito |
|---|---|
| A. Janela de entrega às 6h–7h | Mantém o comércio; fluxo melhora; custo de fiscalização |
| B. Rack de entrega na Zona Leste | Libera a rua; Osvaldo perde clientes no curto prazo |
| C. Não decidir | Nada muda; satisfação de ambos cai |

### Dia 9 — Elemento da travessia
> *Os skatistas querem trocar a Rampa-Ponte por um Salto Mortal (mais pontos de gap). A Associação de Cadeirantes quer um segundo Elevador de Bolha com a mesma verba.*

| Opção | Efeito |
|---|---|
| A. Salto Mortal | Radicalidade sobe; acessibilidade cai sem outra rota |
| B. 2º Elevador de Bolha | Acessibilidade sobe; radicalidade estagna |
| C. Manter e economizar | Saldo sobe; ninguém fica feliz |

O resultado influencia o **ponto de partida do cenário 2** (Centro Gel).

---

## 7. Curva de dificuldade

| Dia | Pressão |
|---|---|
| 1–3 | Baixa — o jogador aprende, nenhum evento |
| 4–6 | Média — população cresce 10%, quedas aparecem |
| 7 | **Alta** — campeonato |
| 8–10 | Média — consequências, dilema do dia 9 |
| 11 | Dilema das entregas |
| 12–14 | Média — ajustes finais, meta se aproxima |

---

## 8. Desbloqueios e recompensas

| Condição | Desbloqueia |
|---|---|
| Cumprir a meta principal | Cenário 02 — Centro Gel |
| Sobreviver ao campeonato sem multidão parada | Linha de tuk-tuk |
| 3 estrelas | Carta de política "Hora silenciosa" |
| Reduzir quedas em 30% | Quarter-pipe de esquina (usado no cenário 2) |

---

## 9. Texto de tutorial (rascunho)

1. "Bem-vindo(a) a Vila Nova. Toda manhã a Rua do Mercado vira um estacionamento de skates, patinetes e gente a pé."
2. "Abra o raio-x. As partes vermelhas são onde as faixas travam."
3. "Redistribua a largura da rua. Observe o que acontece em 1 dia."
4. "Mais rápido nem sempre é melhor: veja o ícone de quedas."
5. "Dona Rita não consegue atravessar o canal. Toda travessia precisa de uma rota acessível."
6. "Um campeonato se aproxima. Prepare a cidade."

---

## 10. Checklist de playtest

- [ ] O jogador entende o raio-x sem ajuda?
- [ ] O primeiro efeito de uma ferramenta aparece em < 10 segundos?
- [ ] O jogador percebe que a Rampa-Ponte exclui a Dona Rita?
- [ ] O campeonato gera tensão sem parecer injusto?
- [ ] Os dois dilemas têm opções que fazem sentido?
- [ ] O cenário termina em ~15 min?
- [ ] 3 estrelas são possíveis, mas exigem decisões diferentes de 1 estrela?
- [ ] Quanto tempo o jogador gasta lendo textos?

## 11. Dados necessários (para Engenharia e Arte)

- `assets/cities/vila-nova.json` com vias e faixas, 1 canal, travessias (`ramp_bridge` com `access: bubble_lift`), prédios, bairros e `ownership` por veículo.
- Modelos: casa, mercado, escola, bowl, Rampa-Ponte, Elevador de Bolha, tuk-tuk, parada, pedestre, cadeira, skate, patinete (ver `data/arte/`).
- Eventos: `campeonato_bowl`, notícia de rádio, balões de fala dos três personagens.
