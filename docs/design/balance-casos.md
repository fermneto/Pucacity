# Casos de equilíbrio (entrada → saída) — v0.3

Casos esperados para o PC3 transformar em testes. Todos os números vêm de [`config/balance.json`](../../config/balance.json) (v0.3.0) e de [`data/arte/veiculos.json`](../../data/arte/veiculos.json). Cada resultado foi calculado à mão e conferido por script Node descartável que lê os dois JSONs. Se o balance mudar, os casos mudam junto.

## Convenções

- **Velocidade de cruzeiro** = média do intervalo de `veiculos.json` (igual a `Vehicles.ts`): pedestre 1,4; skate 5,5; patinete 4,0; tuk-tuk 7,5 m/s.
- **BPR:** `t = t0 · (1 + α · (fluxo/capacidade)^β)`, com α e β de `congestion.byLane[faixa]`.
- **Capacidade da faixa** = largura (m) × `lanes.<faixa>.capacityPerWidth` (usuários/h, por sentido).
- **Desutilidade modal:** `D = tempo·wt + custo·costToMin·wc + risco·riskScale·wr + (1−conforto)·comfortScale·wf − baseFun·funScale·wd`. Menor D vence. Sem elementos radicais na rota (diversão só a base do veículo).
  - Pesos: wt 1,0; wc 0,6; wr 0,8; wf 0,5; wd 0,4. Escalas: costToMin 3; riskScale 250; comfortScale 10; funScale 5.
  - Tempo do coletivo = espera (headway 10 min / 2 = 5 min) + distância/velocidade.
- **Risco de queda da viagem** = `fallRisk · fallRiskMultiplier(faixa usada) · (faixa não preferida ? 3,0 : 1) · km · fallPenalty do grupo`. Na faixa não preferida a velocidade também é × 0,6 (`_sharedLanePenalty`).
- Ruído: `D_final = D · (1 + N(0; 0,15))`. Casos sem ruído usam ruído 0.
- Tolerância padrão dos testes: ±0,01 (±1% em probabilidades e tempos).

## Casos

| # | Caso | Fórmula | Entradas | Saída esperada |
|---|---|---|---|---|
| 1 | BPR, faixa rápida, fluxo/cap. 0,5 | BPR (α 0,20; β 4) | skate, 200 m, t0 = 200/5,5 = 36,364 s; razão 0,5 | fator 1 + 0,2·0,0625 = 1,0125; **t = 36,82 s** |
| 2 | BPR, faixa rápida, razão 1,0 | idem | mesmo trecho; razão 1,0 | fator 1,20; **t = 43,64 s** |
| 3 | BPR, faixa rápida, razão 1,5 | idem | mesmo trecho; razão 1,5 | fator 1 + 0,2·5,0625 = 2,0125; **t = 73,18 s** |
| 4 | BPR, calçada (curva mais suave) | BPR (α 0,10; β 3) | pedestre, 100 m, t0 = 100/1,4 = 71,43 s; razão 1,2 | fator 1 + 0,1·1,728 = 1,1728; **t = 83,77 s** |
| 5 | Capacidade pela largura, faixa rápida de 3 m | cap = largura · 55; razão = fluxo/cap | fluxo 190 usuários/h; largura 3 m; trecho de 200 m | cap **165**; razão **1,1515** (saturada, ≥ 1,0); fator 1 + 0,2·1,7581 = 1,3516; **t = 49,15 s** |
| 6 | Mesma rua após redistribuir para 4 m | idem | fluxo 190; largura 4 m | cap **220**; razão **0,8636** (livre); fator 1,1112; **t = 40,41 s** (−17,8% vs. caso 5) |
| 7 | Escolha modal, 600 m, adulto, sem ruído | D (ver convenções) | rua com faixas própria para todos; sem fila no tuk-tuk além do headway | D: patinete **4,788**; skate **5,254**; pedestre **9,155**; tuk-tuk **10,707**. Vence **patinete** |
| 8 | Decomposição de D do skate (600 m) | termos | tempo 1,818 min; risco 0,00768 → 1,536; conforto 2,5; diversão −0,6 | **D = 5,254** (1,818 + 1,536 + 2,5 − 0,6) |
| 9 | Escolha modal com ruído 0,15: skate vs. patinete | P(patinete vence) = Φ((D_s − D_p)/√((0,15·D_s)² + (0,15·D_p)²)) | D_s 5,254; D_p 4,788 | P ≈ **0,669** (teste Monte Carlo, ≥ 20.000 sorteios, semente fixa, ±0,02) |
| 10 | Escolha modal, 3 km, adulto | D | mesmas faixas; 3.000 m | D: patinete **15,940**; tuk-tuk **16,137**; skate **18,671**; pedestre **37,774**. Vence patinete por pouco (0,2) |
| 11 | Escolha modal, 3 km, idoso | D com speedFactor 0,7 só nos veículos próprios e fallPenalty 2,0 | 3.000 m | D: tuk-tuk **16,257**; patinete **22,737**; pedestre **53,140**. Vence **tuk-tuk** (o coletivo ganha de quem tem fragilidade) |
| 12 | Risco de queda, skate em faixa própria vs. compartilhada | fallRisk · mult. da faixa · (3 se não preferida) · km | skate (0,008), 600 m | faixa rápida (própria): 0,008·1,6·0,6 = **0,00768**; faixa lenta (fallback): 0,008·0,6·3·0,6 = **0,00864** (+12,5%) e tempo × 1/0,6: 1,818 → **3,030 min**; D = **6,658** (vs. 5,254) |
| 13 | Risco de queda do idoso | idem × fallPenalty 2,0 | patinete (0,004) na faixa lenta, 3 km, idoso | 0,004·0,6·3·2,0 = **0,0144** (o dobro do adulto: 0,0072) |
| 14 | Paciência: dias ruins até o protesto | p = 70 − n · 6 · patienceFactor; protesto se p ≤ 20 | adulto (6,0/dia): n = 9 → p = 16; idoso (7,5/dia): n = 7 → 17,5; estudante (4,8/dia): n = 11 → 17,2; entregador e cadeirante (9,0/dia): n = 6 → 16 | Em n−1 dias, p fica > 20 (adulto 22; idoso 25; estudante 22; entregador/cadeirante 25); protesto exatamente no dia n |
| 15 | Paciência: recuperação | p += 3 por dia bom | adulto com p = 40 após 5 dias ruins; 3 dias bons seguidos | 70 − 30 = 40 → **49** |
| 16 | Dia ruim | tempo médio do grupo > 1,3 × linha de base | linha de base 10 min; médias 12,9 e 13,1 min | 12,9 → bom; 13,1 → **ruim** |
| 17 | Custo de um plano de obras do cenário 1 | soma de `tools.*.cost` | 4× divisaoFaixas (120), 4× limiteVelocidade (50), 1 semáforo (300), 2 travessiaPedestre (400), 1 elevadorBolha extra (900), 1 rackSkate (150) | 480 + 200 + 300 + 800 + 900 + 150 = **2.830** (restam 2.170 de 5.000); prazo da obra mais longa: travessiaPedestre 2 dias, elevador 3 dias → **3 dias** |
| 18 | Saldo final de um plano completo (tuk-tuk liberado no dia 8) | orçamento + renda − obras − operação | 5.000 + (1.200 moradores · 1,5 / 30 · 14 = 840) − 2.830 − 1.500 − (7 dias · 120 = 840) | **670** ≥ 0 (sem contar tarifas: margem de erro pequena, cenário vencível, não trivial) |
| 19 | Linha de tuk-tuk: ponto de equilíbrio | passageiros/dia · tarifa 2 = operação 120 | capacidade 3 lugares, headway 10 min → 18 passageiros/h por sentido | equilíbrio em **60 passageiros/dia**; com 30 → −60/dia; com 90 → +60/dia |
| 20 | Fila do Elevador de Bolha (acessibilidade) | espera = fila / capacityPerMinute + 40 s de travessia | capacityPerMinute 3; fila de 105 pessoas (pico da manhã, só 1 elevador) | 35 min + 0,67 = **35,67 min** (a "35 min" do cenário). Com 2 elevadores (6/min): 17,5 + 0,67 = **18,17 min** |
| 21 | Estados de ocupação da faixa | livre < 1,0 ≤ saturada < 1,5 ≤ travada (`congestion.*Threshold`) | razões 0,95; 1,0; 1,49; 1,5 | livre; saturada; saturada; **travada** |
| 22 | Campeonato, risco de "multidão parada" | razão = (base + extra)/cap; falha se ≥ 1,5 por 30 min | faixa rápida, base 190 vph; 1.500 viagens extras, 40% na faixa rápida = 600; chegada espalhada em 5 h (120 vph) | cap 4 m (220): 310/220 = **1,41** → saturada, sem falha; cap 3 m (165): 310/165 = **1,88** → **falha**. Se a chegada for concentrada em 2 h (300 vph): 490/220 = **2,23** → falha mesmo com 4 m |

Os casos 1–6 usam fluxo em usuários/h e capacidade em usuários/h, sem conversão de unidade.

## Observações para o PC3

- Os casos 7–11 não dependem de rota; testar a função de desutilidade isolada com os perfis lidos de `veiculos.json`.
- O caso 9 é estatístico: fixar a semente do `Rng` e aceitar ±0,02.
- O caso 12 mostra a intenção do design: usar a faixa errada é mais lento (× 0,6) e mais arriscado (+12,5% aqui, bem mais se a faixa própria fosse a calçada). Evitar que o jogador "esconda" o tráfego rápido na calçada.
- Os casos 17–19 e 22 definem a "vencibilidade" do cenário 1. Se um teste de integração do cenário falhar, ajustar primeiro o balance, não o teste.
- Pendências de design: o roteiro do cenário diz "1.500 pessoas em 20 min" mas `events.campeonato_bowl` usa 17h–22h; o caso 22 mostra que isso muda tudo (o design deve escolher).
