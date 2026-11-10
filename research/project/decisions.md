# Registro de decisoes

## D001 - Escopo fisico

**Decisao:** a primeira versao e uma bancada seca. O artefato representa uma
trava fisica independente no suporte do bico, destinada a impedir sua retirada
sem autorizacao. Ele nao comanda bombeamento e nao se integra a automacao ou ao
controlador de pista da empresa. ESP32, servo, solenoide e tablet comuns nao
serao instalados em pista de abastecimento.

**Motivo:** uma instalacao real depende de area classificada, certificacao,
projeto de engenharia e profissionais habilitados. O TCC avalia a logica e a
viabilidade sem transformar um prototipo didatico em equipamento industrial ou
ampliar o escopo para o sistema de automacao da empresa.

## D002 - Comportamento em falha

**Decisao:** `fail-closed`. Erro, timeout, ambiguidade, codigo desconhecido ou
perda de comunicacao desenergizam todas as saidas de abertura. Se um bico ja
estiver fora do suporte, o sistema solicita devolucao e nao afirma bloqueio
mecanico. Override exige supervisor, justificativa e auditoria.

## D003 - Veiculos multicombustivel

**Decisao:** apresentar somente combustiveis compativeis; o frentista seleciona
o produto solicitado e apenas a trava do suporte do bico correspondente recebe
autorizacao temporaria para abertura.

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

## D009 - Limite da telemetria mecanica

**Decisao:** a posicao do bico na planta React e um estado simulado no
navegador. O ACK do dispositivo confirma o comando e o estado logico da saida
GPIO, mas nao comprova movimento do atuador, abertura do pino, retirada ou
devolucao do bico.

**Motivo:** a bancada atual nao possui sensor de presenca. Microswitch ou sensor
Hall no suporte sera tratado como melhoria futura e somente podera ser descrito
como implementado depois de montagem e ensaio fisico.
