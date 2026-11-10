# PICSimLab — bancada ESP32

Este diretório gera um workspace `.pzw` para o PICSimLab 0.9.2 com:

- ESP32-DevKitC emulado pelo backend QEMU do PICSimLab;
- cinco LEDs ligados aos GPIOs 25, 26, 27, 13 e 14;
- uma chave de parada ligada ao GPIO 33;
- terminal serial virtual em 115200 bit/s;
- imagem flash de 4 MB compilada em modo DIO.

O workspace representa uma bancada seca. LED aceso significa saída autorizada;
não significa que uma instalação industrial esteja certificada.

## 1. Preparar o firmware

No diretório `prototype/firmware`:

```powershell
Copy-Item include\tcc_config.picsimlab.example.h include\tcc_config.h
```

O perfil usa o SSID emulado `PICSimLabWifi`, sem senha, conforme o exemplo
oficial `SimpleWifiServer` da placa ESP32-DevKitC. Também usa `192.168.4.2` como
endereço do computador hospedeiro. O
PICSimLab 0.9.2 inicia o QEMU com `net=192.168.4.0/24`, e a rede de usuário do
QEMU reserva o segundo endereço da rede para representar o host. Se uma versão
futura alterar esse parâmetro, atualize `MQTT_HOST` e gere o workspace novamente.

## 2. Gerar o workspace

```powershell
.\prototype\picsimlab\build-workspace.ps1
```

O script executa o ambiente PlatformIO `picsimlab`, monta bootloader, tabela de
partições, `boot_app0` e aplicação em uma imagem DIO de 4 MB e cria:

```text
prototype/picsimlab/bancada-intertravamento.pzw
```

O arquivo `tcc_config.h` e as credenciais não entram no Git. O `.pzw` gerado
contém o firmware compilado; portanto ele deve continuar restrito à bancada e
nunca conter credenciais de produção.

## 3. Abrir no PICSimLab

Instale a versão 0.9.2 ou compatível e abra o `.pzw` pelo menu de workspace ou:

```powershell
& "C:\Program Files\PICSimLab\picsimlab.exe" ".\prototype\picsimlab\bancada-intertravamento.pzw"
```

No painel de peças sobressalentes:

- os cinco LEDs representam as saídas dos bicos, na ordem da tabela do firmware;
- a primeira chave representa a entrada de emergência do GPIO 33;
- chave em nível baixo representa o contato normalmente fechado;
- chave em nível alto deve desenergizar todas as saídas;
- o terminal virtual mostra mensagens de inicialização e diagnóstico.

## 4. Broker e backend

Inicie o broker local descrito em `prototype/infra/README.md`. Depois execute o
backend com `DISPENSER_MODE=mqtt`. A tela **Bancada digital** ficará em modo
`PICSimLab / ESP32 via MQTT`; seus botões de falha serão desativados porque as
falhas devem ser acionadas no próprio PICSimLab.

## Diagnóstico e ensaio obrigatório

O workspace, os GPIOs e a imagem DIO são reproduzíveis. A configuração carregada
pode ser confirmada na interface remota do PICSimLab, normalmente na porta TCP
5000, com o comando `info`. Firewall, broker e Docker ainda precisam ser
confirmados no ensaio ponta a ponta. Enquanto o evento `DEVICE_ONLINE` não
chegar ao backend, a aplicação permanece bloqueada.

Documentação oficial usada para o perfil: [placas suportadas](https://lcgamboa.github.io/picsimlab_docs/stable/Boards.html), [exemplo Wi-Fi da ESP32-DevKitC](https://github.com/lcgamboa/picsimlab_examples/blob/master/docs/board_ESP32_DevKitC/ESP32/SimpleWifiServer/src/SimpleWifiServer.ino), [integração PlatformIO/ESP32](https://lcgamboa.github.io/picsimlab_docs/stable/ESP32gdbDebug.html), [linha de comando de workspace](https://lcgamboa.github.io/picsimlab_docs/stable/CommandLine.html) e [rede de usuário do QEMU](https://www.qemu.org/docs/master/system/qemu-manpage.html).
