# Especificação dos questionários estruturados em escala

- **Projeto** — TCC sobre prevenção de abastecimento incompatível
- **Versão** — 1.0
- **Data** — 13 de agosto de 2026
- **Estado** — desenho aprovado pelo pesquisador. A geração dos documentos de aplicação está pendente.

## 1. Finalidade

Produzir dois instrumentos específicos para aplicação antes da demonstração do
protótipo:

1. entrevista estruturada para frentistas;
2. entrevista estruturada para um representante da direção/CEO.

Os instrumentos medirão percepções sobre o processo atual, o risco de seleção
incompatível e a utilidade esperada da solução. Eles não medirão usabilidade
observada, eficácia real, redução de incidentes ou economia realizada.

## 2. Decisões aprovadas

- aplicação somente antes da demonstração;
- entrevista individual e reservada;
- ausência de gestores durante as entrevistas com frentistas;
- leitura literal das afirmações pelo pesquisador;
- instrumento fechado, sem justificativas e sem perguntas abertas;
- questionários específicos para cada função;
- escala de concordância com cinco pontos;
- `N/A` e `PNR` fora da pontuação;
- análise descritiva e sem criação de um índice geral de aceitação.

## 3. Escala de respostas

| Código | Resposta | Tratamento |
|---:|---|---|
| 1 | Discordo totalmente | Resposta válida |
| 2 | Discordo | Resposta válida |
| 3 | Nem discordo nem concordo | Resposta válida |
| 4 | Concordo | Resposta válida |
| 5 | Concordo totalmente | Resposta válida |
| N/A | Não sei ou não se aplica | Ausente da análise numérica |
| PNR | Prefiro não responder | Ausente da análise numérica |

O pesquisador deverá mostrar a escala impressa ao participante e repetir seus
rótulos sempre que solicitado. `N/A` e `PNR` não receberão valor zero.

## 4. Texto padronizado de apresentação da proposta

Antes das afirmações sobre a solução, o pesquisador lerá:

> A proposta estudada consultaria a placa do veículo e permitiria selecionar
> um combustível identificado como compatível. Em seguida, liberaria por tempo
> limitado somente o respectivo bico para retirada do suporte. O sistema não
> controlaria o bombeamento, não substituiria a conferência humana e poderia
> ficar indisponível. Neste momento, trata-se de uma proposta em desenvolvimento,
> e não de uma solução cuja eficácia já tenha sido comprovada.

O texto será idêntico para todos os participantes e não poderá ser complementado
com promessas de redução de erros, economia ou segurança.

## 5. Instrumento para frentistas

### 5.1 Bloco A — Processo atual e percepção de risco

| Código | Afirmação |
|---|---|
| F01 | Antes de retirar um bico, consigo confirmar com clareza qual combustível o cliente solicitou. |
| F02 | Em períodos de maior movimento, torna-se mais difícil conferir o combustível antes de retirar o bico. |
| F03 | Os procedimentos atuais são suficientes para evitar a retirada de um bico incompatível. |
| F04 | Sei como agir quando existe dúvida sobre o combustível compatível com o veículo. |
| F05 | Mesmo quando o frentista está atento, ainda existe a possibilidade de selecionar um bico incompatível. |

### 5.2 Bloco B — Proteção e utilidade esperadas

| Código | Afirmação |
|---|---|
| F06 | Consultar a placa antes da retirada do bico poderia reduzir a possibilidade de selecionar combustível incompatível. |
| F07 | Eu me sentiria mais protegido contra erros involuntários se somente o suporte do bico autorizado fosse liberado. |
| F08 | A barreira física seria útil também para frentistas experientes. |
| F09 | Mesmo com essa tecnologia, a conferência do pedido pelo frentista continuaria necessária. |
| F10 | Não liberar automaticamente nenhum bico quando a consulta falhar seria uma medida segura. |

### 5.3 Bloco C — Adequação à rotina

| Código | Afirmação |
|---|---|
| F11 | Informar a placa antes de retirar o bico seria uma etapa fácil de incorporar à rotina. |
| F12 | Essa etapa adicional tornaria o atendimento lento demais. |
| F13 | Eu utilizaria o sistema em todos os abastecimentos, caso a empresa o adotasse. |
| F14 | Uma liberação excepcional deveria depender de um supervisor e ficar registrada. |
| F15 | Eu precisaria de treinamento prático antes de utilizar o sistema. |
| F16 | Em períodos de fila, poderia existir pressão para contornar essa etapa do atendimento. |

## 6. Instrumento para direção/CEO

### 6.1 Bloco A — Relevância do problema e controles atuais

| Código | Afirmação |
|---|---|
| D01 | A seleção de combustível incompatível representa um risco operacional relevante para a empresa. |
| D02 | As consequências desse tipo de ocorrência justificam o estudo de novas medidas preventivas. |
| D03 | Os procedimentos atuais são suficientes para evitar ocorrências de abastecimento incompatível. |
| D04 | Os registros atuais permitem dimensionar com segurança a frequência dessas ocorrências. |
| D05 | Os registros atuais permitem identificar os custos diretos provocados por essas ocorrências. |

### 6.2 Bloco B — Adequação operacional esperada

| Código | Afirmação |
|---|---|
| D06 | Consultar a placa antes da retirada do bico seria compatível com o processo de atendimento da empresa. |
| D07 | Impedir fisicamente a retirada dos demais bicos poderia acrescentar uma barreira de segurança ao processo. |
| D08 | A etapa adicional de consulta prejudicaria excessivamente o tempo de atendimento. |
| D09 | Bloquear todos os bicos quando a consulta estiver inválida, ambígua ou indisponível seria uma conduta adequada. |
| D10 | O intertravamento físico independente, sem alterar o sistema de bombeamento da empresa, é coerente com o escopo esperado. |
| D11 | A empresa teria condições de oferecer treinamento e acompanhamento para a adoção da solução. |

### 6.3 Bloco C — Governança, segurança e privacidade

| Código | Afirmação |
|---|---|
| D12 | Uma liberação excepcional deveria exigir autenticação de um supervisor e registro da justificativa. |
| D13 | O sistema deveria armazenar apenas os dados mínimos necessários para auditoria da decisão. |
| D14 | A dependência de uma consulta veicular externa seria aceitável se existissem procedimentos definidos para indisponibilidade. |
| D15 | A implantação dependeria da definição formal das responsabilidades da empresa, do provedor veicular e da GCC. |
| D16 | Uma instalação real somente deveria ocorrer após avaliação técnica e de segurança do local. |

### 6.4 Bloco D — Viabilidade e decisão de investimento

| Código | Afirmação |
|---|---|
| D17 | A empresa poderia disponibilizar dados históricos anonimizados para avaliar ocorrências e custos. |
| D18 | A decisão de adoção deveria comparar perdas evitáveis com consulta veicular, GCC, hardware, integração, treinamento, manutenção e suporte. |
| D19 | Um teste controlado de bancada seria uma etapa adequada antes de qualquer projeto-piloto operacional. |
| D20 | A empresa consideraria um projeto-piloto se o protótipo atendesse aos critérios de segurança e apresentasse viabilidade econômica. |

## 7. Protocolo de aplicação

1. Aplicar somente após autorização escrita da empresa, orientação formal
   sobre o enquadramento ético e consentimento do participante.
2. Não coletar nome, matrícula funcional, placa, cliente ou relato identificável.
3. Usar um identificador artificial, como `F01-P01` para frentista e `D-P01`
   para direção, sem registrar a chave de identidade no corpus analítico.
4. Entrevistar frentistas em ambiente reservado, sem gestor ou colega presente.
5. Informar que participar, recusar ou interromper não produzirá consequência
   trabalhista.
6. Ler as afirmações na ordem e com a redação apresentadas.
7. Não explicar o que seria uma resposta desejável e não demonstrar o protótipo.
8. Se houver dúvida, repetir a afirmação e a escala sem sugerir uma resposta.
9. Registrar uma opção por item. O participante pode escolher `PNR`.
10. Guardar o consentimento separado das respostas.

## 8. Plano de análise

### 8.1 Frentistas

- apresentar contagens e percentuais das categorias `1` a `5`, `N/A` e `PNR`;
- calcular mediana e intervalo interquartil por item somente para respostas de
  `1` a `5`;
- não substituir dados ausentes nem atribuir zero a `N/A` ou `PNR`;
- não calcular índice total ou média dos blocos sem estudo posterior de
  validade e confiabilidade;
- interpretar F03, F12 e F16 no sentido próprio do texto: concordância nesses
  itens não representa automaticamente maior aceitação da proposta;
- divulgar resultados apenas de forma agregada e suprimir recortes que possam
  identificar participante, turno ou unidade.

### 8.2 Direção/CEO

- tratar a pessoa como informante-chave;
- apresentar a resposta de cada item de maneira descritiva;
- não calcular média, mediana, percentual ou nota de aceitação para um único
  participante;
- não atribuir a resposta individual a toda a organização sem qualificação;
- interpretar D03 e D08 no sentido próprio do texto, sem recodificação oculta.

## 9. Controle de qualidade

Antes da coleta definitiva, os instrumentos deverão passar por:

1. revisão do orientador;
2. avaliação do enquadramento pelo CEP ou instância indicada;
3. pré-teste cognitivo com pessoas que não integrarão a amostra final, para
   verificar compreensão, duração e ambiguidade;
4. registro da versão efetivamente aplicada;
5. treinamento do pesquisador para leitura padronizada.

Qualquer alteração após o pré-teste deverá gerar nova versão. Respostas de
versões materialmente diferentes não serão combinadas sem justificativa.

## 10. Fundamentação do desenho

Os blocos sobre utilidade esperada, adequação à rotina e intenção de uso foram
inspirados nos construtos de aceitação de tecnologia discutidos por Venkatesh
et al. (2003), sem afirmar que o presente instrumento seja uma aplicação
validada da UTAUT. A dimensão de percepção de segurança considera a distinção
entre clima, conhecimento, motivação e comportamento de segurança discutida por
Neal, Griffin e Hart (2000) e por Griffin e Neal (2000). A escolha de cinco
categorias de concordância é compatível com os resultados metodológicos de
Revilla, Saris e Krosnick (2014). A proteção dos participantes e o processo de
consentimento deverão observar a Resolução CNS nº 510/2016 e a orientação
institucional aplicável.

### Referências essenciais

- GRIFFIN, M. A.; NEAL, A. Perceptions of safety at work: a framework for
  linking safety climate to safety performance, knowledge, and motivation.
  *Journal of Occupational Health Psychology*, v. 5, n. 3, p. 347–358, 2000.
  DOI: https://doi.org/10.1037/1076-8998.5.3.347.
- NEAL, A.; GRIFFIN, M. A.; HART, P. M. The impact of organizational climate
  on safety climate and individual behavior. *Safety Science*, v. 34, n. 1–3,
  p. 99–109, 2000. DOI: https://doi.org/10.1016/S0925-7535(00)00008-4.
- REVILLA, M. A.; SARIS, W. E.; KROSNICK, J. A. Choosing the number of
  categories in agree-disagree scales. *Sociological Methods & Research*,
  v. 43, n. 1, p. 73–97, 2014. DOI:
  https://doi.org/10.1177/0049124113509605.
- VENKATESH, V.; MORRIS, M. G.; DAVIS, G. B.; DAVIS, F. D. User acceptance of
  information technology: toward a unified view. *MIS Quarterly*, v. 27,
  n. 3, p. 425–478, 2003. DOI: https://doi.org/10.2307/30036540.
- BRASIL. Conselho Nacional de Saúde. Resolução nº 510, de 7 de abril de
  2016. Disponível em:
  https://www.gov.br/conselho-nacional-de-saude/pt-br/atos-normativos/resolucoes/2016/resolucao-no-510.pdf/view.

## 11. Entregáveis previstos após aprovação desta especificação

- `research/protocol/entrevista-estruturada-frentistas.docx`;
- `research/protocol/entrevista-estruturada-direcao.docx`;
- fontes editáveis em Markdown correspondentes;
- `research/protocol/plano-codificacao-questionarios.md`;
- atualização controlada de `research/protocol/entrevistas.md` para distinguir
  o roteiro semiestruturado anterior dos novos instrumentos estruturados.

Os arquivos Word terão campos para identificação artificial, data, versão e
marcação de uma resposta por item. Não conterão nomes, matrículas ou unidade em
texto aberto.
