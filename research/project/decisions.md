# Registro de decisoes

## D001 - Escopo fisico

**Decisao:** a primeira versao e uma bancada seca. ESP32, servo, solenoide e
tablet comuns nao serao instalados em pista de abastecimento.

**Motivo:** uma instalacao real depende de area classificada, certificacao,
fabricante da bomba e integrador. O TCC avalia a logica e a viabilidade sem
transformar um prototipo didatico em equipamento industrial.

## D002 - Comportamento em falha

**Decisao:** `fail-closed`. Erro, timeout, ambiguidade, codigo desconhecido ou
perda de comunicacao bloqueiam todos os bicos. Override exige supervisor,
justificativa e auditoria.

## D003 - Veiculos multicombustivel

**Decisao:** apresentar somente combustiveis compativeis; o frentista seleciona
o produto solicitado e apenas o bico correspondente e liberado.

## D004 - Dados veiculares

**Decisao:** a placa existe apenas durante a requisicao. Logs e dispositivos nao
recebem placa, resposta bruta, dados de titular, Renavam ou chassi.

## D005 - Provedor externo

**Decisao:** implementar contrato `VehicleDataProvider` e usar um simulador com
placas sinteticas. A implementacao SENATRAN permanece desabilitada ate existir
autorizacao, contrato, certificado e documentacao do ambiente liberado.

## D006 - Resultado economico

**Decisao:** usar todo o historico verificavel, corrigir valores por IPCA e
separar custos realizados de cenarios. Apresentar ponto de equilibrio e
sensibilidade de 25%, 50%, 75% e 100%, sem chamar projeção de economia observada.

## D007 - Fonte do artigo

**Decisao:** GitHub e a fonte oficial. Overleaf e ambiente de edicao/compilacao;
nao deve haver edicao concorrente. Cada sessao termina com sincronizacao e
commit dos fontes.

## D008 - Identificacao da empresa

**Decisao:** usar “uma rede de postos de combustiveis do sul do Brasil” ate
existir autorizacao escrita para identificacao.
