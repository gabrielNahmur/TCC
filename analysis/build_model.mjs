import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repoRoot = path.resolve(import.meta.dirname, "..");
const analysisDir = path.join(repoRoot, "analysis");
const qaDir = path.join(repoRoot, "tmp", "spreadsheets");
const outputDir = path.join(
  repoRoot,
  "outputs",
  "019faf0f-7b18-7ab3-aaca-3fa4e53849cd",
);

await fs.mkdir(analysisDir, { recursive: true });
await fs.mkdir(qaDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const wb = Workbook.create();
const instructions = wb.worksheets.add("Instrucoes");
const occurrences = wb.worksheets.add("Ocorrencias");
const denominators = wb.worksheets.add("Abastecimentos");
const ipca = wb.worksheets.add("IPCA");
const assumptions = wb.worksheets.add("Premissas");
const analysis = wb.worksheets.add("Analise");
const checks = wb.worksheets.add("Checks");
const sources = wb.worksheets.add("Fontes");

wb.comments.setSelf({ displayName: "Gabriel Amarom" });

const colors = {
  navy: "#16324F",
  blue: "#2F75B5",
  lightBlue: "#DCEAF7",
  green: "#D9EAD3",
  darkGreen: "#38761D",
  amber: "#FFF2CC",
  red: "#F4CCCC",
  gray: "#E7E6E6",
  darkGray: "#595959",
  white: "#FFFFFF",
};

function title(sheet, text, subtitle, lastColumn) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${lastColumn}1`).merge();
  sheet.getRange("A1").values = [[text]];
  sheet.getRange(`A1:${lastColumn}1`).format = {
    fill: colors.navy,
    font: { bold: true, color: colors.white, size: 16 },
    verticalAlignment: "center",
  };
  sheet.getRange(`A1:${lastColumn}1`).format.rowHeight = 30;
  sheet.getRange(`A2:${lastColumn}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A2:${lastColumn}2`).format = {
    fill: colors.lightBlue,
    font: { color: colors.navy, italic: true },
    wrapText: true,
    verticalAlignment: "center",
  };
  sheet.getRange(`A2:${lastColumn}2`).format.rowHeight = 34;
}

function header(range) {
  range.format = {
    fill: colors.blue,
    font: { bold: true, color: colors.white },
    wrapText: true,
    verticalAlignment: "center",
    borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
  };
  range.format.rowHeight = 32;
}

function inputStyle(range) {
  range.format = {
    fill: colors.lightBlue,
    font: { color: colors.navy },
    borders: { preset: "outside", style: "thin", color: "#9EADBA" },
  };
}

function outputStyle(range) {
  range.format = {
    fill: colors.green,
    font: { color: colors.darkGreen, bold: true },
    borders: { preset: "outside", style: "thin", color: "#93B587" },
  };
}

// Instructions
title(
  instructions,
  "Modelo de ocorrencias e viabilidade economica",
  "Modelo vazio e auditavel. Nao inserir placas, nomes, CPF, chassi, Renavam ou dados do titular.",
  "H",
);
instructions.getRange("A4:B12").values = [
  ["Etapa", "Instrucao"],
  ["1", "Colete somente ocorrencias autorizadas e pseudonimizadas; publique apenas agregados com supressao de grupos pequenos."],
  ["2", "Mantenha cada custo em sua categoria e use apenas valores comprovados."],
  ["3", "Preencha o total de abastecimentos por periodo somente quando a fonte cobrir a mesma populacao."],
  ["4", "Carregue o IPCA oficial por mes e informe o indice da data-base em Premissas."],
  ["5", "Preencha tarifas e custos da solucao com contrato, proposta ou fonte identificada."],
  ["6", "Analise calcula cenarios; eles nao representam economia observada."],
  ["7", "Checks deve permanecer PASS antes de usar resultados no artigo."],
  ["8", "Revise todos os textos livres contra identificadores; registros excluidos permanecem com motivo."],
];
header(instructions.getRange("A4:B4"));
instructions.getRange("A5:A12").format.horizontalAlignment = "center";
instructions.getRange("A4:A12").format.columnWidth = 12;
instructions.getRange("B4:B12").format.columnWidth = 92;
instructions.getRange("B5:B12").format.wrapText = true;
instructions.getRange("B5:B12").format.rowHeight = 32;
instructions.getRange("A14:H15").merge();
instructions.getRange("A14").values = [[
  "IMPORTANTE: resultados permanecem vazios ou zerados ate que dados e premissas sejam preenchidos e validados. Nao use numeros de exemplo no artigo.",
]];
instructions.getRange("A14:H15").format = {
  fill: colors.amber,
  font: { bold: true, color: "#7F6000" },
  wrapText: true,
  verticalAlignment: "center",
  borders: { preset: "outside", style: "medium", color: "#BF9000" },
};

// Occurrences
title(
  occurrences,
  "Ocorrencias pseudonimizadas",
  "Acesso restrito. Uma linha por ocorrencia; publicacao somente agregada. Linhas azuis sao entradas.",
  "U",
);
const occurrenceHeaders = [
  "id_ocorrencia",
  "data_ocorrencia",
  "ano",
  "unidade_codigo",
  "combustivel_veiculo",
  "combustivel_abastecido",
  "fase_deteccao",
  "fonte_registro",
  "custo_remocao",
  "custo_reparo",
  "custo_reboque",
  "custo_reembolso",
  "outros_custos_diretos",
  "descricao_outros",
  "valor_total_documentado",
  "indice_ipca_evento",
  "indice_ipca_data_base",
  "valor_corrigido",
  "status_validacao",
  "motivo_exclusao",
  "observacao_revisada",
];
occurrences.getRange("A4:U4").values = [occurrenceHeaders];
header(occurrences.getRange("A4:U4"));
occurrences.getRange("C5").formulas = [["=IF(B5=\"\",\"\",YEAR(B5))"]];
occurrences.getRange("C5:C204").fillDown();
occurrences.getRange("O5").formulas = [["=IF(COUNTA(I5:M5)=0,\"\",SUM(I5:M5))"]];
occurrences.getRange("O5:O204").fillDown();
occurrences.getRange("P5").formulas = [["=IFERROR(VLOOKUP(TEXT(B5,\"yyyy-mm\"),'IPCA'!$A$5:$B$244,2,FALSE),\"\")"]];
occurrences.getRange("P5:P204").fillDown();
occurrences.getRange("Q5").formulas = [["=IF('Premissas'!$B$7=\"\",\"\",'Premissas'!$B$7)"]];
occurrences.getRange("Q5:Q204").fillDown();
occurrences.getRange("R5").formulas = [["=IF(OR(O5=\"\",P5=\"\",Q5=\"\"),\"\",O5*Q5/P5)"]];
occurrences.getRange("R5:R204").fillDown();
inputStyle(occurrences.getRange("A5:B204"));
inputStyle(occurrences.getRange("D5:N204"));
inputStyle(occurrences.getRange("S5:U204"));
occurrences.getRange("C5:C204").format.fill = colors.gray;
occurrences.getRange("O5:R204").format.fill = colors.gray;
occurrences.getRange("B5:B204").format.numberFormat = "yyyy-mm-dd";
occurrences.getRange("I5:O204").format.numberFormat = "R$ #,##0.00;[Red](R$ #,##0.00);-";
occurrences.getRange("P5:Q204").format.numberFormat = "0.0000";
occurrences.getRange("R5:R204").format.numberFormat = "R$ #,##0.00;[Red](R$ #,##0.00);-";
occurrences.getRange("E5:E204").dataValidation = { rule: { type: "list", values: ["Gasolina", "Etanol/Flex", "Diesel", "Hibrido", "Eletrico", "Convertido", "Desconhecido"] } };
occurrences.getRange("F5:F204").dataValidation = { rule: { type: "list", values: ["Gasolina", "Etanol", "Diesel S10", "Diesel S500", "GNV", "Outro"] } };
occurrences.getRange("G5:G204").dataValidation = { rule: { type: "list", values: ["Antes de ligar", "Apos ligar", "Apos sair", "Desconhecida"] } };
occurrences.getRange("H5:H204").dataValidation = { rule: { type: "list", values: ["Financeiro", "Ocorrencia operacional", "Oficina", "Outro"] } };
occurrences.getRange("S5:S204").dataValidation = { rule: { type: "list", values: ["Pendente", "Validado", "Excluido"] } };
occurrences.getRange("S5:S204").conditionalFormats.add("containsText", { text: "Excluido", format: { fill: colors.red, font: { color: "#990000" } } });
occurrences.getRange("S5:S204").conditionalFormats.add("containsText", { text: "Validado", format: { fill: colors.green, font: { color: colors.darkGreen } } });
occurrences.tables.add("A4:U204", true, "tblOcorrencias").style = "TableStyleMedium2";
occurrences.freezePanes.freezeRows(4);
occurrences.getRange("A:U").format.columnWidth = 15;
occurrences.getRange("A:A").format.columnWidth = 18;
occurrences.getRange("N:N").format.columnWidth = 24;
occurrences.getRange("T:U").format.columnWidth = 28;
occurrences.getRange("A4:U204").format.wrapText = true;

// Denominators
title(
  denominators,
  "Abastecimentos por periodo",
  "Use apenas totais que tenham a mesma cobertura das ocorrencias analisadas.",
  "F",
);
denominators.getRange("A4:F4").values = [[
  "periodo_inicio",
  "periodo_fim",
  "unidade_codigo",
  "quantidade_abastecimentos",
  "fonte_total",
  "status_validacao",
]];
header(denominators.getRange("A4:F4"));
inputStyle(denominators.getRange("A5:F104"));
denominators.getRange("A5:B104").format.numberFormat = "yyyy-mm-dd";
denominators.getRange("D5:D104").format.numberFormat = "#,##0";
denominators.getRange("F5:F104").dataValidation = { rule: { type: "list", values: ["Pendente", "Validado", "Excluido"] } };
denominators.tables.add("A4:F104", true, "tblAbastecimentos").style = "TableStyleMedium2";
denominators.freezePanes.freezeRows(4);
denominators.getRange("A:F").format.columnWidth = 22;

// IPCA
title(ipca, "Serie IPCA", "Preencher com indice oficial por mes; nao inserir variacao percentual no lugar do numero-indice.", "D");
ipca.getRange("A4:D4").values = [["mes_yyyy_mm", "numero_indice", "fonte_url", "data_acesso"]];
header(ipca.getRange("A4:D4"));
inputStyle(ipca.getRange("A5:D244"));
ipca.getRange("A5:A244").format.numberFormat = "@";
ipca.getRange("B5:B244").format.numberFormat = "0.0000";
ipca.getRange("D5:D244").format.numberFormat = "yyyy-mm-dd";
ipca.tables.add("A4:D244", true, "tblIPCA").style = "TableStyleMedium2";
ipca.freezePanes.freezeRows(4);
ipca.getRange("A:A").format.columnWidth = 18;
ipca.getRange("B:B").format.columnWidth = 18;
ipca.getRange("C:C").format.columnWidth = 72;
ipca.getRange("D:D").format.columnWidth = 18;

// Assumptions
title(assumptions, "Premissas do modelo", "Celulas azuis exigem fonte ou identificacao explicita como hipotese de sensibilidade.", "G");
assumptions.getRange("A4:G4").values = [["premissa", "valor", "unidade", "tipo", "fonte", "data_base", "observacao"]];
header(assumptions.getRange("A4:G4"));
assumptions.getRange("A5:G15").values = [
  ["Tarifa Serpro - consulta detalhada", 1.62, "R$/consulta", "Fonte publica", "Portaria SENATRAN 417/2026", new Date("2026-07-29"), "Primeiro nivel de volume; revalidar"],
  ["Tarifa GCC", null, "R$/consulta", "Pendente", "Proposta/contrato GCC", null, "Nao assumir zero no resultado final"],
  ["Indice IPCA da data-base", null, "numero-indice", "Pendente", "IBGE/SIDRA", null, "Usado para corrigir as ocorrencias"],
  ["Consultas mensais", null, "consultas/mes", "Entrada", "Operacao da empresa", null, "Uma consulta por sessao; cache desabilitado"],
  ["Quantidade de unidades", null, "unidades", "Entrada", "Escopo de implantacao", null, null],
  ["Hardware por unidade", null, "R$/unidade", "Pendente", "Cotacao", null, null],
  ["Integracao e instalacao inicial", null, "R$", "Pendente", "Cotacao", null, null],
  ["Desenvolvimento inicial", null, "R$", "Pendente", "Estimativa aprovada", null, null],
  ["Operacao e manutencao mensal", null, "R$/mes", "Pendente", "Estimativa aprovada", null, null],
  ["Horizonte de anualizacao", 3, "anos", "Hipotese", "Plano de pesquisa", new Date("2026-07-29"), "Apresentar tambem custo nao anualizado"],
  ["Anos cobertos pelas ocorrencias", null, "anos", "Calculado/validado", "Base de ocorrencias", null, "Preencher apos validar cobertura"],
];
inputStyle(assumptions.getRange("B5:B15"));
assumptions.getRange("F5:F15").format.numberFormat = "yyyy-mm-dd";
assumptions.getRange("B5:B6").format.numberFormat = "R$ #,##0.00";
assumptions.getRange("B7:B7").format.numberFormat = "0.0000";
assumptions.getRange("B8:B9").format.numberFormat = "#,##0";
assumptions.getRange("B10:B13").format.numberFormat = "R$ #,##0.00";
assumptions.getRange("B14:B15").format.numberFormat = "0.0";
assumptions.getRange("A:A").format.columnWidth = 38;
assumptions.getRange("B:B").format.columnWidth = 18;
assumptions.getRange("C:D").format.columnWidth = 20;
assumptions.getRange("E:E").format.columnWidth = 34;
assumptions.getRange("F:F").format.columnWidth = 16;
assumptions.getRange("G:G").format.columnWidth = 38;
assumptions.getRange("A4:G15").format.wrapText = true;
assumptions.getRange("A5:G15").format.rowHeight = 30;
assumptions.tables.add("A4:G15", true, "tblPremissas").style = "TableStyleMedium2";

wb.comments.addThread({ cell: assumptions.getRange("B5") }, "Fonte: https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/portarias/2026/Portaria4172026.pdf | Acesso: 2026-07-29 | Revalidar antes da analise final.");
wb.comments.addThread({ cell: assumptions.getRange("B7") }, "Preencher com o numero-indice oficial do IPCA referente a data-base, citando a tabela SIDRA usada.");

// Analysis
title(analysis, "Analise economica", "Saidas calculadas; cenarios nao equivalem a economia observada.", "H");
analysis.getRange("A4:B4").values = [["Indicador historico", "Valor"]];
header(analysis.getRange("A4:B4"));
analysis.getRange("A5:A10").values = [
  ["Ocorrencias validadas"],
  ["Custo nominal validado"],
  ["Custo corrigido validado"],
  ["Custo medio corrigido por ocorrencia"],
  ["Anos cobertos"],
  ["Perda historica anualizada"],
];
analysis.getRange("B5:B10").formulas = [
  ["=COUNTIF('Ocorrencias'!$S$5:$S$204,\"Validado\")"],
  ["=SUMIF('Ocorrencias'!$S$5:$S$204,\"Validado\",'Ocorrencias'!$O$5:$O$204)"],
  ["=SUMIF('Ocorrencias'!$S$5:$S$204,\"Validado\",'Ocorrencias'!$R$5:$R$204)"],
  ["=IF(B5=0,\"\",B7/B5)"],
  ["=IF('Premissas'!B15=\"\",\"\",'Premissas'!B15)"],
  ["=IF(OR(B7=0,B9=\"\",B9=0),\"\",B7/B9)"],
];
outputStyle(analysis.getRange("B5:B10"));
analysis.getRange("B5:B5").format.numberFormat = "#,##0";
analysis.getRange("B6:B8").format.numberFormat = "R$ #,##0.00;[Red](R$ #,##0.00);-";
analysis.getRange("B9:B9").format.numberFormat = "0.0";
analysis.getRange("B10:B10").format.numberFormat = "R$ #,##0.00;[Red](R$ #,##0.00);-";

analysis.getRange("D4:E4").values = [["Custo anual da solucao", "Valor"]];
header(analysis.getRange("D4:E4"));
analysis.getRange("D5:D10").values = [
  ["Consultas Serpro"],
  ["Consultas GCC"],
  ["Operacao e manutencao"],
  ["Investimento inicial"],
  ["Parcela anualizada do investimento"],
  ["TCO anualizado"],
];
analysis.getRange("E5:E10").formulas = [
  ["=IF('Premissas'!B8=\"\",\"\",'Premissas'!B8*12*'Premissas'!B5)"],
  ["=IF(OR('Premissas'!B8=\"\",'Premissas'!B6=\"\"),\"\",'Premissas'!B8*12*'Premissas'!B6)"],
  ["=IF('Premissas'!B13=\"\",\"\",'Premissas'!B13*12)"],
  ["=IF(COUNTA('Premissas'!B9:B12)=0,\"\",SUMPRODUCT('Premissas'!B9:B9,'Premissas'!B10:B10)+SUM('Premissas'!B11:B12))"],
  ["=IF(OR(E8=\"\",'Premissas'!B14=\"\",'Premissas'!B14=0),\"\",E8/'Premissas'!B14)"],
  ["=IF(OR(E5=\"\",E6=\"\",E7=\"\",E9=\"\"),\"\",SUM(E5:E7,E9))"],
];
outputStyle(analysis.getRange("E5:E10"));
analysis.getRange("E5:E10").format.numberFormat = "R$ #,##0.00;[Red](R$ #,##0.00);-";

analysis.getRange("A13:F13").values = [["Prevencao", "Perda evitada", "TCO anual", "Beneficio liquido", "ROI", "Ocorrencias de equilibrio"]];
header(analysis.getRange("A13:F13"));
analysis.getRange("A14:A17").values = [[0.25], [0.5], [0.75], [1.0]];
analysis.getRange("B14").formulas = [["=IF($B$10=\"\",\"\",$B$10*A14)"]];
analysis.getRange("B14:B17").fillDown();
analysis.getRange("C14").formulas = [["=IF($E$10=\"\",\"\",$E$10)"]];
analysis.getRange("C14:C17").fillDown();
analysis.getRange("D14").formulas = [["=IF(OR(B14=\"\",C14=\"\"),\"\",B14-C14)"]];
analysis.getRange("D14:D17").fillDown();
analysis.getRange("E14").formulas = [["=IF(OR(C14=\"\",C14=0,D14=\"\"),\"\",D14/C14)"]];
analysis.getRange("E14:E17").fillDown();
analysis.getRange("F14").formulas = [["=IF(OR($B$8=\"\",$B$8=0,C14=\"\"),\"\",C14/$B$8)"]];
analysis.getRange("F14:F17").fillDown();
analysis.getRange("A14:A17").format.numberFormat = "0%";
analysis.getRange("B14:D17").format.numberFormat = "R$ #,##0.00;[Red](R$ #,##0.00);-";
analysis.getRange("E14:E17").format.numberFormat = "0.0%";
analysis.getRange("F14:F17").format.numberFormat = "0.0";
analysis.getRange("A14:F17").format.borders = { preset: "inside", style: "thin", color: "#D9E2F3" };
analysis.getRange("D14:D17").conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0, format: { fill: colors.red, font: { color: "#990000" } } });
analysis.getRange("D14:D17").conditionalFormats.add("cellIs", { operator: "greaterThanOrEqual", formula: 0, format: { fill: colors.green, font: { color: colors.darkGreen } } });
analysis.getRange("A:A").format.columnWidth = 40;
analysis.getRange("B:B").format.columnWidth = 20;
analysis.getRange("C:F").format.columnWidth = 20;

// Checks
title(checks, "Controles do modelo", "PASS significa apenas que os controles estruturais definidos abaixo foram atendidos.", "D");
checks.getRange("A4:D4").values = [["Check", "Resultado", "Onde corrigir", "Regra"]];
header(checks.getRange("A4:D4"));
checks.getRange("A5:A11").values = [
  ["IDs duplicados"],
  ["Validado sem data"],
  ["Outros custos sem descricao"],
  ["Excluido sem motivo"],
  ["Validado sem IPCA"],
  ["Tarifa GCC pendente"],
  ["Anos de cobertura ausentes"],
];
checks.getRange("B5:B11").formulas = [
  ["=IF(SUMPRODUCT((COUNTIF('Ocorrencias'!$A$5:$A$204,'Ocorrencias'!$A$5:$A$204)>1)*('Ocorrencias'!$A$5:$A$204<>\"\"))=0,\"PASS\",\"FAIL\")"],
  ["=IF(COUNTIFS('Ocorrencias'!$S$5:$S$204,\"Validado\",'Ocorrencias'!$B$5:$B$204,\"\")=0,\"PASS\",\"FAIL\")"],
  ["=IF(COUNTIFS('Ocorrencias'!$M$5:$M$204,\">0\",'Ocorrencias'!$N$5:$N$204,\"\")=0,\"PASS\",\"FAIL\")"],
  ["=IF(COUNTIFS('Ocorrencias'!$S$5:$S$204,\"Excluido\",'Ocorrencias'!$T$5:$T$204,\"\")=0,\"PASS\",\"FAIL\")"],
  ["=IF(COUNTIFS('Ocorrencias'!$S$5:$S$204,\"Validado\",'Ocorrencias'!$P$5:$P$204,\"\")=0,\"PASS\",\"FAIL\")"],
  ["=IF('Premissas'!B6=\"\",\"PENDENTE\",\"PASS\")"],
  ["=IF('Premissas'!B15=\"\",\"PENDENTE\",\"PASS\")"],
];
checks.getRange("C5:C11").values = [
  ["Ocorrencias!A"], ["Ocorrencias!B/S"], ["Ocorrencias!M/N"],
  ["Ocorrencias!S/T"], ["Ocorrencias!P/S"], ["Premissas!B6"], ["Premissas!B15"],
];
checks.getRange("D5:D11").values = [
  ["Cada id nao vazio deve ser unico"],
  ["Toda ocorrencia validada precisa de data"],
  ["Outros custos positivos exigem descricao"],
  ["Registro excluido exige justificativa"],
  ["Registro validado precisa do indice do periodo"],
  ["Custo total nao pode tratar tarifa desconhecida como zero"],
  ["A anualizacao exige cobertura temporal validada"],
];
checks.getRange("A14:B14").values = [["MODEL STATUS", null]];
header(checks.getRange("A14:A14"));
checks.getRange("B14").formulas = [["=IF(COUNTIF(B5:B11,\"FAIL\")>0,\"FAIL\",IF(COUNTIF(B5:B11,\"PENDENTE\")>0,\"PENDENTE\",\"PASS\"))"]];
outputStyle(checks.getRange("B14"));
checks.getRange("B5:B14").conditionalFormats.add("containsText", { text: "FAIL", format: { fill: colors.red, font: { bold: true, color: "#990000" } } });
checks.getRange("B5:B14").conditionalFormats.add("containsText", { text: "PENDENTE", format: { fill: colors.amber, font: { bold: true, color: "#7F6000" } } });
checks.getRange("B5:B14").conditionalFormats.add("containsText", { text: "PASS", format: { fill: colors.green, font: { bold: true, color: colors.darkGreen } } });
checks.getRange("A:A").format.columnWidth = 32;
checks.getRange("B:B").format.columnWidth = 16;
checks.getRange("C:C").format.columnWidth = 24;
checks.getRange("D:D").format.columnWidth = 62;
checks.getRange("A4:D14").format.wrapText = true;

// Sources
title(sources, "Fontes e versoes", "Registrar aqui cada entrada externa usada no modelo.", "J");
sources.getRange("A4:J4").values = [["item", "valor", "unidade", "periodo_data_base", "tipo_fonte", "nome_fonte", "referencia_url", "responsavel", "observacao", "acesso_atualizacao"]];
header(sources.getRange("A4:J4"));
sources.getRange("A5:J8").values = [
  ["Tarifa consulta detalhada", 1.62, "R$/consulta", "2026-07-29", "Portaria", "Portaria SENATRAN 417/2026", "https://www.gov.br/transportes/pt-br/assuntos/transito/arquivos-senatran/portarias/2026/Portaria4172026.pdf", "Pesquisador", "Primeiro nivel de volume; revalidar", new Date("2026-07-29")],
  ["Campos de combustivel", null, null, "2026-07-29", "Inventario oficial", "Consulta Online SENATRAN - veiculo", "https://centraldeajuda.serpro.gov.br/consultasenatran/veiculo/", "Pesquisador", "Codigo e descricao pertencem a consulta detalhada", new Date("2026-07-29")],
  ["IPCA", null, "numero-indice", null, "Fonte oficial", "IBGE/SIDRA", "https://sidra.ibge.gov.br/", "Pendente", "Registrar tabela e serie exatas", null],
  ["Tarifa GCC", null, "R$/consulta", null, "Proposta/contrato", "GCC a contratar", null, "Pendente", "Nao inferir do material comercial", null],
];
inputStyle(sources.getRange("A5:J104"));
sources.getRange("B5:B104").format.numberFormat = "R$ #,##0.00";
sources.getRange("J5:J104").format.numberFormat = "yyyy-mm-dd";
sources.tables.add("A4:J104", true, "tblFontes").style = "TableStyleMedium2";
sources.freezePanes.freezeRows(4);
sources.getRange("A:A").format.columnWidth = 28;
sources.getRange("B:C").format.columnWidth = 16;
sources.getRange("D:F").format.columnWidth = 24;
sources.getRange("G:G").format.columnWidth = 72;
sources.getRange("H:H").format.columnWidth = 20;
sources.getRange("I:I").format.columnWidth = 42;
sources.getRange("J:J").format.columnWidth = 18;
sources.getRange("A4:J104").format.wrapText = true;

const inspectSummary = await wb.inspect({
  kind: "sheet,table",
  maxChars: 6000,
  tableMaxRows: 4,
  tableMaxCols: 8,
});
console.log(inspectSummary.ndjson);

const formulaErrors = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(formulaErrors.ndjson);

const previews = [
  ["Instrucoes", "A1:H15"],
  ["Ocorrencias", "A1:U14"],
  ["Abastecimentos", "A1:F14"],
  ["IPCA", "A1:D14"],
  ["Premissas", "A1:G15"],
  ["Analise", "A1:H18"],
  ["Checks", "A1:D15"],
  ["Fontes", "A1:J10"],
];

for (const [sheetName, range] of previews) {
  const preview = await wb.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(
    path.join(qaDir, `preview-${sheetName.toLowerCase()}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const workbookFile = await SpreadsheetFile.exportXlsx(wb);
const canonicalPath = path.join(analysisDir, "modelo-viabilidade-economica.xlsx");
const outputPath = path.join(outputDir, "modelo-viabilidade-economica.xlsx");
await workbookFile.save(canonicalPath);
await workbookFile.save(outputPath);

console.log(JSON.stringify({ canonicalPath, outputPath, qaDir }, null, 2));
