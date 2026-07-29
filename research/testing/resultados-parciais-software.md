# Resultados parciais de software

Registro de verificacao executado em **29/07/2026**. Estes resultados se
referem ao simulador e ao codigo do prototipo; nao demonstram funcionamento de
uma bancada fisica, reducao real de incidentes nem confirmacao das hipoteses
H1 e H2.

## Backend

- Comando: `.venv\\Scripts\\python.exe -m pytest --cov=app --cov-report=term-missing --cov-fail-under=85`.
- Resultado: **82 de 82 testes aprovados**.
- Cobertura: **93,26%** no conjunto `app`.
- Cenarios dirigidos verificados: falha fechada, expiracao, idempotencia,
  concorrencia por bomba, perda de confirmacao do dispositivo, reconciliacao
  apos reinicio, migracao aditiva e restricao de acesso local.

## PWA

- Comandos: `npm test`, `npm run build` e `npm audit --audit-level=high`.
- Resultado: **12 de 12 testes aprovados**, build de producao concluido e
  nenhuma vulnerabilidade encontrada pela auditoria no momento da execucao.

## Firmware

- Teste host compilado com `g++ -std=c++17 -Wall -Wextra -Werror`.
- Resultado: suite host do intertravamento aprovada.
- Build: PlatformIO `esp32dev` concluido com sucesso.
- Uso informado pelo build: **13,8% da RAM** e **59,2% da flash**.

## Planilha economica

- Arquivo aberto e verificado como pacote XLSX valido.
- Oito abas esperadas, 1.040 celulas de formula e validacoes de dados presentes.
- Nenhuma formula contendo `#REF!` ou `#NAME?` foi encontrada.
- O modelo permanece deliberadamente como `PENDENTE` ate o preenchimento com
  dados autorizados e premissas documentadas.

## Limites da evidencia

- O ESP32 ainda nao foi gravado nem ensaiado com atuadores em bancada.
- Nao houve consulta real a SENATRAN, GCC ou Serpro.
- Nao foram usados combustiveis, bombas reais ou area classificada.
- O banco legado recebe migracao aditiva; restricoes `CHECK` e chaves
  estrangeiras ausentes em uma base antiga nao sao reconstruidas nesta versao.
- Os testes automatizados nao substituem a matriz de ensaio fisico nem os dados
  historicos necessarios a avaliacao economica.
