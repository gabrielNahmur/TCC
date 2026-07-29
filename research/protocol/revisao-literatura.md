# Protocolo de mapeamento da literatura

**Status:** protocolo inicial; executar e congelar antes da selecao final.

## Objetivo

Identificar evidencias sobre causas e prevencao de abastecimento incompativel,
intertravamentos e identificacao veicular aplicados ao abastecimento, fatores
humanos envolvidos na tarefa e metodos de avaliacao de prototipos semelhantes.

## Questoes da revisao

- RQ1: quais fatores humanos, operacionais e de interface contribuem para erros
  de abastecimento?
- RQ2: quais mecanismos tecnicos de identificacao, autorizacao ou
  intertravamento foram propostos ou avaliados?
- RQ3: como seguranca, disponibilidade e excecoes operacionais sao tratadas?
- RQ4: quais metricas foram empregadas para avaliar eficacia, usabilidade,
  desempenho e viabilidade economica?

## Fontes de busca

IEEE Xplore, ACM Digital Library, Scopus e SciELO. Google Scholar sera usado
somente como busca complementar, para citacoes anteriores/posteriores e para
localizar versoes acessiveis de estudos ja identificados.

## Strings-base

Adaptar apenas a sintaxe, preservando os conceitos e registrando a string exata
usada em cada base.

```text
("misfueling" OR "mis-fuelling" OR "wrong fuel" OR "fueling error" OR
 "fuel dispensing error") AND (prevention OR interlock OR authorization OR
 ergonomics OR "human factors")
```

```text
("automatic vehicle identification" OR "vehicle identification" OR RFID OR
 "license plate") AND ("fuel dispenser" OR refuelling OR fueling OR forecourt)
```

```text
("error proofing" OR "mistake proofing" OR "poka-yoke" OR interlock) AND
("safety critical" OR automotive OR fueling)
```

Tambem serao executadas traducoes controladas em portugues e espanhol. A data,
a base, os filtros e a quantidade retornada serao registrados no diario de
busca.

## Criterios de inclusao

- artigo, trabalho de conferencia ou revisao com avaliacao por pares;
- texto em portugues, ingles ou espanhol;
- relacao direta com abastecimento incorreto, autorizacao de combustivel,
  identificacao veicular, intertravamento ou fatores humanos da tarefa;
- texto completo disponivel para avaliacao;
- evidencia suficiente para responder ao menos uma questao da revisao.

## Criterios de exclusao

- duplicata ou versao menos completa do mesmo estudo;
- uso de `misfueling` apenas no sentido de emissoes, adulteracao ou mistura de
  combustivel sem erro de selecao do veiculo;
- patente, publicidade, postagem, noticia ou manual comercial como evidencia
  cientifica;
- estudo sem descricao minimamente verificavel de metodo ou resultado;
- idioma fora do escopo sem traducao confiavel disponivel.

## Processo de selecao

1. Exportar metadados e DOI de cada base.
2. Remover duplicatas por DOI e, na ausencia dele, por titulo/ano.
3. Triar titulo e resumo, registrando motivo de exclusao.
4. Avaliar texto completo.
5. Fazer encadeamento para tras e para frente nos estudos centrais.
6. Produzir fluxograma com identificados, removidos, avaliados e incluidos.

## Avaliacao de qualidade

Cada estudo recebera `sim`, `parcial` ou `nao` para:

1. objetivo ou pergunta claramente formulado;
2. contexto e participantes/artefatos descritos;
3. metodo reproduzivel em grau adequado;
4. metricas coerentes com o objetivo;
5. resultados separados de interpretacoes;
6. limitacoes ou ameacas a validade discutidas.

O escore nao sera usado mecanicamente para eliminar estudos; servira para
ponderar a forca da evidencia na sintese.

## Campos de extracao

ID, referencia, DOI/URL, pais, contexto, objetivo, desenho do estudo, amostra,
tecnologia, mecanismo preventivo, modo de falha, metricas, resultados,
limitacoes, ameacas a validade e contribuicao para RQ1-RQ4.

## Sementes ja verificadas

- Adams, G. G.; David, G. C. *Light vehicle fuelling errors in the UK: the
  nature of the problem, its consequences and prevention* (2007).
  https://pubmed.ncbi.nlm.nih.gov/17349611/
- Peffers, K. et al. *A Design Science Research Methodology for Information
  Systems Research* (2007). https://doi.org/10.2753/MIS0742-1222240302
