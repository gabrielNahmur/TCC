# Seminário de Andamento

Apresentação modular de 12 lâminas para o Seminário de Andamento do TCC. O conteúdo separa resultados já observados, projeções e atividades ainda pendentes. Não há nome de orientador, data oficial, valores financeiros inventados ou alegação de teste físico.

## Arquivos

- `seminario-andamento.pptx`: apresentação final editável.
- `build-deck.mjs`: fonte em JavaScript ES modules, construída com `@oai/artifact-tool` e a linguagem visual Codex Grid.

## Reconstrução

O runtime `@oai/artifact-tool` é fornecido pelo ambiente Codex. Para preparar o vínculo local e reconstruir o arquivo:

```powershell
node "C:\Users\confi\.codex\plugins\cache\openai-primary-runtime\presentations\26.727.11326\skills\presentations\container_tools\setup_artifact_tool_workspace.mjs" --workspace "C:\Users\confi\OneDrive - GBI COMBUSTIVEIS LTDA\Documentos\TCC\presentation"
node "C:\Users\confi\OneDrive - GBI COMBUSTIVEIS LTDA\Documentos\TCC\presentation\build-deck.mjs"
```

## Validação

O PPTX deve ser renderizado integralmente e verificado com os utilitários da skill Presentations:

```powershell
& "C:\Users\confi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" "C:\Users\confi\.codex\plugins\cache\openai-primary-runtime\presentations\26.727.11326\skills\presentations\container_tools\render_slides.py" "C:\Users\confi\OneDrive - GBI COMBUSTIVEIS LTDA\Documentos\TCC\presentation\seminario-andamento.pptx"
& "C:\Users\confi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" "C:\Users\confi\.codex\plugins\cache\openai-primary-runtime\presentations\26.727.11326\skills\presentations\container_tools\slides_test.py" "C:\Users\confi\OneDrive - GBI COMBUSTIVEIS LTDA\Documentos\TCC\presentation\seminario-andamento.pptx"
```

Cada lâmina contém notas do apresentador com um bloco `[Sources]` para rastreabilidade de afirmações não triviais.

O relatório da última verificação está em `qa-report.txt`. No runtime Windows atual, o processo Node pode encerrar depois de produzir corretamente os PNGs; nesse caso, o teste de margens é concluído aplicando `slides_test.inspect_images` aos 12 renders do deck ampliado, exatamente com os mesmos parâmetros do utilitário.
