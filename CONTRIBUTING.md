# Contribuindo com o TCC

## Fluxo

1. Relacione a alteracao a uma tarefa `TCC-n`.
2. Trabalhe em mudanca pequena e revisavel.
3. Execute os testes do componente e compile o artigo quando houver alteracao
   em LaTeX ou bibliografia.
4. Separe fatos observados, simulacoes, projecoes e propostas.
5. Registre a fonte de toda afirmacao nova relevante.

## Dados e segredos

Nunca inclua no Git, Jira, logs de teste ou capturas:

- placas reais;
- nome, CPF, Renavam, chassi ou resposta bruta de titular;
- certificado, chave privada, senha, token ou arquivo `.env` real;
- transcricao identificavel ou termo de consentimento assinado;
- documentos financeiros brutos da empresa.

Os testes devem usar apenas dados sinteticos. Uma chave ou dado real exposto
deve ser tratado como incidente: interromper o uso, revogar/rotacionar, remover
do historico por procedimento aprovado e documentar o ocorrido.

## Artigo

- Use BibTeX e confirme DOI, autores, ano, titulo e veiculo de publicacao.
- Materiais comerciais nao substituem artigos cientificos.
- Uma referencia deve sustentar exatamente a frase que a cita.
- Numeros corporativos exigem origem, periodo, cobertura e anonimizacao.
- Nao preencha lacunas com valores plausiveis.
