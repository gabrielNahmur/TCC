# Resultados parciais de software

Registro de verificacao executado em **31/07/2026**. Estes resultados se
referem ao simulador e ao codigo do prototipo; nao demonstram funcionamento de
uma bancada fisica, reducao real de incidentes nem confirmacao das hipoteses
H1 e H2.

## Backend

- Comando: `.venv\\Scripts\\python.exe -m pytest --cov=app --cov-report=term-missing --cov-fail-under=85`.
- Resultado: **95 de 95 testes aprovados**.
- Cobertura: **90%** no conjunto `app`.
- Cenarios dirigidos verificados: falha fechada, expiracao, idempotencia,
  concorrencia por bomba, perda de confirmacao do dispositivo, reconciliacao
  apos reinicio, migracao aditiva, restricao de acesso local, telemetria da
  bancada digital e validacao de ACK no adaptador MQTT com cliente falso.
- Em ensaio de fumaca HTTP com o servidor Uvicorn, uma autorizacao sintetica de
  gasolina autorizou somente a saida da trava `nozzle-gasoline`, produziu cinco
  eventos de telemetria e a parada de emergencia removeu imediatamente essa
  autorizacao logica.

## PWA

- Comandos: `npm test`, `npm run build` e `npm audit --audit-level=high`.
- Resultado: **24 de 24 testes aprovados**, build de producao concluido e
  nenhuma vulnerabilidade encontrada pela auditoria no momento da execucao.
- A tela de bancada digital foi coberta em seus modos visual e conectado,
  incluindo bloqueio por TTL e controles de falha do simulador.

## Firmware

- Teste host compilado com `g++ -std=c++17 -Wall -Wextra -Werror`.
- Resultado: suite host do intertravamento aprovada.
- Build: PlatformIO `picsimlab` concluido com sucesso e workspace `.pzw` gerado.
- Uso informado pelo build: **13,8% da RAM** e **59,2% da flash**.
- O workspace foi carregado no PICSimLab 0.9.2; a interface remota confirmou a
  placa `ESP32-DevKitC` e o painel de pecas ativo.

## Planilha economica

- Arquivo aberto e verificado como pacote XLSX valido.
- Oito abas esperadas, 1.040 celulas de formula e validacoes de dados presentes.
- Nenhuma formula contendo `#REF!` ou `#NAME?` foi encontrada.
- O modelo permanece deliberadamente como `PENDENTE` ate o preenchimento com
  dados autorizados e premissas documentadas.

## Limites da evidencia

- O broker MQTT nao pôde ser iniciado porque o mecanismo do Docker Desktop nao
  estava em execucao; por isso, nao houve ensaio ponta a ponta entre PWA,
  backend, Mosquitto e ESP32 emulado.
- O ESP32 fisico ainda nao foi gravado nem ensaiado com atuadores em bancada.
- A posicao do bico exibida na planta React e simulada no navegador. O ACK
  coberto nos testes confirma comando e estado logico da GPIO, nao movimento do
  atuador ou posicao mecanica. A implementacao atual nao possui microswitch nem
  sensor Hall para fornecer essa confirmacao.
- Nao houve consulta real a SENATRAN, GCC ou Serpro.
- Nao foram usados combustiveis, bombas reais ou area classificada.
- O banco legado recebe migracao aditiva; restricoes `CHECK` e chaves
  estrangeiras ausentes em uma base antiga nao sao reconstruidas nesta versao.
- Os testes automatizados nao substituem a matriz de ensaio fisico nem os dados
  historicos necessarios a avaliacao economica.
