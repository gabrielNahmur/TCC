# Arquitetura do prototipo

## Limite de seguranca

O prototipo serve exclusivamente para bancada seca, em baixa tensao e sem
atmosfera inflamavel. Uma aplicacao real deve ser redesenhada com fabricante da
bomba, integrador habilitado, profissional de seguranca e equipamentos
certificados para a classificacao do local.

## Componentes

```mermaid
flowchart LR
  UI["PWA do frentista/supervisor"] --> API["API FastAPI"]
  API --> VP["VehicleDataProvider"]
  VP --> MOCK["Provedor simulado"]
  VP -. somente autorizado .-> SEN["SENATRAN/PGCC"]
  API --> POLICY["Motor de compatibilidade e politica"]
  POLICY --> AUDIT["Auditoria minimizada"]
  POLICY --> DG["DispenserGateway"]
  DG --> SIM["Simulador de bicos"]
  DG --> MQTT["Broker MQTT local"]
  MQTT --> ESP["ESP32 de bancada"]
  ESP --> ACT["LEDs/servos/solenoides ficticios"]
```

O frontend nunca acessa a SENATRAN nem o dispositivo diretamente. O provedor
veicular retorna somente uma representacao interna de combustiveis compativeis.
O gateway recebe apenas autorizacao, identificador de bico e validade.

## Estados implementados no MVP

```mermaid
stateDiagram-v2
  [*] --> REVIEW_REQUIRED: resposta incerta ou invalida
  [*] --> DENIED: incompatibilidade confirmada
  [*] --> PENDING_DEVICE: intent persistido
  PENDING_DEVICE --> AUTHORIZED: ACK do gateway
  PENDING_DEVICE --> REVIEW_REQUIRED: falha do comando
  REVIEW_REQUIRED --> PENDING_DEVICE: override recente e permitido
  AUTHORIZED --> EXPIRED: TTL encerrado
  AUTHORIZED --> COMPLETED: encerramento
  AUTHORIZED --> SUPERSEDED: payload invalido identificou a mesma bomba
  PENDING_DEVICE --> EXPIRED: reconciliacao/reinicio
```

`QUERYING`, `DISPENSING`, `LOCKED`, `DeviceAck` persistente, `PolicyVersion` e
identidade individual pertencem a arquitetura-alvo; ainda nao sao estados ou
entidades persistidos neste MVP. O ACK atual e sincrono no gateway simulado.

## Ameacas e controles iniciais

| Ameaca/falha | Consequencia | Controle |
|---|---|---|
| resposta veicular ausente ou desconhecida | liberacao incorreta | `REVIEW_REQUIRED`, nunca fail-open |
| codigo de combustivel novo | mapeamento incorreto | tabela versionada e desconhecido bloqueado |
| comando MQTT repetido | segundo acionamento | `command_id` idempotente |
| comando atrasado | acionamento fora da ordem | `sequence` monotônica por dispositivo/sessao, TTL local e rejeicao de replay |
| perda de rede/energia | estado indefinido | bloqueio local por TTL e inicializacao em `LOCK_ALL` |
| credencial exposta | consulta ou override indevido | segredo externo, menor privilegio e rotacao |
| placa nos logs | risco LGPD | uso transitorio e log sem placa/resposta bruta |
| supervisor compartilhado | override sem autoria confiavel | MVP restrito a localhost; identidade individual e RBAC sao obrigatorios antes de uso multiusuario |
| timeout da PWA | resposta desconhecida e repeticao do comando | `client_request_id` idempotente e reconciliacao manual com a mesma chave |

## Decisao para instalacao real

A trava mecanica de bancada representa o intertravamento, mas nao define a
solucao industrial. Para um piloto real, a primeira alternativa a avaliar e a
autorizacao eletronica por controlador de pista/dispenser. Servo, ESP32 e tablet
comuns nao devem ser levados para a zona de abastecimento.
