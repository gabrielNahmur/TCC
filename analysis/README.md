# Modelo de dados e viabilidade economica

O arquivo `modelo-viabilidade-economica.xlsx` e um instrumento de coleta e
analise, nao uma base com dados reais. Celulas azuis sao entradas; celulas
cinzas ou verdes sao formulas/saidas.

Antes de preencher:

1. pseudonimizar a base de trabalho, remover nomes, placas, clientes e
   funcionarios e guardar eventual tabela de ligacao separada e restrita;
2. manter os documentos comprobatórios no ambiente corporativo autorizado;
3. preencher a aba `IPCA` com a serie oficial e sua URL;
4. registrar tarifa GCC e custos somente quando houver proposta/evidencia;
5. nao misturar custos realizados com estimativas;
6. validar a mesma cobertura temporal para ocorrencias e abastecimentos.

Datas, unidades e custos raros ainda podem permitir reidentificacao. Por isso,
textos livres exigem revisao humana, o acesso deve ser restrito e a publicacao
deve usar apenas agregados com supressao de grupos pequenos. Responsavel,
finalidade, base legal, perfis de acesso, retencao e descarte serao definidos
antes da coleta.

O construtor `build_model.mjs` permite reproduzir a pasta de trabalho vazia.
Ele requer o runtime de planilhas disponibilizado pelo Codex.
