# Infraestrutura local da bancada

O `compose.yaml` inicia um broker Eclipse Mosquitto exclusivamente para o ensaio
local do PICSimLab. A porta é publicada somente em `127.0.0.1` e o container
não reinicia automaticamente.

```powershell
cd prototype\infra
docker compose up -d
docker compose ps
```

Para acompanhar as mensagens sem exibir dados veiculares:

```powershell
docker compose exec mqtt mosquitto_sub -h 127.0.0.1 -t "tcc/bancada/+/events" -v
```

Para encerrar:

```powershell
docker compose down
```

O broker permite conexão anônima porque é uma bancada isolada no próprio
computador. Ele não deve ser publicado na rede, implantado em produção ou usado
com credenciais reais. Uma implantação fora da bancada exige autenticação por
dispositivo, ACL por tópico, TLS, rotação de certificados e monitoramento.

Imagem utilizada: `eclipse-mosquitto:2.1.2-alpine`, mantida pela Eclipse
Foundation e disponibilizada como imagem oficial.
