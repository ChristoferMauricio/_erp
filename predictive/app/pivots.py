# -*- coding: utf-8 -*-
"""
Inyección de PivotTables NATIVAS en un .xlsx ya generado por openpyxl.

Estrategia: un único pivotCache (source = hoja Datos) con refreshOnLoad=1, y un
pivotTable por hoja "PV ...". Las celdas de layout se dejan mínimas: Excel reconstruye
todo (items y área de datos) al abrir gracias a refreshOnLoad. No se deserializan las
partes de pivot con openpyxl (que las corrompería): se manipula el zip directamente.
"""
import re
import zipfile
from io import BytesIO
from xml.sax.saxutils import escape

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CT_CACHE_DEF = "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml"
CT_CACHE_REC = "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheRecords+xml"
CT_PIVOT = "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml"
REL_CACHE_DEF = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition"
REL_CACHE_REC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheRecords"
REL_PIVOT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotTable"

NUMERIC_COLS = {"Personas", "Tiempo (h)", "HH", "Cantidad"}


def _xs(s):
    """Elimina caracteres no válidos en XML 1.0 y escapa para XML."""
    out = []
    for ch in str(s):
        o = ord(ch)
        if o in (0x09, 0x0A, 0x0D) or 0x20 <= o <= 0xD7FF or 0xE000 <= o <= 0xFFFD:
            out.append(ch)
    return escape("".join(out), {'"': "&quot;", "'": "&apos;"})


def _col_letter(n):
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def _cache_fields_xml(columns, axis_values):
    parts = []
    for name in columns:
        nm = _xs(name)
        if name in axis_values:
            items = "".join('<s v="%s"/>' % _xs(v) for v in axis_values[name])
            si = '<sharedItems count="%d">%s</sharedItems>' % (len(axis_values[name]), items)
        elif name in NUMERIC_COLS:
            si = '<sharedItems containsSemiMixedTypes="0" containsString="0" containsNumber="1"/>'
        else:
            si = '<sharedItems containsBlank="1"/>'
        parts.append('<cacheField name="%s" numFmtId="0">%s</cacheField>' % (nm, si))
    return "".join(parts)


def _cache_definition_xml(columns, axis_values, ref):
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<pivotCacheDefinition xmlns="%s" xmlns:r="%s" r:id="rId1" refreshOnLoad="1" '
        'refreshedBy="ERP" refreshedDate="45292" createdVersion="6" refreshedVersion="6" '
        'minRefreshableVersion="3" recordCount="0">'
        '<cacheSource type="worksheet"><worksheetSource ref="%s" sheet="Datos"/></cacheSource>'
        '<cacheFields count="%d">%s</cacheFields>'
        '</pivotCacheDefinition>'
        % (NS_MAIN, NS_R, ref, len(columns), _cache_fields_xml(columns, axis_values))
    )


def _records_xml():
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<pivotCacheRecords xmlns="%s" xmlns:r="%s" count="0"/>' % (NS_MAIN, NS_R))


def _pivot_table_xml(cfg, columns, axis_values):
    """PivotTable completa y consistente (un solo campo de fila, 0/1 campo de columna,
    1/2 medidas). items + rowItems/colItems enumerados con totales. refreshOnLoad recalcula."""
    idx = {c: i for i, c in enumerate(columns)}
    row_col = cfg["rows"][0]
    r_idx = idx[row_col]
    R = len(axis_values.get(row_col, []))
    col = cfg.get("col")
    c_idx = idx[col] if col else None
    C = len(axis_values.get(col, [])) if col else 0
    datas = cfg["datas"]
    multi = len(datas) > 1
    data_src = [idx[d[0]] for d in datas]

    # pivotFields: el campo de fila y el de columna llevan <items> (x por cada shared item + default)
    pf = []
    for i, _c in enumerate(columns):
        if i == r_idx:
            items = "".join('<item x="%d"/>' % k for k in range(R)) + '<item t="default"/>'
            pf.append('<pivotField axis="axisRow" showAll="0"><items count="%d">%s</items></pivotField>' % (R + 1, items))
        elif c_idx is not None and i == c_idx:
            items = "".join('<item x="%d"/>' % k for k in range(C)) + '<item t="default"/>'
            pf.append('<pivotField axis="axisCol" showAll="0"><items count="%d">%s</items></pivotField>' % (C + 1, items))
        elif i in data_src:
            pf.append('<pivotField dataField="1" showAll="0"/>')
        else:
            pf.append('<pivotField showAll="0"/>')
    pivot_fields = '<pivotFields count="%d">%s</pivotFields>' % (len(columns), "".join(pf))

    row_fields = '<rowFields count="1"><field x="%d"/></rowFields>' % r_idx
    ri = "".join('<i><x v="%d"/></i>' % k for k in range(R)) + '<i t="grand"><x/></i>'
    row_items = '<rowItems count="%d">%s</rowItems>' % (R + 1, ri)

    if c_idx is not None:
        col_fields = '<colFields count="1"><field x="%d"/></colFields>' % c_idx
        ci = "".join('<i><x v="%d"/></i>' % k for k in range(C)) + '<i t="grand"><x/></i>'
        col_items = '<colItems count="%d">%s</colItems>' % (C + 1, ci)
    elif multi:
        col_fields = '<colFields count="1"><field x="-2"/></colFields>'
        ci = "".join(('<i><x/></i>' if di == 0 else '<i i="%d"><x v="%d"/></i>' % (di, di))
                     for di in range(len(datas)))
        col_items = '<colItems count="%d">%s</colItems>' % (len(datas), ci)
    else:
        col_fields = ''
        col_items = '<colItems count="1"><i/></colItems>'

    dfs = []
    for src, agg, caption in datas:
        sub = "count" if agg == "count" else "sum"
        dfs.append('<dataField name="%s" fld="%d" subtotal="%s" baseField="0" baseItem="0"/>'
                   % (_xs(caption), idx[src], sub))
    data_fields = '<dataFields count="%d">%s</dataFields>' % (len(dfs), "".join(dfs))

    ncols = 1 + ((C + 1) if c_idx is not None else (len(datas) if multi else 1))
    nrows = R + 3
    location = ('<location ref="A3:%s%d" firstHeaderRow="1" firstDataRow="2" firstDataCol="1"/>'
                % (_col_letter(ncols), 3 + nrows))

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<pivotTableDefinition xmlns="%s" xmlns:r="%s" name="%s" cacheId="1" '
        'applyNumberFormats="0" applyBorderFormats="0" applyFontFormats="0" applyPatternFormats="0" '
        'applyAlignmentFormats="0" applyWidthHeightFormats="1" dataCaption="Valores" '
        'updatedVersion="6" minRefreshableVersion="3" useAutoFormatting="1" itemPrintTitles="1" '
        'createdVersion="6" indent="0" outline="1" outlineData="1" multipleFieldFilters="0">'
        '%s%s%s%s%s%s%s'
        '<pivotTableStyleInfo name="PivotStyleLight16" showRowHeaders="1" showColHeaders="1" '
        'showRowStripes="0" showColStripes="0" showLastColumn="1"/>'
        '</pivotTableDefinition>'
        % (NS_MAIN, NS_R, _xs(cfg["name"]), location, pivot_fields, row_fields, row_items,
           col_fields, col_items, data_fields)
    )


def _sheet_name_to_file(files):
    """Mapea nombre visible de hoja -> 'xl/worksheets/sheetN.xml'. Robusto al orden de atributos."""
    wbxml = files["xl/workbook.xml"].decode("utf-8")
    rels = files["xl/_rels/workbook.xml.rels"].decode("utf-8")
    rid_to_target = {}
    for m in re.finditer(r'<Relationship\b[^>]*>', rels):
        tag = m.group(0)
        rid = re.search(r'\bId="([^"]+)"', tag)
        tgt = re.search(r'\bTarget="([^"]+)"', tag)
        if rid and tgt:
            rid_to_target[rid.group(1)] = tgt.group(1)
    out = {}
    for m in re.finditer(r'<sheet\b[^>]*>', wbxml):
        tag = m.group(0)
        nm = re.search(r'\bname="([^"]+)"', tag)
        rid = re.search(r'\br:id="([^"]+)"', tag)
        if nm and rid:
            tgt = rid_to_target.get(rid.group(1), "")
            if tgt:
                out[nm.group(1)] = tgt if tgt.startswith("xl/") else "xl/" + tgt
    return out


def inject(xlsx_bytes, df, columns, pivots):
    files = {}
    with zipfile.ZipFile(BytesIO(xlsx_bytes)) as z:
        for n in z.namelist():
            files[n] = z.read(n)

    axis_cols = set()
    for p in pivots:
        axis_cols.update(p["rows"])
        if p.get("col"):
            axis_cols.add(p["col"])
    axis_values = {}
    for c in axis_cols:
        vals = [str(v) for v in df[c].dropna().unique().tolist()]
        axis_values[c] = sorted(vals)

    last_ref = "A1:%s%d" % (_col_letter(len(columns)), len(df) + 1)
    name_to_file = _sheet_name_to_file(files)

    files["xl/pivotCache/pivotCacheDefinition1.xml"] = _cache_definition_xml(columns, axis_values, last_ref).encode("utf-8")
    files["xl/pivotCache/pivotCacheRecords1.xml"] = _records_xml().encode("utf-8")
    files["xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels"] = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="%s" Target="pivotCacheRecords1.xml"/></Relationships>' % REL_CACHE_REC
    ).encode("utf-8")

    ct_overrides = []
    for k, cfg in enumerate(pivots, start=1):
        sheet_file = name_to_file[cfg["sheet"]]
        sheet_base = sheet_file.split("/")[-1]
        pt_name = "pivotTable%d.xml" % k
        files["xl/pivotTables/%s" % pt_name] = _pivot_table_xml(cfg, columns, axis_values).encode("utf-8")
        files["xl/pivotTables/_rels/%s.rels" % pt_name] = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="%s" Target="../pivotCache/pivotCacheDefinition1.xml"/></Relationships>'
            % REL_CACHE_DEF
        ).encode("utf-8")
        files["xl/worksheets/_rels/%s.rels" % sheet_base] = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="%s" Target="../pivotTables/%s"/></Relationships>'
            % (REL_PIVOT, pt_name)
        ).encode("utf-8")
        ct_overrides.append('<Override PartName="/xl/pivotTables/%s" ContentType="%s"/>' % (pt_name, CT_PIVOT))

    rels = files["xl/_rels/workbook.xml.rels"].decode("utf-8")
    used = [int(x) for x in re.findall(r'Id="rId(\d+)"', rels)]
    pc_rid = "rId%d" % (max(used) + 1 if used else 1)
    rels = rels.replace("</Relationships>",
                        '<Relationship Id="%s" Type="%s" Target="pivotCache/pivotCacheDefinition1.xml"/></Relationships>'
                        % (pc_rid, REL_CACHE_DEF))
    files["xl/_rels/workbook.xml.rels"] = rels.encode("utf-8")

    wbxml = files["xl/workbook.xml"].decode("utf-8")
    pc = ('<pivotCaches><pivotCache cacheId="1" r:id="%s" xmlns:r="%s"/></pivotCaches>'
          % (pc_rid, NS_R))
    wbxml = wbxml.replace("</workbook>", pc + "</workbook>")
    files["xl/workbook.xml"] = wbxml.encode("utf-8")

    ct = files["[Content_Types].xml"].decode("utf-8")
    add = ('<Override PartName="/xl/pivotCache/pivotCacheDefinition1.xml" ContentType="%s"/>'
           '<Override PartName="/xl/pivotCache/pivotCacheRecords1.xml" ContentType="%s"/>%s'
           % (CT_CACHE_DEF, CT_CACHE_REC, "".join(ct_overrides)))
    ct = ct.replace("</Types>", add + "</Types>")
    files["[Content_Types].xml"] = ct.encode("utf-8")

    out = BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)
    return out.getvalue()
