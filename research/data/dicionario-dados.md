# Dicionario de dados para ocorrencias e custos

Os dados brutos nao devem ser versionados. A base de trabalho sera tratada como
**pseudonimizada**, nao como anonima: data, unidade e custos raros ainda podem
permitir reidentificacao. A planilha usa somente campos necessarios,
identificadores artificiais e valores agregaveis.

| Campo | Tipo | Obrigatorio | Regra |
|---|---|---:|---|
| `id_ocorrencia` | texto | sim | Codigo artificial sem placa, cliente ou funcionario |
| `data_ocorrencia` | data | sim | Data do evento; usar apenas mes/ano se o dia elevar risco de identificacao |
| `unidade_codigo` | texto | sim | Codigo pseudonimizado e estavel |
| `combustivel_veiculo` | categoria | nao | Gasolina, etanol/flex, diesel, eletrico/hibrido, convertido, desconhecido |
| `combustivel_abastecido` | categoria | sim | Produto efetivamente colocado, sem texto livre quando evitavel |
| `fase_deteccao` | categoria | sim | Antes de ligar, apos ligar, apos saida, desconhecida |
| `fonte_registro` | categoria | sim | Financeiro, ocorrencia operacional, oficina, outro |
| `custo_remocao` | moeda | nao | Drenagem/limpeza comprovada |
| `custo_reparo` | moeda | nao | Pecas e mao de obra comprovadas |
| `custo_reboque` | moeda | nao | Guincho/reboque comprovado |
| `custo_reembolso` | moeda | nao | Valor pago ao cliente, sem duplicar reparos |
| `outros_custos_diretos` | moeda | nao | Apenas com descricao e documento suporte |
| `descricao_outros` | categoria/texto revisado | condicional | Usar categoria controlada quando possivel; proibir placa, nome e numero identificador |
| `valor_total_documentado` | formula | sim | Soma dos custos diretos, nunca digitada manualmente |
| `indice_ipca_evento` | numero | nao | Indice oficial do periodo |
| `indice_ipca_data_base` | numero | nao | Indice oficial da data-base |
| `valor_corrigido` | formula | nao | Total x indice-base / indice-evento |
| `status_validacao` | categoria | sim | Pendente, validado, excluido |
| `motivo_exclusao` | texto | condicional | Obrigatorio para registro excluido |
| `observacao_revisada` | texto | nao | Evitar; se indispensavel, revisar contra pessoas, placas, chassi, Renavam e relato identificavel |

## Governanca antes da coleta

- registrar responsavel pelo tratamento, finalidade, base legal e papeis de acesso;
- manter eventual tabela de ligacao em ambiente corporativo separado, cifrado e
  acessivel apenas a pessoas autorizadas;
- aprovar prazo de retencao, rotina de revisao e descarte verificavel;
- revisar textos livres antes da entrada no corpus analitico;
- publicar somente resultados agregados e suprimir celulas pequenas ou raras
  que elevem o risco de reidentificacao.

## Denominadores operacionais

Para estimar taxa, solicitar em tabela separada: periodo, unidade codificada,
quantidade de abastecimentos e fonte do total. Sem cobertura compativel entre
numerador e denominador, apresentar apenas contagens e custos absolutos.

## Custos que nao devem ser somados sem evidencia

Imagem da empresa, perda de fidelidade, horas improdutivas estimadas, risco de
processo e dano potencial. Esses itens podem ser discutidos qualitativamente ou
em analise de sensibilidade, sempre separados de custo realizado.
