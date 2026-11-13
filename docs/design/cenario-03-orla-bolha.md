# Cenário 03 — Orla Bolha

**Problema principal:** P7 Clima e infraestrutura frágil · **secundário:** P6 Acessibilidade (ver [problemas.md](problemas.md)).
**Duração-alvo:** ~15 minutos reais · **14 dias** de jogo.
**Objetivo de design:** ensinar que a infraestrutura é frágil e que **redundância custa caro até a crise chegar**. Família de soluções nova: **cobertura de vidro, drenagem, rotas alternativas, Salto Mortal e Rail-Passarela**, com plano de contingência. Mantém tudo dos cenários anteriores.

> Valores numéricos são provisórios e vivem em [`config/balance.json`](../../config/balance.json). Usa clima e dia/noite da v0.2 do [`SPEC.md`](../../SPEC.md).

---

## 1. Situação inicial

A Orla Bolha é uma faixa de canais ligando praias de gel e bairros de palafitas aero: ~64×64 tiles, ~1.800 moradores. Vários canais cortam a cidade e quase todas as travessias são **elementos radicais**: um **Salto Mortal** sobre o canal largo, uma **Rail-Passarela** entre dois prédios e três **Rampa-Pontes**. Em dia seco funciona. Com chuva, as pistas escorregam, o canal sobe e o vento fecha o que é elevado. O ponto fraco: quase não há rota alternativa.

| Bairro | Papel | Detalhe |
|---|---|---|
| Cais das Bolhas | Comércio e turismo | Fluxo de visitantes; rota longa ao resto |
| Palafitas Aero | Moradia | Ilhas ligadas por Rampa-Pontes; alagam primeiro |
| Hospital do Mar | Serviço | Único hospital; só uma travessia direta |
| Praia de Gel | Lazer | Lotada no dia 8; muito skatista |
| Canal Largo | Corte | Largura de 40 m; travessia pelo Salto Mortal |

### Personagens
**Recorrentes:**
- **Dona Rita** (cadeira motorizada): depende do Elevador de Bolha; comenta filas e quedas de energia.
- **Bia** (skate): quer o Salto Mortal aberto sempre.
- **Tuco** (BMX): testa as rotas com a pista molhada.

**Novos:**
- **Capitã Marina** (guarda-vidas, patins): coordena socorro e pede rotas alternativas.
- **Seu Zé das Palafitas** (pescador): mora na ilha mais baixa; teme perder a casa.

---

## 2. Ferramentas

| Ferramenta | Disponível desde | Observação |
|---|---|---|
| Sentido, divisão de faixas, limite, semáforo, travessia, linha de tuk-tuk | Início | Herdadas |
| Zona de pedestre, docas, Funil Bowl | Início | Cenário 2 |
| **Drenagem** (valeta/bueiro de gel) | Início — **nova** | Reduz o alagamento de uma via |
| **Cobertura de vidro** | Início — **nova** | Evita pista escorregadia; cara |
| **Salto Mortal** (elemento de travessia) | Início — **novo** | Só para quem faz manobras; precisa de rota acessível |
| **Rail-Passarela** (elemento de travessia) | Dia 3 — **nova** | Com `passarela_vidro` como rota acessível |
| **Plano de contingência** (desvio e ponto de encontro) | Dia 4, após o primeiro alerta — **novo** | Ativa rota alternativa quando um elemento fecha |

**Raio-x (overlays):** risco de alagamento por via, risco de queda por piso (seco/molhado), rotas alternativas (redundância), acessibilidade.

---

## 3. Metas

| Tipo | Meta | Medida |
|---|---|---|
| **Principal** | Restabelecer a mobilidade em ≤ **60 min** depois da chuva forte | Tempo até as viagens voltarem a 90% do normal |
| **Equilíbrio 1** | **95% de acessibilidade** durante e depois do evento (inclui o Hospital) | Dia 14 e pico do evento |
| **Equilíbrio 2** | Quedas por 1.000 viagens ≤ dia 1 e saldo ≥ 0; orçamento inicial 7.000 | Dia 14 |

**Estrelas**
- ⭐ Meta principal.
- ⭐⭐ Principal + equilíbrios 1 e 2.
- ⭐⭐⭐ Tudo isso + Seu Zé e Dona Rita ≥ 60% satisfeitos e **nenhuma travessia sem rota alternativa**.

---

## 4. Roteiro de jogo (~15 min)

| Tempo | O que acontece | Aprendizado |
|---|---|---|
| 0:00–1:30 | Abertura: Seu Zé mostra a água alta; o raio-x mostra alagamento e quedas na pista molhada | Diagnosticar o clima |
| 1:30–4:00 | **Mini-tutorial:** instalar drenagem em uma via e ver o alagamento cair | Drenagem como solução |
| 4:00–7:00 | Jogador livre; primeira chuva fraca no dia 4: pista escorregadia | Cobertura × drenagem |
| 7:00–9:00 | Dia 6: o vento fecha o Salto Mortal por 1 dia; sem rota, Dona Rita fica ilhada; dilema | Redundância |
| 9:00–12:00 | **Dia 8 — Tempestade na Praia de Gel** (§5) | Evento principal |
| 12:00–14:00 | Dia 11: **dilema** (§6); reconstrução | Escolha com custo |
| 14:00–15:00 | Balanço de resiliência: KPIs, estrelas, desbloqueios | Fechamento |

---

## 5. Evento principal — Tempestade na Praia de Gel

- **Quando:** dia 8, 15h–20h (aviso de 12h pelo rádio; alerta antecipado no dia 6).
- **Efeito:** chuva forte; o risco de queda nas faixas rápidas **dobra**; o canal sobe e alaga as vias baixas das Palafitas; o vento fecha o Salto Mortal e a Rail-Passarela. A Praia de Gel está lotada.
- **Pressão de tempo:** **a água sobe em 3 min de jogo** por nível de alagamento; uma barra mostra o tempo até a via ficar intransitável.
- **Soluções esperadas:** drenagem prévia, cobertura de vidro nas vias de maior fluxo, plano de contingência, rota alternativa pelo Cais, tuk-tuk de resgate, rede de segurança nos saltos, Elevador de Bolha com energia reserva.
- **Falha:** se o Hospital ficar sem rota acessível por mais de 20 min, "emergência": satisfação −15 e o tempo de restabelecimento aumenta.

## 6. Dilemas

### Dia 6 — Cobertura ou rota?
> *Bia quer cobertura de vidro na pista rápida (menos quedas). Capitã Marina prefere uma rota alternativa para o Hospital.*

| Opção | Efeito |
|---|---|
| A. Cobertura na pista rápida | Quedas caem na chuva; Hospital continua vulnerável |
| B. Rota alternativa para o Hospital | Acessibilidade protegida; quedas altas na chuva |
| C. Esperar | Verba guardada; risco no dia 8 |

### Dia 11 — Reconstruir ou realocar
> *O canal levou duas Rampa-Pontes. Seu Zé quer reconstruir as mesmas. Capitã Marina propõe um Salto Mortal mais alto e rota acessível redundante. A prefeitura tem verba para uma opção.*

| Opção | Efeito |
|---|---|
| A. Rampa-Pontes de novo | Barato; continua frágil; risco no próximo evento |
| B. Salto Mortal + 2º Elevador de Bolha | Radicalidade e redundância sobem; custo alto |
| C. Rail-Passarela com passarela de vidro | Equilíbrio; leva tempo; fecha com vento |

O resultado influencia o ponto de partida do **cenário 4 (Morro Alto)**: a redundância define quantas travessias já nascem com rota alternativa.

---

## 7. Curva de dificuldade

| Dia | Pressão |
|---|---|
| 1–3 | Baixa — aprender drenagem |
| 4 | Média — primeira chuva |
| 6 | Média — vento fecha o Salto Mortal; dilema |
| 7 | Baixa — preparação |
| 8 | **Alta** — tempestade |
| 9–10 | Média — recuperação |
| 11 | Dilema de reconstrução |
| 12–14 | Média — ajustes e meta próxima |

---

## 8. Desbloqueios e recompensas

| Condição | Desbloqueia |
|---|---|
| Cumprir a meta principal | Cenário 04 — Morro Alto |
| Hospital sempre com rota durante o evento | Carta "Plano de contingência" permanente |
| 3 estrelas | Carta de política "Verão sem pânico" (drenagem com desconto) |
| Reduzir quedas na chuva em 30% | **Torre Espiral** (usada no cenário 4) |

---

## 9. Texto de tutorial (rascunho)

1. "A orla é linda, mas o canal sobe. Abra o raio-x de alagamento."
2. "Drenagem custa pouco. Cobertura de vidro custa muito. Escolha onde."
3. "O vento fecha tudo que é alto. Toda travessia precisa de uma alternativa."
4. "Uma tempestade vem aí. Prepare a orla."

---

## 10. Checklist de playtest

- [ ] A chuva do dia 4 ensina sem punir demais?
- [ ] O jogador percebe que Salto Mortal sem rota acessível trava a meta?
- [ ] O contador de 3 min de alagamento gera tensão sem parecer injusto?
- [ ] 3 estrelas exigem decisões diferentes de 1 estrela?
- [ ] A redundância parece desperdício antes do dia 8 e valer a pena depois?
- [ ] O cenário termina em ~15 min?

## 11. Dados necessários (para Engenharia e Arte)

**Engenharia**
- `assets/cities/orla-bolha.json`: canais múltiplos, travessias (`salto_mortal` com `elevador_bolha`; `rail_passarela` com `passarela_vidro`; `rampa_ponte` com `elevador_bolha`), prédios (hospital, praia), bairros, `ownership`.
- Conceitos novos a modelar (não existem hoje em `data/arte/`): clima (chuva e vento), alagamento por via, drenagem, cobertura de vidro, plano de contingência, KPI `tempo_de_restabelecimento`.
- Eventos: `tempestade_praia`, `vento_fecha_elemento`, notícia de rádio, balões de fala.
- Atenção: `passarela_vidro` aparece como `rota_acessivel` em `data/arte/elementos-radicais.json`, mas não tem entrada própria na lista de elementos; criar o modelo antes do cenário.

**Arte** (ids reais de `data/arte/`)
- Elementos radicais: `salto_mortal`, `rail_passarela`, `rampa_ponte`, `elevador_bolha`, `wallride_tubular`, `funil_bowl`, `quarter_esquina`.
- Veículos: `pedestre`, `skate`, `bmx`, `patinete`, `patins`, `cadeira_motorizada`, `cadeira_rodas`, `hoverboard`, `tuktuk`.
- Modelos novos: passarela de vidro, cobertura de vidro, bueiro/valeta, palafitas aero, barreira de contenção, sinal de alerta de chuva.
