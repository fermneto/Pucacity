# Cenário 01 — Vila Nova (tutorial)

**Problema principal:** P1 Congestionamento de fluxo (ver [problemas.md](problemas.md)).
**Duração-alvo:** ~15 minutos reais · **14 dias** de jogo.
**Objetivo de design:** ensinar o ciclo *diagnosticar → intervir → ver o efeito → ajustar* e apresentar a primeira surpresa (festival). O jogador deve terminar entendendo que **toda solução tem um custo**.

> Valores numéricos são provisórios e vivem em [`config/balance.json`](../../config/balance.json).

---

## 1. Situação inicial

Vila Nova é uma cidade pequena (~32×32 tiles, ~1.200 moradores) onde todo mundo vai ao Centro ao mesmo tempo. A Rua do Mercado é o único eixo entre o bairro residencial, a escola e o comércio, e vira um engarrafamento de overboards às 8h e às 18h.

| Bairro | Papel | Detalhe |
|---|---|---|
| Residencial Norte | Moradia | 60% da população; viagens longas ao Centro |
| Centro / Mercado | Comércio | Destino de trabalho e compras; gargalo |
| Escola Municipal | Serviço | Fluxo de crianças com pais no horário de entrada |
| Praça da Fonte | Lazer | Palco do festival (dia 7) |
| Zona Leste | Casas e pequenas oficinas | Menos movimento; rota alternativa potencial |

### Personagens com nome
- **Dona Rita** (68 anos, moradora do Norte): ouve o jogador toda manhã, reclama do tempo de viagem e das quedas.
- **Seu Osvaldo** (comerciante do Mercado): teme perder vendas se a rua mudar.
- **Bia** (13 anos, estudante): usa overboard rápido, testa limites de velocidade.

---

## 2. Ferramentas disponíveis

| Ferramenta | Disponível desde | Observação |
|---|---|---|
| Sentido da via (mão única/dupla) | Início | Primeira ferramenta ensinada |
| Pista de velocidade (lenta/normal/expressa) | Início | Aumenta fluxo, mas pode causar quedas |
| Rotatória magnética | Após meta 1 | Libera o cruzamento principal |
| Limite de velocidade | Início | Ensina o trade-off tempo × segurança |
| Plataforma coletiva (1 linha) | Bloqueada → libera após festival | Recompensa de progressão |

**Raio-x (overlays):** fluxo/ocupação, quedas, tempo de viagem.

---

## 3. Metas

| Tipo | Meta | Medida |
|---|---|---|
| **Principal** | Reduzir o tempo médio de viagem em **20%** | Média do dia 14 vs. dia 1 |
| **Equilíbrio 1** | Não aumentar as quedas por 1.000 viagens | Dia 14 ≤ dia 1 |
| **Equilíbrio 2** | Terminar com saldo ≥ 0 | Orçamento inicial: 5.000 |

**Estrelas**
- ⭐ Meta principal cumprida.
- ⭐⭐ Principal + equilíbrio 1 e 2.
- ⭐⭐⭐ Tudo isso + satisfação do Seu Osvaldo ≥ 60% (o comércio não saiu perdendo).

---

## 4. Roteiro de jogo (~15 min)

| Tempo | O que acontece | Aprendizado |
|---|---|---|
| 0:00–1:30 | Cena de abertura: Dona Rita reclama; o raio-x mostra a Rua do Mercado em vermelho | Diagnosticar com overlays |
| 1:30–4:00 | **Tutorial guiado:** mudar a Rua do Mercado para mão única e ver o efeito | Ferramenta + feedback |
| 4:00–7:00 | Jogador livre; resolve gargalos secundários; Bia causa quedas na pista expressa | Velocidade × segurança |
| 7:00–9:00 | **Dia 7 — Festival na Praça:** 1.500 pessoas chegam em 20 minutos de jogo | Surpresa e tensão |
| 9:00–12:00 | Jogador redistribui fluxo; libera a plataforma coletiva como recompensa | Progressão |
| 12:00–14:00 | Dia 11: **dilema** (ver §6); depois ajustes finais | Escolha com custo |
| 14:00–15:00 | Balanço: KPIs, comentários dos moradores, estrelas, desbloqueios | Fechamento |

---

## 5. Evento principal — Festival da Praça

- **Quando:** dia 7, 17h–22h (aviso 24h antes pelo rádio).
- **Efeito:** +1.500 viagens ao centro; a Praça da Fonte vira ponto de saturação.
- **Soluções esperadas:** desviar fluxo pela Zona Leste, transformar a Praça em zona de pedestres, limitar velocidade, usar a plataforma coletiva.
- **Falha:** se a ocupação da Rua do Mercado passar de 150% por mais de 30 min, "multidão parada" — satisfação −10 e três quedas.
- **Pressão de tempo:** contador regressivo até o início do festival.

## 6. Dilema do dia 11

> *Seu Osvaldo pede para manter a entrega de mercadorias na Rua do Mercado pela manhã, mas isso volta a travar o fluxo. Dona Rita pede a rua livre.*

| Opção | Efeito |
|---|---|
| A. Janela de entrega às 6h–7h | Mantém o comércio; fluxo melhora; custo de fiscalização |
| B. Docas na Zona Leste | Libera a rua; Osvaldo perde clientes no curto prazo |
| C. Não decidir | Nada muda; satisfação de ambos cai |

O resultado influencia o **ponto de partida do cenário 2** (Centro Antigo).

---

## 7. Curva de dificuldade

| Dia | Pressão |
|---|---|
| 1–3 | Baixa — o jogador aprende, nenhum evento |
| 4–6 | Média — população cresce 10%, quedas aparecem |
| 7 | **Alta** — festival |
| 8–10 | Média — consequências do festival |
| 11 | Dilema |
| 12–14 | Média — ajustes finais, meta se aproxima |

---

## 8. Desbloqueios e recompensas

| Condição | Desbloqueia |
|---|---|
| Cumprir a meta principal | Cenário 02 — Centro Antigo |
| Sobreviver ao festival sem multidão parada | Plataforma coletiva |
| 3 estrelas | Cartas de política: "Hora silenciosa" |
| Reduzir quedas em 30% | Sensor de colisão (usado no cenário 5) |

---

## 9. Texto de tutorial (rascunho)

1. "Bem-vindo(a) a Vila Nova. Toda manhã a Rua do Mercado vira um estacionamento de overboards."
2. "Abra o raio-x. As partes vermelhas são onde o fluxo trava."
3. "Mude o sentido da Rua do Mercado. Observe o que acontece em 1 dia."
4. "Mais rápido nem sempre é melhor: veja o ícone de quedas."
5. "Um festival se aproxima. Prepare a cidade."

---

## 10. Checklist de playtest

- [ ] O jogador entende o raio-x sem ajuda?
- [ ] O primeiro efeito de uma ferramenta aparece em < 10 segundos?
- [ ] O festival gera tensão sem parecer injusto?
- [ ] O dilema tem opções que fazem sentido para o jogador?
- [ ] O cenário termina em ~15 min?
- [ ] 3 estrelas são possíveis, mas exigem decisões diferentes de 1 estrela?
- [ ] Quanto tempo o jogador gasta lendo textos?

## 11. Dados necessários (para Engenharia e Arte)

- `assets/cities/vila-nova.json` com ruas, bairros, prédios e população.
- Modelos: casa, mercado, escola, praça com fonte, estação de carga, overboard (3 modelos), pedestre.
- Eventos: festival (`festival_praca`), notícia de rádio, balão de fala dos três personagens.
