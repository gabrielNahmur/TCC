# TCC — prevenção de abastecimento incompatível

Repositório acadêmico do Trabalho de Conclusão de Curso de Tecnologia em
Análise e Desenvolvimento de Sistemas do IFSul — Câmpus Bagé.

**Título provisório:** Prevenção de abastecimento incompatível por meio de
consulta veicular e intertravamento de bicos: projeto e avaliação de um
protótipo.

## Estado do projeto

O projeto está em fase de Seminário de Andamento. O código representa um
protótipo de bancada, sem combustível, criado para validar regras de
compatibilidade e falha segura. O efeito proposto é uma trava física
independente no suporte do bico, que impede sua retirada enquanto não houver
autorização. O sistema não comanda bombeamento e não integra a automação ou o
controlador de pista da empresa. Também não está autorizado para instalação em
área classificada.

Na verificação local de 31/07/2026, o backend passou em 95 testes com 90% de
cobertura, a PWA passou em 24 testes e em build/auditoria, e o firmware passou
nos testes de lógica em host e na compilação para ESP32/PICSimLab. O workspace
visual do PICSimLab foi gerado e carregado como ESP32-DevKitC. Isso comprova
somente componentes em ambiente sintético: o ensaio MQTT ponta a ponta, a
bancada física, a consulta real à SENATRAN e as hipóteses H1/H2 ainda não foram
avaliados integralmente.

## Estrutura

- `article/`: fontes LaTeX, bibliografia e PDF compilado do artigo;
- `research/`: protocolos, instrumentos, arquitetura, conformidade e evidências;
- `prototype/backend/`: API de autorização e simulador do provedor veicular;
- `prototype/frontend/`: PWA usada pelo frentista e pelo supervisor;
- `prototype/firmware/`: controlador ESP32 exclusivo para bancada;
- `prototype/picsimlab/`: workspace visual do ESP32 e gerador da imagem DIO;
- `prototype/infra/`: broker MQTT local para o ensaio de integração;
- `analysis/`: modelo auditável para ocorrências e viabilidade econômica;
- `presentation/`: apresentação modular do Seminário de Andamento.

## Principios obrigatorios

1. Nenhuma placa real, resposta bruta da SENATRAN, credencial, certificado ou
   dado de titular deve ser versionado.
2. A ausência de resposta positiva e inequívoca sempre resulta em bloqueio.
3. Overrides exigem supervisor autenticado, justificativa e trilha de auditoria.
4. Resultados simulados, observados e projetados devem permanecer separados.
5. Qualquer coleta com pessoas depende das autorizações institucionais e éticas
   aplicáveis.

## Execucao local

As instruções exatas ficam nos READMEs de cada componente. A versão atual roda
localmente com FastAPI/SQLite e React/Vite e possui adaptadores de
intertravamento simulado e MQTT, painel visual, firmware ESP32, workspace
PICSimLab e composição local do Mosquitto. A posição do bico mostrada pela PWA é
uma simulação do navegador; sem sensor físico, ela não confirma retirada ou
devolução real. O ensaio ao vivo entre esses componentes ainda depende do broker
em execução. Até o acesso oficial ser autorizado, somente o provedor simulado e
placas sintéticas podem ser usados.

## Entregáveis atuais

- [Artigo compilado](article/main.pdf)
- [Fontes do artigo](article/main.tex)
- [Apresentação do seminário](presentation/seminario-andamento.pptx)
- [Apresentação de entrega do seminário](presentation/seminario-andamento-entrega.pptx)
- [Documento do seminário em PDF](output/pdf/seminario-andamento.pdf)
- [Versão editável do seminário](output/word/seminario-andamento-editavel.docx)
- [Sprint 1: problema, objetivos e requisitos](output/word/tcc-sprint-1-problema-objetivos-requisitos.docx)
- [Resultados parciais de software](research/testing/resultados-parciais-software.md)
- [Modelo de viabilidade econômica](analysis/modelo-viabilidade-economica.xlsx)

## Documentação de pesquisa

- [Protocolo da revisão](research/protocol/revisao-literatura.md)
- [Protocolo de entrevistas](research/protocol/entrevistas.md)
- [Especificação dos questionários estruturados](docs/superpowers/specs/2026-08-13-questionarios-entrevistas-escala-design.md)
- [Dicionário de dados](research/data/dicionario-dados.md)
- [Arquitetura e ameaças](research/architecture/arquitetura.md)
- [Matriz regulatória](research/regulatory/matriz-conformidade.md)
