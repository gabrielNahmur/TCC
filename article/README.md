# Artigo do TCC

Base LaTeX do TCC de TADS/IFSul, Câmpus Bagé. O projeto usa o estilo divulgado
no template institucional, derivado do modelo SBC.

## Documentos principais

- `main.tex`: manuscrito completo do TCC.
- `seminario-andamento.tex`: recorte específico do Seminário de Andamento,
  contendo contextualização, objetivos, referencial teórico, revisão de
  literatura, metodologia parcial, documentos de análise e projeto e
  cronograma.
- `../output/pdf/seminario-andamento.pdf`: PDF compilado para entrega e revisão.

Os dois documentos reutilizam as mesmas seções, metadados e referências. Assim,
correções feitas nas seções do artigo permanecem sincronizadas com o seminário.

## Antes de enviar

1. Preencha os dados confirmados em `metadados.tex`.
2. Procure por `PENDENTE`, substitua somente o que possuir evidência e mantenha
   os marcadores restantes na versão de trabalho.
3. Atualize o diário e a matriz da revisão em `../research/literature/`.
4. Revalide preço, regras SENATRAN/GCC e norma institucional na data da entrega.
5. Não versione placas, dados pessoais, credenciais, certificados ou documentos
   internos da empresa.
6. Compile, leia o log, abra o PDF e confira visualmente todas as páginas.

## Compilação

No Overleaf, selecione `main.tex` para o artigo completo ou
`seminario-andamento.tex` para o documento do seminário.

Com uma distribuição TeX local:

```powershell
latexmk -pdf -interaction=nonstopmode -halt-on-error seminario-andamento.tex
```

Alternativa manual:

```powershell
pdflatex -interaction=nonstopmode -halt-on-error seminario-andamento.tex
bibtex seminario-andamento
pdflatex -interaction=nonstopmode -halt-on-error seminario-andamento.tex
pdflatex -interaction=nonstopmode -halt-on-error seminario-andamento.tex
```

Os arquivos-fonte LaTeX e BibTeX são a fonte oficial versionada; o PDF é o
artefato compilado.
