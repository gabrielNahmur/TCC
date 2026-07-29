# Artigo do TCC

Base LaTeX para o Seminário de Andamento do TADS/IFSul, Câmpus Bagé. O projeto
usa o estilo divulgado no template institucional, derivado do modelo SBC.

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

No Overleaf, defina `main.tex` como documento principal. Localmente, com uma
distribuição TeX instalada:

```powershell
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
```

Alternativa manual:

```powershell
pdflatex -interaction=nonstopmode -halt-on-error main.tex
bibtex main
pdflatex -interaction=nonstopmode -halt-on-error main.tex
pdflatex -interaction=nonstopmode -halt-on-error main.tex
```

O PDF é artefato de compilação. Os arquivos-fonte LaTeX e BibTeX constituem a
fonte oficial versionada.
