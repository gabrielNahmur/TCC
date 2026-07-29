# Matriz regulatoria e contratual

**Data-base inicial:** 2026-07-29. Revalidar antes do seminario e da analise
economica final.

| Tema | Evidencia atual | Estado | Acao antes do uso real |
|---|---|---|---|
| Produto de consulta | Consulta Online SENATRAN / WS-SENATRAN | confirmado documentalmente | validar contrato e Swagger liberado |
| Campo combustivel | codigo e descricao na consulta detalhada | confirmado no inventario Serpro | solicitar somente campos necessarios |
| Preco Serpro | R$ 1,62 no primeiro nivel da consulta detalhada | referencia publica, sujeita a atualizacao | recalcular por volume na data da analise |
| R$ 0,80 | faixa de 2.000.001 a 2.500.000 consultas detalhadas | nao aplicavel por padrao ao prototipo | nao usar como preco unitario base |
| GCC | contrato obrigatorio no acesso direto | fluxo normativo | obter tarifa, SLA, DPA e termo vigente |
| Base legal/ciencia | depende do caso de uso aprovado | pendente | validar com encarregado, GCC e SENATRAN |
| Motorista x titular | podem ser pessoas diferentes | risco aberto | impedir dependencia operacional nao aprovada |
| Credenciais | e-CNPJ/certificado e identificacao do usuario | pendente | manter fora do repositorio e usar homologacao |
| Retencao | nao definida no material comercial | pendente | aprovar politica antes de persistir qualquer dado |
| Area classificada | exige engenharia e certificacao aplicavel | fora do escopo da bancada | integrador/fabricante para piloto real |

## Documentos a solicitar da GCC

- termo de credenciamento assinado e vigente;
- proposta comercial completa e regra de faturamento;
- SLA, suporte e processo de indisponibilidade;
- DPA/matriz de responsabilidades LGPD;
- retencao, descarte e atendimento a titulares;
- resposta a incidentes e notificacoes;
- evidencias e escopo das certificacoes informadas;
- documentacao da integracao e ambientes de homologacao/producao.

## Fontes oficiais iniciais

- https://centraldeajuda.serpro.gov.br/consultasenatran/documentacao/
- https://centraldeajuda.serpro.gov.br/consultasenatran/veiculo/
- https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/portarias/2025/Portaria1392025.pdf
- https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/portarias/2026/Portaria4172026.pdf
- https://www.gov.br/inmetro/pt-br/acesso-a-informacao/perguntas-frequentes/avaliacao-da-conformidade/equipamentos-eletricos-para-atmosferas-explosivas/qual-a-regulamentacao-vigente-aplicavel-para-equipamentos-eletricos-para-atmosferas-explosivas-importados-e-comercializados-em-territorio-nacional
