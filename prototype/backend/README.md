# Backend do protótipo

API FastAPI do protótipo acadêmico de prevenção de abastecimento incompatível.
O modo disponível é totalmente simulado: usa placas sintéticas, não chama a
SENATRAN e não deve ser conectado a uma bomba real.

## Execução local

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
$env:SUPERVISOR_TOKEN = "troque-por-um-token-local-longo"
$env:IDEMPOTENCY_HMAC_SECRET = "use-outro-segredo-aleatorio-com-32-caracteres"
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

A documentação interativa fica em `http://127.0.0.1:8000/docs`. Para executar
os testes:

```powershell
.\.venv\Scripts\python -m pytest
```

## Contrato principal

- `POST /api/v1/compatibility-checks`: consulta uma placa sintética sem
  persistir a placa ou a resposta do provedor.
- `POST /api/v1/authorizations`: avalia o combustível pedido e, quando seguro,
  libera somente o bico correspondente por um TTL curto. O corpo inclui
  `client_request_id` UUID; repetir a mesma chave e o mesmo payload recupera a
  decisão sem novo acionamento, enquanto payload divergente retorna conflito.
- `POST /api/v1/authorizations/{id}/override`: liberação excepcional protegida
  por `Authorization: Bearer <SUPERVISOR_TOKEN>` e registrada em auditoria.
  Somente incertezas veiculares recentes em `REVIEW_REQUIRED` podem receber
  override. Falha de bomba/bico, placa inválida, bomba ocupada, decisão `DENIED`
  e autorização expirada exigem novo fluxo e permanecem bloqueadas.
- `POST /api/v1/authorizations/{id}/complete`: encerra a autorização e envia
  `LOCK_ALL`.
- `GET /api/v1/authorizations/{id}`: consulta o estado operacional.
- `GET /api/v1/authorizations/{id}/audit`: consulta protegida da trilha de
  auditoria.

As placas nunca aparecem em URLs. O banco registra somente decisão, produto
solicitado, identificadores operacionais, horários, motivo, modo do provedor e
eventual override. O fingerprint HMAC usado para idempotência não permite
recuperar a placa sem o segredo externo. Não existem colunas para placa,
Renavam, chassi, proprietário ou resposta bruta.

## Placas exclusivamente sintéticas do mock

| Placa | Perfil retornado |
|---|---|
| `AAA1A11` | gasolina |
| `BBB2B22` | etanol |
| `CCC3C33` | flex (gasolina/etanol) |
| `DDD4D44` | diesel S10 |
| `EEE5E55` | híbrido gasolina/elétrico |
| `FFF6F66` | elétrico, sem combustível líquido |
| `GGG7G77` | conversão gasolina/GNV, tratada como ambígua |
| `HHH8H88` | descrição ambígua |
| `JJJ9J99` | diesel sem grau, tratado como ambíguo |
| `TTT1T11` | timeout simulado |
| `UUU2U22` | indisponibilidade simulada |

Qualquer outra placa válida retorna `VEHICLE_NOT_FOUND`. Esses valores não
representam veículos reais e existem apenas para testes.

## Segurança e limites

- Este MVP aceita apenas conexões originadas no próprio computador. A identidade
  de frentista/supervisor ainda é autodeclarada e o token de supervisor é global;
  portanto ele não deve ser exposto à rede, usado por múltiplos usuários nem
  ligado a atuadores físicos. Autenticação individual e RBAC são pendências.
- O estado inicial e toda falha são tratados como bloqueados (`fail closed`).
- O intent `PENDING_DEVICE` e o `command_id` são persistidos antes do `UNLOCK`;
  somente o ACK síncrono do gateway promove a decisão a `AUTHORIZED`.
- `UNLOCK` contém `command_id`, `sequence`, `pump_id`, `nozzle_id`, TTL de no
  máximo 120 s e `session_id`. Comandos vencidos, duplicados, atrasados ou de
  outra sessão são rejeitados.
- Repetir um `UNLOCK` não prolonga o TTL.
- A consulta de compatibilidade fica em cache HMAC somente em memória pelo TTL,
  evitando cobrar/consultar duas vezes no fluxo PWA + autorização.
- Perda de comunicação bloqueia todos os bicos no simulador.
- O dispositivo nunca recebe placa nem resposta veicular.
- `PROVIDER_MODE=senatran` encerra o startup com erro intencional. Uma integração
  real só poderá ser adicionada após autorização formal e desenho de segurança.
