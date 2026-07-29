# Firmware ESP32 — bancada de intertravamento

Firmware experimental para representar cinco bicos (`GASOLINE`, `ETHANOL`, `DIESEL_S10`, `DIESEL_S500` e `GNV`) com LEDs ou atuadores de baixa tensão. O projeto adota **desenergizado = bloqueado** e nunca recebe placa ou dados veiculares. O diesel genérico não é aceito, pois não identifica com segurança o produto da mangueira.

> Uso exclusivo em bancada seca, sem combustível e fora de área classificada. O ESP32 e os componentes sugeridos não são certificados para instalação em bombas ou atmosferas explosivas.

## Comportamento de segurança

- inicialização, perda de Wi-Fi, perda do MQTT, JSON inválido, comando desconhecido, sessão incorreta, botão de emergência e término do TTL desenergizam todas as saídas;
- somente uma saída pode permanecer energizada;
- `UNLOCK` aceita TTL entre 1 e 120 segundos;
- o TTL é relativo e começa quando o comando é aceito; o firmware não depende do relógio civil para manter o bloqueio;
- o mesmo `command_id` nunca estende o TTL nem libera novamente um bico;
- os 16 últimos identificadores aceitos ficam em NVS para impedir repetição após reinício;
- todo reinício cria um `boot_id`; `UNLOCK` exige esse valor em `session_id`, impedindo comandos antigos de outra sessão;
- todo comando traz um `sequence` crescente por dispositivo; o maior valor aceito fica em NVS, e comandos fora de ordem são rejeitados sem reabrir a bancada;
- `LOCK_ALL` é seguro e idempotente: até uma repetição reaplica fisicamente o bloqueio;
- mensagens de liberação não podem ser publicadas como `retained` no broker.

O firmware é uma camada adicional de proteção, não um sistema de segurança funcional certificado.

## Bancada sugerida

| Função | GPIO | Observação |
|---|---:|---|
| Gasolina | 25 | LED com resistor ou entrada de driver isolado |
| Etanol | 26 | LED com resistor ou entrada de driver isolado |
| Diesel S10 | 27 | LED com resistor ou entrada de driver isolado |
| Diesel S500 | 13 | LED com resistor ou entrada de driver isolado |
| GNV | 14 | LED com resistor ou entrada de driver isolado |
| Parada/bloqueio físico | 33 | contato normalmente fechado para GND; abrir o contato ou romper o fio leva a `HIGH` e bloqueia |

Não ligue solenoide, servo ou relé diretamente ao GPIO. Um ensaio com carga exige fonte separada, driver dimensionado, diodo de roda livre quando aplicável, resistores externos de pull-down nas saídas para manter o bloqueio durante o boot e validação do orientador responsável pela bancada.

## Configuração

1. Instale o [PlatformIO](https://platformio.org/).
2. Copie `include/tcc_config.example.h` para `include/tcc_config.h`.
3. Preencha rede, broker, `DEVICE_ID` e o `PUMP_ID` vinculado ao dispositivo. `tcc_config.h` é ignorado pelo Git.
4. Em uma rede que não seja uma bancada isolada, habilite TLS e use CA/certificado/chave próprios. O broker deve restringir publicação e assinatura por dispositivo.

Sem `tcc_config.h`, o projeto compila com valores vazios, mas permanece bloqueado e não se conecta.

## Contrato MQTT

Tópicos do dispositivo `esp32-bancada-01`:

```text
tcc/bancada/esp32-bancada-01/commands
tcc/bancada/esp32-bancada-01/events
```

Ao conectar, o dispositivo publica um evento retido `DEVICE_ONLINE` com `boot_id` e `last_sequence`. O backend deve usar esse identificador somente na sessão atual e emitir o próximo `sequence` maior que o informado. Se o backend perder seu contador, a recuperação deve ser administrativa; diminuir o contador para liberar uma mangueira não é permitido.

Liberar uma saída por 30 segundos — **publicar sem retenção**:

```json
{
  "command_id": "01JZZZZZZZZZZZZZZZZZZZZZZZ",
  "sequence": 102,
  "type": "UNLOCK",
  "pump_id": "BANCADA-01",
  "nozzle_id": "nozzle-gasoline",
  "ttl_seconds": 30,
  "session_id": "a1b2c3d4e5f60718"
}
```

Bloquear tudo — `session_id` não é necessário:

```json
{
  "command_id": "01JYYYYYYYYYYYYYYYYYYYYYYY",
  "sequence": 103,
  "type": "LOCK_ALL",
  "pump_id": "BANCADA-01"
}
```

Confirmação típica:

```json
{
  "event": "COMMAND_ACK",
  "device_id": "esp32-bancada-01",
  "pump_id": "pump-01",
  "boot_id": "a1b2c3d4e5f60718",
  "state": "UNLOCKED",
  "nozzle_id": "nozzle-gasoline",
  "command_id": "01JZZZZZZZZZZZZZZZZZZZZZZZ",
  "sequence": 102,
  "last_sequence": 102,
  "result": "APPLIED"
}
```

Resultados possíveis incluem `APPLIED`, `DUPLICATE`, `REJECTED_INVALID_ID`, `REJECTED_STALE_SEQUENCE`, `REJECTED_INVALID_TTL` e `REJECTED_INVALID_NOZZLE`. O backend só deve considerar uma liberação confirmada após `COMMAND_ACK` com `APPLIED`, sessão, sequência e bico correspondentes.

## Compilação e testes

```powershell
pio run
```

A lógica de TTL e idempotência é C++ portátil e pode ser testada sem placa:

```powershell
New-Item -ItemType Directory -Force .build | Out-Null
g++ -std=c++17 -Wall -Wextra -Werror -Iinclude test_host/interlock_logic_test.cpp -o .build/interlock_logic_test.exe
& .build/interlock_logic_test.exe
```

Antes de um ensaio físico, confira com multímetro que todos os pinos ficam em nível baixo durante boot, desconexão, expiração e acionamento da parada.
