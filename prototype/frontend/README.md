# Interface do protótipo

PWA para tablet que demonstra o fluxo de consulta de compatibilidade, seleção do combustível, autorização temporária e override auditável. O estado visual padrão é sempre bloqueado.

## Execução local

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

O modo de demonstração vem habilitado e usa apenas placas sintéticas. Para conectar ao backend, configure `VITE_API_BASE_URL`, altere `VITE_DEMO_MODE=false` e mantenha o backend no mesmo ambiente controlado.

## Bancada digital

A aba **Bancada digital** possui duas vistas complementares:

- **Vista da bancada**: planta React/SVG com estrutura cenográfica, cinco
  mangueiras, bicos, travas nos suportes, ESP32, drivers, fonte de 12 V, fusível,
  tablet e parada de emergência;
- **Diagnóstico técnico**: GPIOs, sessão, TTL, sequência e histórico de
  comandos/ACKs.

Na planta, somente o bico cuja trava recebeu autorização pode ser retirado por
arraste, toque ou botão. Se o TTL terminar, a comunicação cair ou a emergência
for acionada com o bico fora, ele continua fora até uma devolução manual. A tela
não simula um retorno físico automático.

A retirada e a devolução são estados locais do navegador. O protótipo ainda não
possui microswitch ou sensor Hall, portanto o ACK confirma somente o comando e o
estado lógico do GPIO, não o movimento do pino nem a presença real do bico.

- em modo de demonstração, a telemetria é didática e gerada no navegador;
- com `VITE_DEMO_MODE=false`, a tela consulta o gateway real do backend;
- `gateway_mode=simulated` mostra comandos realmente aplicados pelo objeto
  Python em memória e habilita os controles de desconexão/emergência;
- `gateway_mode=mqtt` mostra eventos do PICSimLab/ESP32 e desabilita controles
  artificiais: falhas devem ser acionadas no próprio dispositivo.

A tela nunca recebe nem exibe placa na telemetria do dispositivo.

O sistema atua exclusivamente sobre a trava independente instalada no suporte
do bico. Ele não comanda bombeamento, vazão, controlador de pista ou automação
da empresa.

## Cenários sintéticos

| Placa | Resultado esperado |
|---|---|
| `TCC1A01` | Gasolina |
| `TCC1A02` | Flex: gasolina ou etanol |
| `TCC1A03` | Diesel S10 |
| `TCC1A09` | Diesel S500 |
| `TCC1A04` | Nenhum combustível líquido |
| `TCC1A05` | Veículo não encontrado |
| `TCC1A06` | Timeout do provedor |
| `TCC1A07` | Mapeamento ambíguo |
| `TCC1A08` | Gasolina ou GNV |

O token do supervisor no modo sintético é `DEMO-SUPERVISOR`. Ele existe somente para demonstrar o fluxo; não deve ser reutilizado fora do simulador.

O override aparece exclusivamente para decisões `REVIEW_REQUIRED`. Decisões `DENIED`, concluídas ou expiradas continuam bloqueadas e exigem o início de uma nova operação.

Mesmo dentro de `REVIEW_REQUIRED`, o override é oferecido somente para incertezas do dado veicular: veículo não localizado, timeout/indisponibilidade do provedor e mapeamento desconhecido ou ambíguo. Bomba ocupada, placa inválida, bomba/bico não configurado e falha do dispositivo permanecem bloqueados e exigem correção operacional ou técnica.

## Contrato consumido

- `POST /api/v1/compatibility-checks` com `{ "plate": "ABC1D23" }`;
- `POST /api/v1/authorizations` com `client_request_id` UUID, placa, combustível, frentista e bomba;
- `POST /api/v1/authorizations/{id}/override` com token Bearer, supervisor e justificativa;
- `POST /api/v1/authorizations/{id}/complete` para encerrar e solicitar `LOCK_ALL`.

A placa segue no corpo da requisição e nunca na URL. A PWA não persiste placa, token ou resposta veicular em `localStorage`, cache ou service worker. Requisições `/api/` usam estratégia `NetworkOnly`.

`client_request_id` é criado uma vez por tentativa de autorização. Se a conexão cair antes da resposta, a PWA não afirma que o bico ficou bloqueado, não inicia outra operação e não faz retry automático. A ação manual de reconciliação repete exatamente o mesmo corpo e a mesma chave; o backend deve devolver a decisão já existente para chave e payload iguais e responder `409` se a chave for reutilizada com dados diferentes.

Se a resposta de `override` ou `complete` se perder, a interface também marca o estado físico como desconhecido e não repete o comando. Como nesses casos o `authorization_id` já é conhecido, a reconciliação manual usa `GET /api/v1/authorizations/{id}` até obter um estado final. `PENDING_DEVICE` continua sendo tratado como desconhecido.

## Validação

```powershell
npm test
npm run build
```

O temporizador da interface é informativo. O bloqueio de segurança é aplicado pelo TTL do dispositivo; se a confirmação de encerramento falhar, a PWA informa que o TTL continua sendo a última proteção.

> Este software é um protótipo acadêmico de bancada, sem combustível e fora de área classificada. Não é um controlador certificado para bombas de combustíveis.
