# Tutorial — Vila Nova (roteiro comentado)

Textos finais em [`src/assets/text/vila-nova.json`](../../src/assets/text/vila-nova.json) (chave `tutorial`). Duração-alvo: 1:30–4:00 do cenário. Princípio: **uma ideia por passo**, balão curto, o jogo só avança quando o jogador faz a ação.

| # | Id | Texto | Gatilho (avança quando...) | Ensina |
|---|---|---|---|---|
| 1 | `boas_vindas` | "Bem-vindo(a) a Vila Nova! Toda manhã a Rua do Mercado vira um engarrafamento de rodinhas." | `scenarioStart` | Contexto e problema. Dona Rita fala. |
| 2 | `raiox` | "Abra o raio-x. O vermelho mostra onde as faixas travam." | `overlayOpened` (overlay `traffic`) | Diagnosticar com overlays. |
| 3 | `redistribuir` | "Redistribua a largura da Rua do Mercado entre calçada, lenta e rápida." | `toolUsed` (ferramenta `divisaoFaixas`) | Primeira intervenção e feedback imediato. |
| 4 | `efeito_e_travessia` | "Veja o efeito em 1 dia. Mais rápido nem sempre é melhor: olhe as quedas. E o canal precisa de rota acessível!" | `dayAdvanced` (1 dia) | Ver o efeito, custo da velocidade e regra da rota acessível. |

Fecho (`closing`): "Um campeonato vem aí. Prepare a cidade!" (prepara o evento do dia 7).

## Notas de design
- O rascunho de 6 frases do cenário foi condensado em 4 passos: o passo 4 junta "ver o efeito", "quedas" e "rota acessível", que podem aparecer como balões em sequência dentro do mesmo passo se o playtest mostrar que fica denso.
- Gatilhos são descritivos (`type` + parâmetros). A Engenharia define o conjunto real de tipos; os usados aqui: `scenarioStart`, `overlayOpened`, `toolUsed`, `dayAdvanced`.
- Tom: otimista e leve. Nada de jargão técnico (usar "raio-x", "faixa", "rodinha").
- Checklist de playtest relacionado: o raio-x é entendido sem ajuda? O primeiro efeito aparece em menos de 10 s?
