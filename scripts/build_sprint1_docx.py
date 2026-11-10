from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "word" / "tcc-sprint-1-problema-objetivos-requisitos.docx"

FONT_BODY = "Times New Roman"
FONT_CAPTION = "Arial"
TEXT_WIDTH_DXA = 8504  # 15 cm: A4 with 3 cm side margins


def set_run_font(run, name=FONT_BODY, size=12, bold=None, italic=None):
    run.font.name = name
    run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(qn(f"w:{attr}"), name)
    for attr in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
        rfonts.attrib.pop(qn(f"w:{attr}"), None)


def set_style_font(style, name, size, bold=None):
    style.font.name = name
    style.font.size = Pt(size)
    if bold is not None:
        style.font.bold = bold
    rpr = style._element.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(qn(f"w:{attr}"), name)
    for attr in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
        rfonts.attrib.pop(qn(f"w:{attr}"), None)


def configure_page(section):
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(3.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(3)
    section.right_margin = Cm(3)
    section.header_distance = Cm(1.25)
    section.footer_distance = Cm(1.25)


def configure_styles(doc):
    normal = doc.styles["Normal"]
    set_style_font(normal, FONT_BODY, 12)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    normal.paragraph_format.line_spacing = 1.0
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.widow_control = True

    h1 = doc.styles["Heading 1"]
    set_style_font(h1, FONT_BODY, 13, bold=True)
    h1.font.color.rgb = RGBColor(0, 0, 0)
    h1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    h1.paragraph_format.space_before = Pt(12)
    h1.paragraph_format.space_after = Pt(6)
    h1.paragraph_format.keep_with_next = True
    h1.paragraph_format.keep_together = True

    h2 = doc.styles["Heading 2"]
    set_style_font(h2, FONT_BODY, 12, bold=True)
    h2.font.color.rgb = RGBColor(0, 0, 0)
    h2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    h2.paragraph_format.space_before = Pt(12)
    h2.paragraph_format.space_after = Pt(6)
    h2.paragraph_format.keep_with_next = True
    h2.paragraph_format.keep_together = True

    for style_name in ("List Bullet", "List Number"):
        style = doc.styles[style_name]
        set_style_font(style, FONT_BODY, 12)
        style.paragraph_format.left_indent = Cm(1.27)
        style.paragraph_format.first_line_indent = Cm(-0.63)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.line_spacing = 1.0
        style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY


def add_title_block(doc):
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(0)
    title.paragraph_format.space_after = Pt(12)
    title.paragraph_format.keep_with_next = True
    run = title.add_run(
        "Prevenção de abastecimento incompatível por meio de consulta veicular "
        "e intertravamento de bicos: projeto e avaliação de um protótipo"
    )
    set_run_font(run, size=16, bold=True)

    author = doc.add_paragraph()
    author.alignment = WD_ALIGN_PARAGRAPH.CENTER
    author.paragraph_format.space_after = Pt(12)
    author.paragraph_format.keep_with_next = True
    set_run_font(author.add_run("Gabriel Nahmur Peres Amaro"), size=12, bold=True)

    affiliation_lines = [
        "Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas",
        "Instituto Federal de Educação, Ciência e Tecnologia Sul-rio-grandense (IFSul)",
        "Câmpus Bagé - Bagé - RS - Brasil",
        "Disciplina: Práticas de Análise e Desenvolvimento de Sistemas",
        "Orientador: Roger Porto",
    ]
    affiliation = doc.add_paragraph()
    affiliation.alignment = WD_ALIGN_PARAGRAPH.CENTER
    affiliation.paragraph_format.space_after = Pt(12)
    affiliation.paragraph_format.keep_with_next = True
    for index, line in enumerate(affiliation_lines):
        if index:
            affiliation.add_run().add_break()
        set_run_font(affiliation.add_run(line), size=12)


def add_abstract(doc, label, text, keywords_label, keywords):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(0.8)
    p.paragraph_format.right_indent = Cm(0.8)
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_after = Pt(6)
    label_run = p.add_run(f"{label}. ")
    set_run_font(label_run, size=12, bold=True, italic=True)
    body_run = p.add_run(text)
    set_run_font(body_run, size=12, italic=True)

    k = doc.add_paragraph()
    k.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    k.paragraph_format.left_indent = Cm(0.8)
    k.paragraph_format.right_indent = Cm(0.8)
    k.paragraph_format.first_line_indent = Cm(0)
    k.paragraph_format.space_after = Pt(12 if label == "Resumo" else 6)
    kr = k.add_run(f"{keywords_label}: ")
    set_run_font(kr, size=12, bold=True, italic=True)
    set_run_font(k.add_run(keywords), size=12, italic=True)


def add_heading(doc, text, level=1):
    return doc.add_paragraph(text, style=f"Heading {level}")


def add_body(doc, text, first=False, keep_with_next=False):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.first_line_indent = Cm(0 if first else 1.27)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.0
    p.paragraph_format.keep_with_next = keep_with_next
    set_run_font(p.add_run(text), size=12)
    return p


def add_quote(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(0.8)
    p.paragraph_format.right_indent = Cm(0.8)
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    set_run_font(p.add_run(text), size=12, italic=True)
    return p


def add_list_item(doc, text, numbered=False):
    style = "List Number" if numbered else "List Bullet"
    p = doc.add_paragraph(style=style)
    p.paragraph_format.keep_together = True
    set_run_font(p.add_run(text), size=12)
    return p


def set_cell_margins(cell, top=80, start=90, bottom=80, end=90):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def keep_row_together(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)


def set_table_geometry(table, widths):
    if sum(widths) != TEXT_WIDTH_DXA:
        raise ValueError("Table widths must equal the SBC text width")
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_pr = table._tbl.tblPr

    tbl_w = tbl_pr.first_child_found_in("w:tblW")
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(TEXT_WIDTH_DXA))
    tbl_w.set(qn("w:type"), "dxa")

    tbl_ind = tbl_pr.first_child_found_in("w:tblInd")
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), "0")
    tbl_ind.set(qn("w:type"), "dxa")

    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        grid_col = OxmlElement("w:gridCol")
        grid_col.set(qn("w:w"), str(width))
        grid.append(grid_col)

    for row in table.rows:
        for cell, width in zip(row.cells, widths):
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_w = tc_pr.first_child_found_in("w:tcW")
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                tc_pr.append(tc_w)
            tc_w.set(qn("w:w"), str(width))
            tc_w.set(qn("w:type"), "dxa")


def format_cell(cell, *, header=False, centered=False):
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    set_cell_margins(cell)
    for p in cell.paragraphs:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if centered else WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.keep_together = True
        for run in p.runs:
            set_run_font(run, size=10.5, bold=header)


def add_caption(doc, number, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    set_run_font(p.add_run(f"Tabela {number}. {text}"), name=FONT_CAPTION, size=10, bold=True)


def add_requirements_table(doc, caption_number, caption, rows):
    add_caption(doc, caption_number, caption)
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    header = table.rows[0]
    header.cells[0].text = "ID"
    header.cells[1].text = "Requisito"
    set_repeat_table_header(header)
    keep_row_together(header)
    format_cell(header.cells[0], header=True, centered=True)
    format_cell(header.cells[1], header=True, centered=True)

    for req_id, requirement in rows:
        row = table.add_row()
        row.cells[0].text = req_id
        row.cells[1].text = requirement
        keep_row_together(row)
        format_cell(row.cells[0], centered=True)
        format_cell(row.cells[1])

    set_table_geometry(table, [900, 7604])
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(0)
    spacer.paragraph_format.line_spacing = 1.0
    set_run_font(spacer.add_run("Fonte: elaborado pelo autor (2026)."), size=10, italic=True)
    return table


def remove_empty_header_footer_paragraphs(section):
    # Keep the required empty container paragraphs, but ensure there is no visible chrome.
    for container in (section.header, section.footer):
        for paragraph in container.paragraphs:
            paragraph.clear()
            paragraph.paragraph_format.space_after = Pt(0)


def build_document():
    doc = Document()
    section = doc.sections[0]
    configure_page(section)
    remove_empty_header_footer_paragraphs(section)
    configure_styles(doc)

    props = doc.core_properties
    props.title = (
        "Prevenção de abastecimento incompatível por meio de consulta veicular "
        "e intertravamento de bicos - Sprint 1"
    )
    props.subject = "Problema, objetivos e requisitos"
    props.author = "Gabriel Nahmur Peres Amaro"
    props.keywords = "abastecimento incompatível; intertravamento; requisitos; Sprint 1"

    add_title_block(doc)
    add_abstract(
        doc,
        "Abstract",
        "This document presents the analytical foundation of Sprint 1 for a system intended to reduce vehicle misfuelling. The proposal combines vehicle-data consultation, an explicit fuel-compatibility policy and temporary authorization of an independent lock installed on the nozzle holder. The sprint defines the problem, the general and specific objectives, and the preliminary functional and non-functional requirements. The initial scope is restricted to a dry, low-voltage bench prototype, with simulated data and fail-closed behavior. It does not control fuel pumping or the forecourt automation system.",
        "Keywords",
        "Vehicle misfuelling. Interlocking. Requirements analysis. Software development.",
    )
    add_abstract(
        doc,
        "Resumo",
        "Este documento apresenta a base de análise do Sprint 1 de um sistema destinado a reduzir abastecimentos incompatíveis. A proposta combina consulta de dados veiculares, uma política explícita de compatibilidade e autorização temporária de uma trava independente instalada no suporte do bico. O sprint delimita o problema, o objetivo geral, os objetivos específicos e os requisitos funcionais e não funcionais preliminares. O escopo inicial restringe-se a um protótipo de bancada seca, em baixa tensão, com dados simulados e comportamento seguro diante de falhas. O artefato não comanda o bombeamento nem a automação de pista.",
        "Palavras-chave",
        "Abastecimento incompatível. Intertravamento. Análise de requisitos. Desenvolvimento de sistemas.",
    )

    add_heading(doc, "1. Introdução")
    add_body(
        doc,
        "O abastecimento de veículos exige que o produto selecionado seja compatível com a configuração do veículo antes do início da transferência de combustível. Uma escolha incorreta pode provocar interrupção do atendimento, necessidade de remoção do produto e eventual reparo, além de retrabalho operacional. No contexto considerado por este projeto, essa decisão depende principalmente da conferência realizada durante o atendimento e não existe, no escopo estudado, uma barreira automatizada que valide a compatibilidade antes do acesso ao bico.",
        first=True,
    )
    add_body(
        doc,
        "Como alternativa de prevenção, propõe-se um sistema que receba a identificação do veículo e o combustível solicitado, consulte uma fonte de dados veiculares autorizada ou simulada, aplique uma política de compatibilidade e libere temporariamente apenas a trava independente correspondente ao bico compatível. Caso a resposta seja ausente, inválida, ambígua ou desconhecida, o sistema deve permanecer bloqueado e encaminhar a situação para revisão.",
    )
    add_body(
        doc,
        "Esta versão foi preparada para a disciplina de Práticas de Análise e Desenvolvimento de Sistemas e corresponde ao Sprint 1 do ensaio de desenvolvimento do Trabalho de Conclusão de Curso. O documento concentra-se na definição do problema, dos objetivos e dos requisitos. A implementação, a integração física e a avaliação completa pertencem às etapas posteriores.",
    )

    add_heading(doc, "2. Problema")
    add_heading(doc, "2.1. Contextualização", level=2)
    add_body(
        doc,
        "Durante o atendimento em um posto de combustíveis, o frentista precisa relacionar o produto solicitado às características do veículo. A atividade pode envolver pressão de tempo, comunicação incompleta, veículos com mais de uma opção de combustível e informações que não estão imediatamente disponíveis. A simples exibição de uma recomendação também não impede fisicamente a retirada de um bico incompatível.",
        first=True,
    )
    add_body(
        doc,
        "O problema considerado neste trabalho é a ausência de uma barreira automatizada que verifique a compatibilidade antes de autorizar o acesso ao bico. Ainda não serão apresentados números de ocorrências ou valores de prejuízo como fatos consolidados, pois esses dados dependem de levantamento, validação de origem e tratamento adequado. O Sprint 1, portanto, define o problema sem antecipar resultados que deverão ser obtidos nas fases de pesquisa e avaliação.",
    )

    add_heading(doc, "2.2. Pergunta de pesquisa", level=2)
    add_body(doc, "A investigação será orientada pela seguinte pergunta:", first=True)
    add_quote(
        doc,
        "Como um sistema baseado em consulta veicular e intertravamento pode impedir a retirada do bico associado a um combustível incompatível em ambiente controlado, e em quais condições sua adoção pode apresentar viabilidade para uma rede de postos de combustíveis?",
    )

    add_heading(doc, "2.3. Delimitação do problema", level=2)
    add_body(
        doc,
        "O primeiro protótipo será desenvolvido exclusivamente em bancada seca, sem combustível, em baixa tensão e com componentes de finalidade didática. A trava será independente e instalada no suporte do bico apenas para representar a autorização ou o bloqueio de sua retirada. O sistema não acionará bomba, vazão, dispenser ou automação de pista.",
        first=True,
    )
    add_body(
        doc,
        "Até que existam autorizações, contratos, credenciais e ambiente adequados, a consulta veicular real permanecerá desabilitada e será substituída por um provedor simulado com dados sintéticos. Uma eventual instalação em área de abastecimento está fora do escopo deste Sprint e dependeria de projeto de engenharia, análise da área classificada e equipamentos apropriados.",
    )

    add_heading(doc, "3. Objetivos")
    add_heading(doc, "3.1. Objetivo geral", level=2)
    add_body(
        doc,
        "Projetar, implementar e avaliar um protótipo de sistema para prevenção de abastecimento incompatível, integrando consulta de dados veiculares, política de compatibilidade, autorização de uma trava independente no suporte do bico e análise de viabilidade baseada em informações verificáveis.",
        first=True,
    )

    add_heading(doc, "3.2. Objetivos específicos", level=2)
    objectives = [
        "Caracterizar o processo de abastecimento e identificar os pontos em que pode ocorrer a seleção de um combustível incompatível.",
        "Levantar e organizar informações técnicas sobre consulta veicular, compatibilidade de combustíveis, intertravamento, privacidade e segurança do protótipo.",
        "Elicitar e documentar requisitos funcionais, não funcionais, regras de negócio e restrições de escopo.",
        "Desenvolver um provedor veicular simulado e um protótipo de bancada com comportamento de falha para o estado bloqueado.",
        "Avaliar o comportamento funcional, o tratamento de falhas, a latência, a repetibilidade e a facilidade de uso do protótipo.",
        "Estimar custos e cenários de viabilidade sem confundir projeções com economia efetivamente observada.",
    ]
    for objective in objectives:
        add_list_item(doc, objective, numbered=True)

    add_heading(doc, "4. Requisitos")
    add_body(
        doc,
        "Os requisitos a seguir foram derivados do problema, dos objetivos e das decisões iniciais de escopo. Eles representam a solução pretendida e deverão ser validados e refinados nos próximos Sprints. Sua inclusão neste documento não significa que todos já estejam implementados.",
        first=True,
    )

    add_heading(doc, "4.1. Atores e partes interessadas", level=2)
    actors = [
        "Frentista: informa a placa e o combustível solicitado e acompanha a decisão de autorização.",
        "Supervisor: analisa exceções e pode registrar uma liberação extraordinária, quando permitida e justificada.",
        "Administrador: mantém usuários, dispositivos, conjuntos de bicos e regras de compatibilidade.",
        "Provedor veicular: fornece ao backend a categoria de combustível do veículo, de forma simulada ou autorizada.",
        "Controlador de bancada: recebe comandos restritos e controla somente as saídas associadas às travas dos suportes.",
        "Auditor ou pesquisador: consulta registros minimizados para verificar decisões, falhas e resultados dos testes.",
        "Cliente e titular dos dados: não operam o protótipo, mas são partes interessadas na segurança, na transparência e na proteção dos dados.",
    ]
    for actor in actors:
        add_list_item(doc, actor)

    add_heading(doc, "4.2. Requisitos funcionais", level=2)
    functional_requirements = [
        ("RF01", "O sistema deve receber uma solicitação contendo identificador único, placa, combustível solicitado, frentista e conjunto de bicos, rejeitando campos inválidos."),
        ("RF02", "O sistema deve consultar o provedor veicular por meio do backend, sem expor credenciais ou certificados à interface utilizada pelo frentista."),
        ("RF03", "O sistema deve converter o código ou a descrição recebida do provedor em uma categoria interna de combustível e registrar a versão da regra utilizada."),
        ("RF04", "O sistema deve classificar a solicitação como autorizada, negada ou sujeita à revisão, apresentando um motivo padronizado para a decisão."),
        ("RF05", "Quando houver compatibilidade confirmada, o sistema deve autorizar temporariamente somente a trava do suporte associada ao combustível solicitado."),
        ("RF06", "O sistema deve encerrar a autorização e desenergizar todas as saídas de abertura após expiração do prazo, conclusão, reinicialização ou perda de comunicação."),
        ("RF07", "O sistema deve permitir liberação extraordinária somente a supervisor autenticado, com justificativa obrigatória e validade limitada."),
        ("RF08", "O sistema deve rejeitar comandos duplicados, vencidos ou fora de sequência e registrar a confirmação recebida do controlador."),
        ("RF09", "O sistema deve manter trilha de auditoria das solicitações, decisões, falhas e liberações extraordinárias, utilizando dados minimizados."),
        ("RF10", "O sistema deve oferecer provedores e controladores simulados para desenvolvimento e demonstração sem consulta real nem uso de dados pessoais."),
    ]
    add_requirements_table(doc, 1, "Requisitos funcionais preliminares", functional_requirements)

    add_heading(doc, "4.3. Requisitos não funcionais", level=2)
    non_functional_requirements = [
        ("RNF01", "Segurança funcional: o estado inicial e o estado após erro, timeout, perda de comunicação ou reinicialização devem manter todas as travas bloqueadas."),
        ("RNF02", "Privacidade: a placa deve ser utilizada apenas durante a solicitação e não deve ser persistida em logs padrão, dispositivos ou relatórios do protótipo."),
        ("RNF03", "Segurança lógica: credenciais devem permanecer fora do código e do repositório; usuários devem possuir autenticação individual e somente as permissões necessárias."),
        ("RNF04", "Auditabilidade: cada decisão e liberação extraordinária deve registrar data e hora, ator, motivo, versão da política e resultado retornado pelo controlador."),
        ("RNF05", "Interoperabilidade: o domínio deve utilizar interfaces substituíveis para provedor veicular e controlador, evitando dependência direta de uma única tecnologia."),
        ("RNF06", "Desempenho: o tempo de resposta deve ser medido por mediana, percentil 95 e máximo; a meta operacional será definida após uma linha de base verificável."),
        ("RNF07", "Reprodutibilidade: casos sintéticos, configurações, regras e testes devem ser versionados e executáveis em ambiente de desenvolvimento."),
        ("RNF08", "Segurança física: o protótipo deve operar somente em bancada seca e de baixa tensão, sem comandar bombeamento nem ser apresentado como equipamento pronto para pista."),
    ]
    add_requirements_table(doc, 2, "Requisitos não funcionais preliminares", non_functional_requirements)

    add_heading(doc, "4.4. Regras de negócio e restrições", level=2)
    business_rules = [
        ("RB01", "Na ausência de resposta positiva e inequívoca sobre a compatibilidade, nenhuma trava deve ser liberada automaticamente."),
        ("RB02", "Para veículo compatível com mais de um combustível, o sistema deve apresentar apenas as opções compatíveis e liberar somente o suporte correspondente ao produto escolhido."),
        ("RB03", "Toda liberação extraordinária deve exigir supervisor, justificativa, prazo limitado e registro de auditoria."),
        ("RB04", "A placa e a resposta veicular bruta não devem ser enviadas ao controlador de bancada nem incluídas nos registros operacionais padrão."),
        ("RB05", "A integração veicular real e qualquer instalação em área de abastecimento permanecem desabilitadas enquanto não existirem autorizações, contratos e projeto técnico apropriado."),
    ]
    add_requirements_table(doc, 3, "Regras de negócio e restrições iniciais", business_rules)

    add_heading(doc, "4.5. Critérios iniciais de validação", level=2)
    validation_items = [
        "Uma solicitação compatível deve liberar somente a trava associada ao combustível solicitado e apenas durante o prazo autorizado.",
        "Solicitações incompatíveis, inválidas, ambíguas, desconhecidas ou sem resposta devem permanecer bloqueadas.",
        "Comandos duplicados, vencidos ou fora de sequência não devem produzir uma segunda liberação.",
        "A interface, os logs e o controlador não devem expor credenciais, placa, resposta veicular bruta ou dados do titular.",
        "Toda exceção deve possuir supervisor identificável, justificativa, prazo e registro auditável.",
    ]
    for item in validation_items:
        add_list_item(doc, item)

    add_heading(doc, "5. Síntese do Sprint 1")
    add_body(
        doc,
        "O Sprint 1 estabelece uma base verificável para o desenvolvimento: define o problema sem antecipar estatísticas ainda não levantadas, conecta o objetivo geral a seis objetivos específicos e transforma as decisões de escopo em requisitos rastreáveis. Os próximos Sprints deverão validar esses requisitos com as partes interessadas, detalhar casos de uso e modelos, implementar os componentes previstos e executar os testes definidos, mantendo explícita a separação entre simulação de bancada e eventual aplicação operacional.",
        first=True,
    )

    # Keep the entire document in one SBC-style section with no page numbering.
    for sec in doc.sections:
        configure_page(sec)
        remove_empty_header_footer_paragraphs(sec)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    return OUTPUT


if __name__ == "__main__":
    print(build_document())
