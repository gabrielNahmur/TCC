import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Presentation,
  PresentationFile,
  layers,
  shape as artifactShape,
  table,
  text as artifactText,
} from "@oai/artifact-tool";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(HERE, "seminario-andamento.pptx");

const W = 1280;
const H = 720;
const INK = "#000000";
const PANEL = "#EDEDED";
const RULE = "#B8BCC4";
const ACCENT = "#6DCBF4";
const ACCENT_STRONG = "#3D8DFF";
const WHITE = "#FFFFFF";
const MUTED = "#4B5563";
const FONT = "Arial";

const ROOT = ".";

// Os módulos exatos da biblioteca Codex Grid declaram largura e altura ao lado
// de `position`. Este adaptador também aceita a forma compacta usada neste
// arquivo e normaliza os valores antes de materializar o nó Compose.
function shape(config) {
  const sourcePosition = config.position ?? {};
  const { width: positionWidth, height: positionHeight, ...position } = sourcePosition;
  const resolvedHeight = config.height ?? positionHeight;
  return artifactShape({
    ...config,
    position,
    width: config.width ?? positionWidth,
    height: resolvedHeight === 0 ? 0.03 : resolvedHeight,
  });
}

function text(content, config) {
  const sourcePosition = config.position ?? {};
  const { width: positionWidth, height: positionHeight, ...position } = sourcePosition;
  return artifactText(content, {
    ...config,
    position,
    width: config.width ?? positionWidth,
    height: config.height ?? positionHeight,
  });
}

function p(value, size = 20, options = {}) {
  return {
    runs: [
      {
        run: value,
        textStyle: {
          fontSize: `${size}px`,
          typeface: FONT,
          color: options.color ?? INK,
          bold: options.bold ?? false,
        },
      },
    ],
    spaceAfter: options.spaceAfter ?? 500,
    paragraphStyle: {
      lineSpacingPercent: options.lineSpacingPercent ?? 112000,
    },
  };
}

function titleNode(title, name = "slide-title") {
  return text([p(title, 42, { bold: true, lineSpacingPercent: 90000 })], {
    name,
    position: { left: 42, top: 34 },
    width: 1196,
    height: 98,
    style: {
      fontSize: "42px",
      typeface: FONT,
      color: INK,
      alignment: "left",
      verticalAlignment: "top",
      autoFit: "none",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  });
}

function footerNode(number) {
  return text([p(String(number).padStart(2, "0"), 16, { color: MUTED })], {
    name: `slide-number-${number}`,
    position: { left: 1178, top: 663 },
    width: 60,
    height: 24,
    style: {
      fontSize: "16px",
      typeface: FONT,
      color: MUTED,
      alignment: "right",
      verticalAlignment: "bottom",
      autoFit: "none",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  });
}

function addNotes(slide, body, sources) {
  const notes = [
    body.trim(),
    "",
    "[Sources]",
    ...sources.map((source) => `- ${source.replaceAll("\\", "/")}`),
  ].join("\n");
  slide.speakerNotes.textFrame.setText(notes);
  slide.speakerNotes.setVisible(true);
}

function addComposedSlide(presentation, number, nodes, notes, sources, layoutName) {
  const slide = presentation.slides.add();
  slide.background.fill = WHITE;
  slide.compose(
    layers(
      { name: `codex-grid-${layoutName}`, width: "fill", height: "fill" },
      nodes,
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 1 },
  );
  addNotes(slide, notes, sources);
  return slide;
}

function bodyBlock(title, body) {
  return [
    p(title, 26, { bold: true, spaceAfter: 900 }),
    p(body, 19, { color: MUTED, lineSpacingPercent: 118000 }),
  ];
}

function addTitleSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = WHITE;
  slide.compose(
    layers({ name: "codex-grid-slide-02-cover", width: "fill", height: "fill" }, [
      text([p("SEMINÁRIO DE ANDAMENTO", 22, { bold: true, color: ACCENT_STRONG })], {
        name: "cover-eyebrow",
        position: { left: 42, top: 42 },
        width: 520,
        height: 42,
        style: {
          fontSize: "22px",
          typeface: FONT,
          color: ACCENT_STRONG,
          alignment: "left",
          autoFit: "none",
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      }),
      text([p("IFSUL · TADS · CÂMPUS BAGÉ", 20, { color: MUTED })], {
        name: "cover-institution",
        position: { left: 828, top: 42 },
        width: 410,
        height: 42,
        style: {
          fontSize: "20px",
          typeface: FONT,
          color: MUTED,
          alignment: "right",
          autoFit: "none",
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      }),
      shape({
        name: "cover-accent-rule",
        geometry: "rect",
        fill: ACCENT,
        position: { left: 42, top: 176, width: 148, height: 8 },
      }),
      text(
        [
          p(
            "Prevenção de abastecimento incompatível por meio de consulta veicular e intertravamento de bicos",
            58,
            { bold: true, lineSpacingPercent: 92000 },
          ),
        ],
        {
          name: "cover-title",
          position: { left: 42, top: 214 },
          width: 1110,
          height: 310,
          style: {
            fontSize: "58px",
            typeface: FONT,
            color: INK,
            alignment: "left",
            verticalAlignment: "bottom",
            autoFit: "none",
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
      ),
      text([p("Gabriel Nahmur · Protótipo seguro de bancada", 22, { color: MUTED })], {
        name: "cover-author",
        position: { left: 42, top: 580 },
        width: 820,
        height: 48,
        style: {
          fontSize: "22px",
          typeface: FONT,
          color: MUTED,
          alignment: "left",
          autoFit: "none",
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      }),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 1 },
  );
  addNotes(
    slide,
    "Apresentar o trabalho como um protótipo acadêmico de bancada. Não informar nome do orientador nem data, pois esses metadados permanecem pendentes.",
    [`${ROOT}\\article\\metadados.tex`, `${ROOT}\\article\\main.tex`],
  );
}

function addContextSlide(presentation) {
  addComposedSlide(
    presentation,
    2,
    [
      titleNode("Um erro simples de seleção pode gerar uma cadeia de prejuízos"),
      shape({
        name: "context-left-accent",
        geometry: "rect",
        fill: ACCENT,
        position: { left: 42, top: 186, width: 8, height: 390 },
      }),
      text(bodyBlock("Problema observado", "Em uma rede de postos do sul do Brasil, há ocorrências em que o combustível selecionado não é compatível com o veículo. A identificação hoje depende da atenção humana."), {
        name: "context-problem",
        position: { left: 74, top: 186 },
        width: 520,
        height: 390,
        style: {
          fontSize: "24px",
          typeface: FONT,
          color: INK,
          alignment: "left",
          verticalAlignment: "top",
          autoFit: "none",
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      }),
      shape({
        name: "context-right-panel",
        geometry: "rect",
        fill: PANEL,
        position: { left: 658, top: 186, width: 580, height: 390 },
      }),
      text(
        [
          p("Consequências", 26, { bold: true, spaceAfter: 900 }),
          p("• interrupção da operação e atendimento ao cliente", 19),
          p("• diagnóstico, remoção e reparo do veículo", 19),
          p("• custo financeiro variável, ainda não consolidado", 19),
          p("• risco de decisão sob pressão no ponto de venda", 19),
        ],
        {
          name: "context-consequences",
          position: { left: 698, top: 222 },
          width: 500,
          height: 320,
          style: {
            fontSize: "19px",
            typeface: FONT,
            color: INK,
            alignment: "left",
            autoFit: "none",
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
      ),
      text([p("Nenhum valor de perda é assumido nesta etapa.", 18, { bold: true, color: ACCENT_STRONG })], {
        name: "context-no-invented-cost",
        position: { left: 42, top: 606 },
        width: 820,
        height: 34,
        style: {
          fontSize: "18px",
          typeface: FONT,
          color: ACCENT_STRONG,
          alignment: "left",
          autoFit: "none",
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      }),
    ],
    "Explicar que o problema é real no contexto empresarial, mas que custos e frequências só serão apresentados após consolidação documental. Relacionar o caso a fatores humanos e ambientais já discutidos na literatura sobre erros de abastecimento.",
    [
      "https://doi.org/10.1016/j.apergo.2006.10.008",
      `${ROOT}\\article\\sections\\01-introducao.tex`,
      `${ROOT}\\research\\data\\dicionario-dados.md`,
    ],
    "slide-05-two-column",
  );
}

function addQuestionSlide(presentation) {
  addComposedSlide(
    presentation,
    3,
    [
      titleNode("A pesquisa testa segurança funcional e viabilidade — sem antecipar conclusões"),
      text(
        [
          p("PERGUNTA DE PESQUISA", 18, { bold: true, color: ACCENT_STRONG, spaceAfter: 700 }),
          p("Como um sistema baseado em consulta veicular e intertravamento pode impedir a retirada do bico associado a um combustível incompatível em ambiente controlado, e em quais condições sua adoção apresenta viabilidade econômica para uma rede de postos?", 22, { bold: true, lineSpacingPercent: 112000 }),
        ],
        {
          name: "research-question",
          position: { left: 42, top: 146 },
          width: 1196,
          height: 174,
          style: {
            fontSize: "22px",
            typeface: FONT,
            color: INK,
            alignment: "left",
            autoFit: "none",
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
      ),
      shape({ name: "h1-panel", geometry: "rect", fill: PANEL, position: { left: 42, top: 360, width: 580, height: 238 } }),
      shape({ name: "h2-panel", geometry: "rect", fill: PANEL, position: { left: 658, top: 360, width: 580, height: 238 } }),
      text(bodyBlock("H1 · segurança", "Na matriz de bancada, impedir todas as aberturas incompatíveis das travas e nunca autorizar automaticamente uma trava diante de resposta inválida, ambígua ou indisponível."), {
        name: "h1-text",
        position: { left: 78, top: 394 },
        width: 508,
        height: 168,
        style: { fontSize: "19px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      text(bodyBlock("H2 · economia", "Em pelo menos um cenário de sensibilidade, as perdas evitáveis estimadas superarão o custo anualizado da solução."), {
        name: "h2-text",
        position: { left: 694, top: 394 },
        width: 508,
        height: 168,
        style: { fontSize: "19px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      text([p("STATUS · H1 e H2 permanecem abertas", 18, { bold: true, color: ACCENT_STRONG })], {
        name: "hypothesis-status",
        position: { left: 42, top: 618 },
        width: 760,
        height: 28,
        style: { fontSize: "18px", typeface: FONT, color: ACCENT_STRONG, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    ],
    "Ler a pergunta de forma literal. Destacar que os testes de software são resultados parciais e não bastam para concluir as hipóteses: H1 exige a matriz completa e ensaio físico; H2 exige dados e custos reais.",
    [`${ROOT}\\article\\sections\\01-introducao.tex`, `${ROOT}\\article\\sections\\10-avaliacao-resultados.tex`],
    "slide-09-question-callouts",
  );
}

function addObjectivesSlide(presentation) {
  const blocks = [
    [42, 186, "1 · Modelar", "Compatibilidades, estados e regras fail-closed."],
    [658, 186, "2 · Implementar", "Backend, PWA, simulador e gateway de dispositivo."],
    [42, 410, "3 · Avaliar", "Matriz de testes, falhas, expiração e repetição de ciclos."],
    [658, 410, "4 · Estimar", "Custos anualizados, perdas evitáveis e ponto de equilíbrio."],
  ];
  const nodes = [
    titleNode("O objetivo é construir evidência rastreável, não apenas um mecanismo"),
    text([p("Projetar, implementar e avaliar um protótipo que integre consulta veicular, controle de autorização e análise econômica com dados históricos pseudonimizados.", 21, { bold: true })], {
      name: "general-objective",
      position: { left: 42, top: 130 },
      width: 1196,
      height: 60,
      style: { fontSize: "21px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
  ];
  for (const [left, top, heading, body] of blocks) {
    nodes.push(
      shape({ name: `objective-panel-${heading[0]}`, geometry: "rect", fill: PANEL, position: { left, top, width: 580, height: 178 } }),
      text(bodyBlock(heading, body), {
        name: `objective-text-${heading[0]}`,
        position: { left: left + 32, top: top + 28 },
        width: 516,
        height: 126,
        style: { fontSize: "19px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    );
  }
  nodes.push(
    text([p("Contribuições esperadas: arquitetura desacoplada, trilha de auditoria e método de avaliação reaplicável.", 18, { color: ACCENT_STRONG, bold: true })], {
      name: "contributions",
      position: { left: 42, top: 618 },
      width: 1070,
      height: 30,
      style: { fontSize: "18px", typeface: FONT, color: ACCENT_STRONG, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
  );
  addComposedSlide(
    presentation,
    4,
    nodes,
    "Explicar que os quatro objetivos específicos conectam artefato, avaliação técnica e decisão econômica. As contribuições são propostas nesta fase e serão discutidas com base nos resultados finais.",
    [`${ROOT}\\article\\sections\\01-introducao.tex`, `${ROOT}\\article\\sections\\05-requisitos.tex`, `${ROOT}\\research\\architecture\\arquitetura.md`],
    "slide-13-four-points",
  );
}

function addFoundationSlide(presentation) {
  addComposedSlide(
    presentation,
    5,
    [
      titleNode("A base científica está definida; a busca sistemática ainda precisa ser executada"),
      text(
        [
          p("Eixos de fundamentação", 18, { bold: true, color: ACCENT_STRONG, spaceAfter: 700 }),
          p("Fatores humanos no erro de abastecimento; intertravamento fail-closed; Design Science Research; minimização de dados; segurança em áreas classificadas.", 20, { lineSpacingPercent: 116000 }),
        ],
        {
          name: "foundation-intro",
          position: { left: 42, top: 132 },
          width: 1196,
          height: 142,
          style: { fontSize: "20px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
        },
      ),
      shape({ name: "review-designed", geometry: "rect", fill: PANEL, position: { left: 42, top: 318, width: 580, height: 206 } }),
      shape({ name: "review-pending", geometry: "rect", fill: PANEL, position: { left: 658, top: 318, width: 580, height: 206 } }),
      text([p("PROTOCOLO DESENHADO", 24, { bold: true }), p("IEEE Xplore, ACM DL, Scopus e SciELO; strings; critérios; duplicatas; qualidade; extração e encadeamento.", 18, { color: MUTED })], {
        name: "review-designed-text",
        position: { left: 76, top: 350 },
        width: 510,
        height: 150,
        style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      text([p("BUSCAS PENDENTES", 24, { bold: true }), p("As quatro bases ainda não foram pesquisadas. Adams e David (2007) e Peffers et al. (2007) são apenas fontes-semente verificadas por metadados.", 18, { color: MUTED })], {
        name: "review-pending-text",
        position: { left: 692, top: 350 },
        width: 510,
        height: 150,
        style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      text([p("A revisão só produzirá resultados após triagem, leitura integral e registro reproduzível.", 19, { bold: true, color: ACCENT_STRONG })], {
        name: "review-status",
        position: { left: 42, top: 574 },
        width: 1080,
        height: 44,
        style: { fontSize: "19px", typeface: FONT, color: ACCENT_STRONG, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    ],
    "Distinguir fundamentação inicial de revisão concluída. A fonte de Adams investiga erros de abastecimento e a de Peffers fundamenta o método DSRM; nenhum número de triagem deve ser apresentado antes da execução das buscas.",
    [
      "https://doi.org/10.1016/j.apergo.2006.10.008",
      "https://doi.org/10.2753/MIS0742-1222240302",
      `${ROOT}\\research\\protocol\\revisao-literatura.md`,
      `${ROOT}\\research\\literature\\diario-buscas.md`,
      "https://www.gov.br/inmetro/pt-br/acesso-a-informacao/perguntas-frequentes/avaliacao-da-conformidade/equipamentos-eletricos-para-atmosferas-explosivas/qual-a-regulamentacao-vigente-aplicavel-para-equipamentos-eletricos-para-atmosferas-explosivas-importados-e-comercializados-em-territorio-nacional",
    ],
    "slide-11-review-status",
  );
}

function addMethodSlide(presentation) {
  addComposedSlide(
    presentation,
    6,
    [
      titleNode("Metodologia: problema, artefato e avaliação"),
      shape({ name: "method-line", geometry: "straightConnector1", fill: "none", line: { style: "solid", width: 2, fill: RULE }, position: { left: 92, top: 542, width: 1090, height: 0 } }),
      ...[
        [42, "1 · INVESTIGAR", "DSRM: problema e objetivos\n\nEstudo de caso e análise documental autorizada\n\nEntrevistas somente após autorização, orientação/CEP e consentimento", "Problema"],
        [452, "2 · CONSTRUIR", "Arquitetura desacoplada\n\nProvedor e dispositivo simulados\n\nProtótipo sem combustível e fora de área classificada", "Artefato"],
        [864, "3 · AVALIAR", "Matriz de compatibilidade e falhas\n\nCiclos de bancada\n\nAnálise econômica contrafactual e sensibilidade", "Evidência"],
      ].flatMap(([left, heading, body, label], index) => [
        shape({ name: `method-card-${index + 1}`, geometry: "rect", fill: PANEL, position: { left, top: 154, width: 374, height: 352 } }),
        text([p(heading, 24, { bold: true, color: index === 1 ? ACCENT_STRONG : INK }), p(body, 18, { color: MUTED, lineSpacingPercent: 120000 })], {
          name: `method-text-${index + 1}`,
          position: { left: left + 28, top: 184 },
          width: 318,
          height: 292,
          style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
        }),
        shape({ name: `method-dot-${index + 1}`, geometry: "ellipse", fill: index === 1 ? ACCENT_STRONG : INK, position: { left: left + 18, top: 534, width: 16, height: 16 } }),
        text([p(label, 18, { bold: true })], {
          name: `method-label-${index + 1}`,
          position: { left: left + 18, top: 568 },
          width: 260,
          height: 32,
          style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
        }),
      ]),
    ],
    "Mapear as etapas ao DSRM. Reforçar que as entrevistas e dados internos não começam sem os gates formais; o protótipo atual usa dados sintéticos e não opera com combustível.",
    [
      "https://doi.org/10.2753/MIS0742-1222240302",
      `${ROOT}\\article\\sections\\04-metodologia.tex`,
      `${ROOT}\\research\\protocol\\entrevistas.md`,
      `${ROOT}\\research\\protocol\\termo-consentimento-modelo.md`,
    ],
    "slide-18-method-cards",
  );
}

function addFlowSlide(presentation) {
  const rows = [
    ["01", "Frentista informa placa, produto solicitado, identificador lógico do conjunto e identificação operacional."],
    ["02", "Backend consulta provedor sintético ou autorizado e normaliza combustíveis compatíveis."],
    ["03", "Produto solicitado é comparado à lista compatível; códigos desconhecidos exigem revisão."],
    ["04", "Somente uma trava recebe autorização temporária; o ACK confirma comando e GPIO, não movimento mecânico."],
    ["05", "Resposta inválida, ambígua ou indisponível conduz a REVIEW_REQUIRED, sem abertura automática."],
    ["06", "Encerramento, expiração ou perda de comunicação executa LOCK_ALL; bico fora exige devolução manual."],
  ];
  const nodes = [titleNode("O fluxo autoriza uma única trava; falhas desenergizam todas as saídas")];
  rows.forEach(([index, label], i) => {
    const top = 148 + i * 78;
    nodes.push(
      shape({ name: `flow-rule-${i + 1}`, geometry: "rect", fill: i === 4 ? ACCENT : RULE, position: { left: 42, top: top + 62, width: 1196, height: 1 } }),
      text([p(index, 20, { bold: true, color: i === 4 ? ACCENT_STRONG : INK })], {
        name: `flow-index-${i + 1}`,
        position: { left: 42, top: top + 10 },
        width: 80,
        height: 36,
        style: { fontSize: "20px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      text([p(label, 19, { bold: i === 4 })], {
        name: `flow-label-${i + 1}`,
        position: { left: 142, top: top + 6 },
        width: 1010,
        height: 48,
        style: { fontSize: "19px", typeface: FONT, color: INK, alignment: "left", verticalAlignment: "middle", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    );
  });
  addComposedSlide(
    presentation,
    7,
    nodes,
    "Percorrer o caminho normal e depois destacar o caso de incerteza. O override é uma operação separada, autenticada e auditada; não transforma falha técnica em liberação automática.",
    [`${ROOT}\\research\\architecture\\arquitetura.md`, `${ROOT}\\prototype\\backend\\README.md`, `${ROOT}\\article\\sections\\06-arquitetura.tex`],
    "slide-03-process-list",
  );
}

function addArchitectureSlide(presentation) {
  const columns = [
    [42, "INTERAÇÃO", "React/PWA\n\nEntrada de placa e produto\n\nExibe decisão e exige reconciliação quando o resultado físico é desconhecido", "Sem credenciais no tablet"],
    [452, "DECISÃO", "FastAPI + PostgreSQL/SQLite no protótipo\n\nVehicleDataProvider\n\nRegras de compatibilidade, auditoria e override", "Placa não segue ao dispositivo"],
    [864, "INTERTRAVAMENTO", "Gateway de trava + MQTT\n\nESP32 na bancada\n\nLOCK_ALL ou UNLOCK(nozzle_id, ttl)", "Atua no suporte; não bombeia"],
  ];
  const nodes = [titleNode("A decisão fica no backend; o dispositivo recebe apenas comandos mínimos")];
  // Conectores primeiro, atrás dos nós.
  nodes.push(
    shape({ name: "arch-link-1", geometry: "straightConnector1", fill: "none", line: { style: "solid", width: 3, fill: ACCENT_STRONG }, position: { left: 416, top: 352, width: 36, height: 0 } }),
    shape({ name: "arch-link-2", geometry: "straightConnector1", fill: "none", line: { style: "solid", width: 3, fill: ACCENT_STRONG }, position: { left: 826, top: 352, width: 38, height: 0 } }),
  );
  columns.forEach(([left, heading, body, label], i) => {
    nodes.push(
      shape({ name: `arch-panel-${i + 1}`, geometry: "rect", fill: PANEL, position: { left, top: 164, width: 374, height: 374 } }),
      shape({ name: `arch-accent-${i + 1}`, geometry: "rect", fill: i === 1 ? ACCENT_STRONG : ACCENT, position: { left, top: 164, width: 374, height: 8 } }),
      text([p(heading, 24, { bold: true, color: i === 1 ? ACCENT_STRONG : INK }), p(body, 18, { color: MUTED, lineSpacingPercent: 120000 })], {
        name: `arch-text-${i + 1}`,
        position: { left: left + 28, top: 204 },
        width: 318,
        height: 290,
        style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      text([p(label, 18, { bold: true })], {
        name: `arch-label-${i + 1}`,
        position: { left: left + 8, top: 572 },
        width: 358,
        height: 48,
        style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "center", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    );
  });
  addComposedSlide(
    presentation,
    8,
    nodes,
    "Explicar o desacoplamento por adaptadores. O ESP32 controla somente a trava independente do suporte na bancada; não comanda bombeamento nem integra a automação da empresa. Em implantação real, componentes próximos ao abastecimento exigem análise de área classificada e conformidade aplicável.",
    [
      `${ROOT}\\research\\architecture\\arquitetura.md`,
      `${ROOT}\\prototype\\backend\\README.md`,
      `${ROOT}\\prototype\\firmware\\README.md`,
      "https://www.gov.br/inmetro/pt-br/acesso-a-informacao/perguntas-frequentes/avaliacao-da-conformidade/equipamentos-eletricos-para-atmosferas-explosivas/qual-a-regulamentacao-vigente-aplicavel-para-equipamentos-eletricos-para-atmosferas-explosivas-importados-e-comercializados-em-territorio-nacional",
    ],
    "slide-18-architecture",
  );
}

function addResultsSlide(presentation) {
  const cards = [
    [42, "95/95", "testes do backend", "90% de cobertura"],
    [452, "24/24", "testes da PWA", "build e auditoria concluídos"],
    [864, "3 artefatos", "bancada digital", "planta PWA + firmware + PICSimLab"],
  ];
  const nodes = [
    titleNode("Os resultados parciais confirmam o software — não a bancada física"),
    text([p("Verificação local em modo sintético, sem consulta real à SENATRAN e sem combustível.", 20, { bold: true })], {
      name: "results-scope",
      position: { left: 42, top: 132 },
      width: 1196,
      height: 42,
      style: { fontSize: "20px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
  ];
  cards.forEach(([left, stat, label, detail], i) => {
    nodes.push(
      shape({ name: `result-card-${i + 1}`, geometry: "rect", fill: PANEL, position: { left, top: 230, width: 374, height: 300 } }),
      text([p(stat, 48, { bold: true, color: i === 0 ? ACCENT_STRONG : INK })], {
        name: `result-stat-${i + 1}`,
        position: { left: left + 30, top: 282 },
        width: 314,
        height: 86,
        style: { fontSize: "48px", typeface: FONT, color: INK, alignment: "left", verticalAlignment: "bottom", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      text([p(label, 24, { bold: true }), p(detail, 18, { color: MUTED })], {
        name: `result-detail-${i + 1}`,
        position: { left: left + 30, top: 392 },
        width: 314,
        height: 102,
        style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    );
  });
  nodes.push(
    text([p("Também entregues: adaptador MQTT, workspace PICSimLab, protocolos, matriz de cenários e modelo econômico vazio.", 18, { color: MUTED })], {
      name: "results-artifacts",
      position: { left: 42, top: 564 },
      width: 1196,
      height: 36,
      style: { fontSize: "18px", typeface: FONT, color: MUTED, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
    text([p("H1 e H2 ainda não estão concluídas.", 20, { bold: true, color: ACCENT_STRONG })], {
      name: "results-open-hypotheses",
      position: { left: 42, top: 612 },
      width: 780,
      height: 32,
      style: { fontSize: "20px", typeface: FONT, color: ACCENT_STRONG, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
  );
  addComposedSlide(
    presentation,
    9,
    nodes,
    "Apresentar somente resultados reproduzíveis desta versão. O backend tem 95 testes aprovados e 90% de cobertura; a PWA tem 24 testes aprovados, incluindo retirada, devolução e falhas na planta visual; o firmware compila no host e no alvo PICSimLab, cujo workspace foi carregado. A integração MQTT ao vivo ainda precisa ser verificada nesta execução. Não chamar isso de validação física.",
    [
      `${ROOT}\\article\\sections\\08-implementacao.tex`,
      `${ROOT}\\article\\sections\\10-avaliacao-resultados.tex`,
      `${ROOT}\\prototype\\backend`,
      `${ROOT}\\prototype\\frontend`,
      `${ROOT}\\prototype\\firmware`,
      `${ROOT}\\research\\testing\\matriz-cenarios.csv`,
    ],
    "slide-19-results-metrics",
  );
}

function addEconomicSlide(presentation) {
  const scenarios = [
    [42, "25%", "conservador"],
    [350, "50%", "intermediário"],
    [658, "75%", "ampliado"],
    [966, "100%", "limite teórico"],
  ];
  const nodes = [
    titleNode("Viabilidade será avaliada por cenários — não como economia realizada"),
    text([p("Perda evitável estimada = custo histórico elegível, corrigido pelo IPCA × percentual de prevenção", 19, { bold: true })], {
      name: "economic-formula",
      position: { left: 42, top: 130 },
      width: 1196,
      height: 46,
      style: { fontSize: "19px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
  ];
  scenarios.forEach(([left, stat, label], i) => {
    nodes.push(
      shape({ name: `scenario-${i + 1}`, geometry: "rect", fill: i === 1 ? "#D0EDFA" : PANEL, position: { left, top: 218, width: 272, height: 142 } }),
      text([p(stat, 40, { bold: true, color: i === 1 ? ACCENT_STRONG : INK }), p(label, 18, { color: MUTED })], {
        name: `scenario-text-${i + 1}`,
        position: { left: left + 24, top: 246 },
        width: 224,
        height: 92,
        style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    );
  });
  const bottom = [
    [42, "CUSTO ANUALIZADO", "consultas + GCC + hardware + integração + infraestrutura + manutenção"],
    [452, "PERDAS EVITÁVEIS", "somente custos diretos comprovados; estimativas separadas"],
    [864, "PONTO DE EQUILÍBRIO", "primeiro cenário em que perdas evitáveis ≥ custo anualizado"],
  ];
  bottom.forEach(([left, heading, body], i) => {
    nodes.push(
      text([p(heading, 20, { bold: true, color: i === 2 ? ACCENT_STRONG : INK }), p(body, 18, { color: MUTED })], {
        name: `economic-input-${i + 1}`,
        position: { left, top: 418 },
        width: 374,
        height: 138,
        style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 20, bottom: 0, left: 0 } },
      }),
    );
  });
  nodes.push(
    text([p("STATUS · cálculo pendente de histórico autorizado, cotação da GCC, custos técnicos e série de IPCA.", 18, { bold: true, color: ACCENT_STRONG })], {
      name: "economic-status",
      position: { left: 42, top: 600 },
      width: 1140,
      height: 40,
      style: { fontSize: "18px", typeface: FONT, color: ACCENT_STRONG, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
  );
  addComposedSlide(
    presentation,
    10,
    nodes,
    "Explicar os quatro cenários sem mostrar valores monetários. A planilha foi construída para receber dados autorizados, corrigir valores, separar custos comprovados de estimativas e calcular o ponto de equilíbrio.",
    [
      `${ROOT}\\analysis\\modelo-viabilidade-economica.xlsx`,
      `${ROOT}\\analysis\\README.md`,
      `${ROOT}\\research\\data\\dicionario-dados.md`,
      "https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/portarias/2026/Portaria4172026.pdf",
    ],
    "slide-16-economic-scenarios",
  );
}

function addScheduleSlide(presentation) {
  const headers = ["S-8", "S-6", "S-4", "S-2", "S"];
  const nodes = [titleNode("O seminário fecha a base; a avaliação física continua depois")];
  headers.forEach((label, i) => {
    const left = 42 + i * 239.2;
    nodes.push(
      shape({ name: `schedule-header-${i + 1}`, geometry: "rect", fill: WHITE, line: { style: "solid", width: 1, fill: RULE }, position: { left, top: 146, width: 239.2, height: 52 } }),
      text([p(label, 18, { bold: true })], {
        name: `schedule-header-text-${i + 1}`,
        position: { left: left + 16, top: 160 },
        width: 206,
        height: 28,
        style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    );
  });
  const bars = [
    [54, 218, 432, "Regras · protocolo · autorizações"],
    [284, 278, 478, "Redação · fundamentação · revisão inicial"],
    [284, 338, 716, "Dados autorizados · requisitos · simulador"],
    [522, 398, 472, "Testes parciais · análise econômica"],
    [762, 458, 448, "Revisão do orientador · correções"],
    [1000, 518, 210, "Slides · ensaio"],
  ];
  bars.forEach(([left, top, width, label], i) => {
    nodes.push(
      shape({ name: `schedule-bar-${i + 1}`, geometry: "rect", fill: i === 5 ? "#D0EDFA" : PANEL, position: { left, top, width, height: 44 } }),
      text([p(label, 17, { bold: i === 5, color: i === 5 ? ACCENT_STRONG : INK })], {
        name: `schedule-label-${i + 1}`,
        position: { left: left + 16, top: top + 10 },
        width: width - 26,
        height: 28,
        style: { fontSize: "17px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
    );
  });
  nodes.push(
    shape({ name: "post-seminar-band", geometry: "rect", fill: ACCENT, position: { left: 54, top: 586, width: 1156, height: 52 } }),
    text([p("PÓS-SEMINÁRIO · bancada física · integração autorizada · avaliação completa · TCC final", 18, { bold: true })], {
      name: "post-seminar-label",
      position: { left: 76, top: 601 },
      width: 1110,
      height: 28,
      style: { fontSize: "18px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    }),
  );
  addComposedSlide(
    presentation,
    11,
    nodes,
    "Apresentar as semanas como referência relativa. Substituir por datas somente quando a instituição confirmar o seminário. O pós-seminário concentra bancada, eventual integração autorizada e avaliação final.",
    [`${ROOT}\\research\\project\\roadmap.md`, `${ROOT}\\article\\sections\\11-cronograma.tex`],
    "slide-24-gantt",
  );
}

function addClosingSlide(presentation) {
  const slide = presentation.slides.add();
  slide.background.fill = WHITE;
  slide.compose(
    layers({ name: "codex-grid-slide-26-closing", width: "fill", height: "fill" }, [
      text([p("SÍNTESE", 22, { bold: true, color: ACCENT_STRONG })], {
        name: "closing-eyebrow",
        position: { left: 42, top: 42 },
        width: 240,
        height: 40,
        style: { fontSize: "22px", typeface: FONT, color: ACCENT_STRONG, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      text([p("O protótipo já é verificável; a evidência decisiva ainda precisa ser produzida", 60, { bold: true, lineSpacingPercent: 92000 })], {
        name: "closing-title",
        position: { left: 42, top: 166 },
        width: 1090,
        height: 288,
        style: { fontSize: "60px", typeface: FONT, color: INK, alignment: "left", verticalAlignment: "bottom", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      }),
      shape({ name: "closing-accent", geometry: "rect", fill: ACCENT, position: { left: 42, top: 502, width: 116, height: 8 } }),
      text(
        [
          p("Agora · software e documentação em modo sintético", 20, { bold: true }),
          p("Próximos gates · ética, dados autorizados e bancada aprovada", 20, { bold: true }),
          p("Conclusão responsável · H1 e H2 somente após a avaliação completa", 20, { bold: true, color: ACCENT_STRONG }),
        ],
        {
          name: "closing-gates",
          position: { left: 42, top: 540 },
          width: 980,
          height: 112,
          style: { fontSize: "20px", typeface: FONT, color: INK, alignment: "left", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 } },
        },
      ),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 1 },
  );
  addNotes(
    slide,
    "Encerrar retomando o compromisso central: há um protótipo de software e uma arquitetura de segurança verificáveis, mas a resposta científica depende das autorizações, dados e ensaios ainda pendentes.",
    [
      `${ROOT}\\article\\sections\\10-avaliacao-resultados.tex`,
      `${ROOT}\\article\\sections\\12-limitacoes.tex`,
      `${ROOT}\\article\\sections\\14-conclusao.tex`,
      `${ROOT}\\research\\project\\roadmap.md`,
    ],
  );
}

async function main() {
  await fs.mkdir(HERE, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  addTitleSlide(presentation);
  addContextSlide(presentation);
  addQuestionSlide(presentation);
  addObjectivesSlide(presentation);
  addFoundationSlide(presentation);
  addMethodSlide(presentation);
  addFlowSlide(presentation);
  addArchitectureSlide(presentation);
  addResultsSlide(presentation);
  addEconomicSlide(presentation);
  addScheduleSlide(presentation);
  addClosingSlide(presentation);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUTPUT);
  process.stdout.write(`Deck exportado: ${OUTPUT}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
