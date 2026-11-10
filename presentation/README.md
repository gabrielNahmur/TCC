# Seminário de Andamento

Apresentações editáveis do Seminário de Andamento do TCC. O conteúdo distingue
resultados observados, projeções e atividades pendentes. Não há nome de
orientador, data oficial, valores financeiros inventados ou alegação de teste
físico.

## Arquivos

- `seminario-andamento.pptx`: versão modular completa, com 12 lâminas.
- `seminario-andamento-entrega.pptx`: versão focada nos seis conteúdos exigidos,
  com 10 lâminas.
- `seminario-entrega-frame-map.json`: mapa reproduzível das lâminas reutilizadas
  da apresentação modular.
- `build-deck.mjs`: fonte da versão modular, construída com
  `@oai/artifact-tool` e a linguagem visual Codex Grid.

A versão de entrega preserva as lâminas 1 a 8, 11 e 12 da versão modular. Foram
omitidas as lâminas de resultados parciais de software e análise econômica
detalhada porque não integram o recorte mínimo informado para esta entrega.

## Reconstrução da versão modular

Com `@oai/artifact-tool` disponível no runtime, execute a partir da raiz do
repositório:

```powershell
node ./presentation/build-deck.mjs
```

O arquivo `seminario-entrega-frame-map.json` registra como derivar a versão de
entrega sem rediagramar ou reescrever o conteúdo.

## Validação

Renderize as lâminas e confira as margens. Se o runtime oferecer os utilitários
`render_slides.py` e `slides_test.py`, aponte ambos para o PPTX de entrega:

```powershell
python /caminho/dos/utilitarios/render_slides.py ./presentation/seminario-andamento-entrega.pptx
python /caminho/dos/utilitarios/slides_test.py ./presentation/seminario-andamento-entrega.pptx
```

Cada lâmina possui notas do apresentador e um bloco `[Sources]` para a
rastreabilidade das afirmações não triviais.

No runtime Windows atual, a ferramenta de renderização pode encerrar com código
diferente de zero depois de produzir corretamente todos os PNGs. Nesse caso, a
verificação é concluída aplicando `slides_test.inspect_images` aos renders do
deck ampliado, com os mesmos parâmetros do utilitário.
