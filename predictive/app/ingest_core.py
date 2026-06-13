"""Núcleo de ingesta: parseo del Excel (modelo de bloque), normalización,
validación y construcción/inserción a Supabase. Reutiliza la lógica probada de
scripts/ingest.py, pero opera sobre filas JSON (no lee el archivo) para que el
microservicio (Render) la use desde los endpoints /ingest/validate y /commit.
"""
import re
import uuid
import hashlib
import difflib
from datetime import datetime

# ===== UUIDs base (coinciden con seed.sql / ingest.py) =====
UNIDAD_MINERA_ID = "d3f1d530-671e-450f-a42e-13ccb9554fe1"
NAMESPACE_UUID = uuid.UUID("e5124117-640a-4286-90dc-236b2ad68e54")

TIPO_MAP = {
    "Incidente": "76288647-79b8-4c6e-a34f-83602d3345d2",
    "Requerimiento": "c6a9b40b-77f6-4995-b9f1-d007c08a9844",
}
AREA_ID_INFRA = "c525f0e1-7e8c-4a30-80a5-b1a8d052a5ab"
ORIGEN_MAP = {
    "IM": "64816fa8-48be-4d9f-9556-32d84c6c06bc",
    "SUP": "8a972c21-f09c-4f7f-acdf-4db2cbf866ef",
}
SUBSYSTEM_MAP = {
    "DAT": "c4fa48db-4e20-4357-a3a8-4bb9a2d3c748",
    "CCTV": "f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c",
    "RAD": "a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5",
    "TEL": "b4b6d080-60b6-4074-be46-34d602db0786",
    "GEO": "e5f5c04b-cb2b-42fa-b715-db14e2c88fc7",
    "FO": "da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2",
    "WIFI": "df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2",
}
UNIDAD_MEDIDA_MAP = {
    "UN": "e9f96b26-a05e-4c8d-9b55-d14bb22e3745",
    "M": "cf5b6c20-7f22-482a-aef2-f5bb64c7847c",
    "LT": "bf2c8230-8a2b-4a50-b98a-2bb64d88fc44",
}

INSUMO_CLEAN_MAP = {
    "cintillos": "Cintillos", "cintillo": "Cintillos",
    "cinta aislante": "Cinta Aislante", "Cinta aislante": "Cinta Aislante",
    "Cable Leaky feeder": "Cable Leaky Feeder", "Cable leaky feeder": "Cable Leaky Feeder",
    "Cable leaky feeder ": "Cable Leaky Feeder",
    "Cable acometida": "Cable Acometida",
    "RJ 45": "Conector RJ45", "RJ45": "Conector RJ45", "Rj 45": "Conector RJ45", "Rj45": "Conector RJ45",
    "RJ11": "Conector RJ11", "Rj11": "Conector RJ11",
    "AP": "Access Point",
    "Conversor de teléfono": "Conversor de Teléfono", "Convertidor de telefono": "Conversor de Teléfono",
    "Cámara ": "Cámara Dahua", "Cámara IP": "Cámara Dahua", "Cámara analogica": "Cámara Analógica",
    "DVR": "Grabador DVR", "DVR de 16 puertos.": "Grabador DVR 16 Ptos", "DVR de 8 puertos.": "Grabador DVR 8 Ptos",
    "Disco duro": "Disco Duro", "Disco duro ": "Disco Duro", "Disco duro de 10TB": "Disco Duro 10TB",
    "Jack": "Jack RJ45", "JACK": "Jack RJ45",
    "Teléfono analógico": "Teléfono Analógico",
    "Tubo corrugado": "Tubo Corrugado", "Tuberia corrugada ": "Tubo Corrugado",
    "cable UTP": "Cable UTP",
    "Trapo industrial": "Trapo Industrial", "Pantalla TV ": "Pantalla TV",
}
CAUSE_TO_SUBSYSTEM = {
    "Balun Averiado": "CCTV", "Cámara Averiado": "CCTV",
    "Teléfono Averiado": "TEL", "Teléfono averiado": "TEL",
    "Mantenimiento  Correctivo Switch.": "DAT", "Switch apagado por mónoxido": "DAT",
    "Equipo Averiado": "DAT", "Fuente averiada": "DAT",
    "Fuente de radio": "RAD", "Fuente de radio de 12V": "RAD", "Fuente de radio de 24V DC": "RAD",
    "Poste roto por colición de volquete": "RAD", "Termino de explotación": "DAT",
    "REQUERIMIENTO": "DAT", "Mantenimiento Programado": "DAT",
    "AP inoperativo": "WIFI", "Acumulación Monóxido": "DAT",
    "Falla General del Sistemas Eléctrico": "DAT",
}

# Columnas que esperamos en el Excel (orden de referencia)
EXPECTED_COLUMNS = [
    "U.M.", "Mina", "Fecha inic.", "Cant. Person", "Tiempo", "Fecha Fin", "IM/SUP",
    "Ubicación", "Area", "Detalle", "Causa Raiz", "Ticket", "Tipo", "INSUMO",
    "CANTIDAD", "Unidad", "Trabajo Realizado", "Periodo",
]
REQUIRED_COLUMNS = ["Fecha inic.", "Tiempo", "Causa Raiz", "INSUMO", "CANTIDAD", "Unidad"]


# ----------------------- helpers de normalización -----------------------
def clean_text_encoding(text):
    if not isinstance(text, str):
        return text
    repl = {
        "Ubicacin": "Ubicación", "Telfono": "Teléfono", "analgico": "analógico", "Analgico": "Analógico",
        "Cmara": "Cámara", "cmara": "cámara", "unin": "unión", "Unin": "Unión",
        "derivacin": "derivación", "Derivacin": "Derivación", "elctrico": "eléctrico", "Elctrico": "Eléctrico",
        "mnoxido": "monóxido", "Mnoxido": "monóxido", "instalacin": "instalación", "Instalacin": "Instalación",
        "tubera": "tubería", "Tubera": "Tubería", "polucin": "polución", "colicin": "colisión",
        "explotacin": "explotación", "gabinete pequeo": "gabinete pequeño", "pequeo": "pequeño",
        "fibra ptica": "fibra óptica", "ptica": "óptica",
    }
    out = text
    for bad, good in repl.items():
        out = out.replace(bad, good)
    return out


def parse_ubicacion(text):
    if not isinstance(text, str) or not text.strip():
        return "Interior Mina", "General", None, "Sin ubicacion"
    text = clean_text_encoding(text)
    original = text
    text_clean = text.strip().strip(".")
    is_sup = "Superficie" in text_clean or "SUPERFICIE" in text_clean
    nivel, zona, punto = None, None, None
    lvl = re.search(r"(NV\.\s*\d+)", text_clean, re.IGNORECASE)
    if lvl:
        nivel = lvl.group(1).replace(" ", "").upper()
    elif is_sup:
        nivel = "Superficie"
    else:
        nivel = "Interior Mina"
    parts_text = text_clean
    if lvl:
        parts_text = parts_text.replace(lvl.group(0), "")
    if is_sup:
        parts_text = re.sub(r",?\s*Superficie", "", parts_text, flags=re.IGNORECASE)
        parts_text = re.sub(r"Superficie,?\s*", "", parts_text, flags=re.IGNORECASE)
    parts_text = parts_text.strip(", ")
    if "," in parts_text:
        parts = [p.strip() for p in parts_text.split(",") if p.strip()]
    else:
        parts = [p.strip() for p in re.split(r"\s{2,}", parts_text) if p.strip()]
    if len(parts) == 0:
        zona = parts_text if parts_text else "General"
    elif len(parts) == 1:
        zona = parts[0]
    else:
        pc, zp = None, []
        for p in parts:
            if re.match(r"^[P|V|T]-\d+$", p, re.IGNORECASE) or any(
                k in p.lower() for k in ("camara", "refugio", "anexo", "tolva", "gabinete")
            ):
                pc = p
            else:
                zp.append(p)
        if zp:
            zona = " - ".join(zp)
        else:
            zona = "General"
        if pc:
            punto = pc
        else:
            punto = parts[-1]
            zona = " - ".join(parts[:-1])
    nivel = re.sub(r"\s+", " ", nivel).strip() if nivel else "Interior Mina"
    zona = re.sub(r"\s+", " ", zona).strip() if zona else "General"
    punto = re.sub(r"\s+", " ", punto).strip() if punto else None
    return nivel, zona or "General", punto, original


def get_subsistema_code(cause):
    if not isinstance(cause, str):
        return "DAT"
    cause = clean_text_encoding(cause)
    m = re.search(r"\(([A-Za-z\-]+)\)", cause)
    if m:
        code = m.group(1).upper()
        if code in ("WIFI", "WI-FI"):
            code = "WIFI"
        if code in SUBSYSTEM_MAP:
            return code
    if cause.strip() in CAUSE_TO_SUBSYSTEM:
        return CAUSE_TO_SUBSYSTEM[cause.strip()]
    return "DAT"


def normalize_insumo(name):
    if not isinstance(name, str):
        return None
    name = clean_text_encoding(name).strip()
    if not name:
        return None
    if name in INSUMO_CLEAN_MAP:
        return INSUMO_CLEAN_MAP[name]
    return re.sub(r"\s+", " ", name).strip()


def normalize_unidad(unit):
    if not isinstance(unit, str):
        return "UN"
    u = unit.strip().upper()
    if u in ("M", "METROS", "METRO", "METRO LINEAL"):
        return "M"
    if u in ("LT", "LITROS", "LITRO"):
        return "LT"
    if u in ("UN", "UND", "UNIDAD", "UNIDADES"):
        return "UN"
    return "UN"


def _val(row, key):
    """Valor limpio de una celda; None si vacía/NaN."""
    if key not in row:
        return None
    v = row[key]
    if v is None:
        return None
    if isinstance(v, float) and v != v:  # NaN
        return None
    if isinstance(v, str):
        v2 = v.strip()
        return v2 if v2 != "" else None
    return v


def _to_date(v):
    """Normaliza una fecha (ISO, dd/mm/yyyy, yyyy-mm-dd o serial Excel) a 'YYYY-MM-DD'. None si no se puede."""
    if v is None:
        return None
    if isinstance(v, (int, float)) and not (isinstance(v, float) and v != v):
        try:  # serial de Excel
            base = datetime(1899, 12, 30)
            return (base + __import__("datetime").timedelta(days=int(v))).strftime("%Y-%m-%d")
        except Exception:
            return None
    s = str(v).strip()
    if not s or s.lower() in ("nat", "none", "nan"):
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):  # ISO
        return s[:10]
    m = re.match(r"^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})", s)  # dd/mm/yyyy
    if m:
        d, mo, y = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    return None


def _ubic_key(row):
    for k in row.keys():
        if "Ubic" in str(k):
            return k
    return None


# ----------------------- parseo (modelo de bloque) -----------------------
def parse_rows(rows):
    """rows: lista de dicts (una hoja). Devuelve lista de actividades con sus insumos."""
    activities = []
    current = None
    for idx, row in enumerate(rows):
        ubic_key = _ubic_key(row)
        ubic_v = _val(row, ubic_key) if ubic_key else None
        is_parent = any(_val(row, k) is not None for k in
                        ("Cant. Person", "Tiempo", "Causa Raiz", "Tipo", "Detalle")) or ubic_v is not None
        insumo_raw = _val(row, "INSUMO")
        if insumo_raw is None and _val(row, "CANTIDAD") is None and not is_parent:
            continue

        if is_parent:
            nivel, zona, punto, texto = parse_ubicacion(ubic_v)
            causa_src = _val(row, "Causa Raiz")
            causa = clean_text_encoding(causa_src).strip() if causa_src else "Mantenimiento Programado"
            tipo_v = _val(row, "Tipo")
            tipo = "Incidente" if (isinstance(tipo_v, str) and tipo_v.lower().strip() == "incidente") else "Requerimiento"
            origen_v = _val(row, "IM/SUP")
            origen = "SUP" if (isinstance(origen_v, str) and origen_v.upper().strip() == "SUP") else "IM"
            cant_p = _val(row, "Cant. Person")
            tiempo = _val(row, "Tiempo")
            current = {
                "idx": idx,
                "nivel": nivel, "zona": zona, "punto": punto, "texto_original": texto,
                "causa_raiz": causa, "causa_raiz_src": causa_src,
                "subsistema": get_subsistema_code(causa),
                "tipo": tipo, "origen": origen,
                "cant_personas": int(float(cant_p)) if cant_p is not None and str(cant_p).strip() != "" else 0,
                "tiempo_horas": float(tiempo) if tiempo is not None and str(tiempo).strip() != "" else 0.0,
                "fecha_inicio": _to_date(_val(row, "Fecha inic.")),
                "fecha_fin": _to_date(_val(row, "Fecha Fin")),
                "periodo": _to_date(_val(row, "Periodo")),
                "detalle": clean_text_encoding(_val(row, "Detalle")) if _val(row, "Detalle") else None,
                "trabajo_realizado": clean_text_encoding(_val(row, "Trabajo Realizado")) if _val(row, "Trabajo Realizado") else None,
                "ticket": str(_val(row, "Ticket")) if _val(row, "Ticket") is not None else None,
                "insumos": [],
            }
            activities.append(current)

        if insumo_raw is not None and current is not None:
            name = normalize_insumo(insumo_raw)
            if name:
                qty_raw = _val(row, "CANTIDAD")
                try:
                    qty = float(str(qty_raw).strip().replace(" ", "").upper().replace("O", "0")) if qty_raw is not None else None
                except (ValueError, TypeError):
                    qty = None
                current["insumos"].append({
                    "name": name,
                    "name_src": str(insumo_raw).strip(),
                    "cantidad": qty,  # None marca cantidad inválida (la valida validate)
                    "unidad": normalize_unidad(_val(row, "Unidad")),
                    "unidad_src": _val(row, "Unidad"),
                })
    return activities


# ----------------------- hash / clave natural -----------------------
def content_hash(a):
    ins = sorted(f"{i.get('name')}:{i.get('cantidad')}" for i in a.get("insumos", []))
    key = "|".join([
        str(a.get("periodo") or ""), str(a.get("nivel") or ""), str(a.get("zona") or ""),
        str(a.get("punto") or ""), str(a.get("causa_raiz") or ""), str(a.get("fecha_inicio") or ""),
        (a.get("detalle") or "").strip().lower(), str(a.get("cant_personas") or 0),
        str(a.get("tiempo_horas") or 0), ";".join(ins),
    ])
    return hashlib.md5(key.encode("utf-8")).hexdigest()


def natural_key(nivel, zona, causa, fecha, detalle):
    return "|".join([
        str(nivel or "").strip().lower(), str(zona or "").strip().lower(),
        str(causa or "").strip().lower(), str(fecha or "")[:10],
        (detalle or "").strip().lower(),
    ])


# ----------------------- catálogos / claves existentes -----------------------
def load_catalogs(conn):
    cur = conn.cursor()
    cur.execute("SELECT nombre_normalizado FROM insumo")
    insumos = {r[0] for r in cur.fetchall()}
    cur.execute("SELECT nombre FROM cat_causa_raiz")
    causas = {r[0] for r in cur.fetchall()}
    cur.execute("SELECT simbolo FROM cat_unidad_medida")
    unidades = {r[0] for r in cur.fetchall()}
    cur.close()
    return {"insumos": insumos, "causas": causas, "unidades": unidades}


def load_existing_keys(conn, periodos):
    """Claves naturales existentes en BD para los periodos (YYYY-MM) dados."""
    if not periodos:
        return set()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT u.nivel, u.zona, cr.nombre, t.fecha_inicio, t.detalle
        FROM tarea t
        LEFT JOIN ubicacion u ON t.ubicacion_id = u.id
        LEFT JOIN cat_causa_raiz cr ON t.causa_raiz_id = cr.id
        WHERE to_char(t.periodo, 'YYYY-MM') = ANY(%s)
        """,
        [list(periodos)],
    )
    keys = set()
    for nivel, zona, causa, fecha, detalle in cur.fetchall():
        f = fecha.strftime("%Y-%m-%d") if hasattr(fecha, "strftime") else (str(fecha)[:10] if fecha else "")
        keys.add(natural_key(nivel, zona, causa, f, detalle))
    cur.close()
    return keys


def _suggest(name, options):
    m = difflib.get_close_matches(name, list(options), n=1, cutoff=0.6)
    return m[0] if m else None


# ----------------------- validación -----------------------
def validate(activities, catalogs, existing_keys):
    insumos_cat = catalogs.get("insumos", set())
    causas_cat = catalogs.get("causas", set())
    seen_hashes = set()
    ok = warn = err = 0
    for a in activities:
        issues = []
        # Causa no reconocida
        if not a.get("causa_raiz_src"):
            issues.append({"level": "warning", "field": "causa_raiz", "msg": "Sin causa: se asumió 'Mantenimiento Programado'."})
        elif a["causa_raiz"] not in causas_cat:
            sug = _suggest(a["causa_raiz"], causas_cat)
            issues.append({"level": "warning", "field": "causa_raiz",
                           "msg": f"Causa no está en el catálogo.", "suggestion": sug})
        # Fecha / tiempo
        if not a.get("fecha_inicio"):
            issues.append({"level": "warning", "field": "fecha_inicio", "msg": "Sin fecha de inicio."})
        if (a.get("tiempo_horas") or 0) <= 0:
            issues.append({"level": "warning", "field": "tiempo_horas", "msg": "Tiempo en 0 (no contará para ANS)."})
        if (a.get("cant_personas") or 0) < 0:
            issues.append({"level": "error", "field": "cant_personas", "msg": "Cantidad de personas negativa."})
        # Insumos
        for ins in a.get("insumos", []):
            if ins.get("cantidad") is None or ins["cantidad"] <= 0:
                issues.append({"level": "error", "field": "insumo",
                               "msg": f"Cantidad inválida para '{ins.get('name_src')}'."})
            if ins.get("name") not in insumos_cat:
                sug = _suggest(ins.get("name", ""), insumos_cat)
                issues.append({"level": "warning", "field": "insumo",
                               "msg": f"Insumo nuevo: '{ins.get('name')}'.", "suggestion": sug})
        # Duplicados
        h = content_hash(a)
        a["import_hash"] = h
        if h in seen_hashes:
            issues.append({"level": "warning", "field": "_dup", "msg": "Duplicado dentro del archivo."})
        seen_hashes.add(h)
        nk = natural_key(a["nivel"], a["zona"], a["causa_raiz"], a.get("fecha_inicio"), a.get("detalle"))
        if nk in existing_keys:
            issues.append({"level": "warning", "field": "_dup", "msg": "Ya existe una actividad igual en la BD."})

        a["issues"] = issues
        a["include"] = not any(i["level"] == "error" for i in issues)  # por defecto excluir las que tienen error
        if any(i["level"] == "error" for i in issues):
            err += 1
        elif issues:
            warn += 1
        else:
            ok += 1
    return activities, {"ok": ok, "warn": warn, "err": err, "total": len(activities)}


def check_columns(rows):
    if not rows:
        return {"ok": False, "faltan": REQUIRED_COLUMNS}
    cols = set(rows[0].keys())
    has_ubic = any("Ubic" in str(c) for c in cols)
    faltan = [c for c in REQUIRED_COLUMNS if c not in cols]
    if not has_ubic:
        faltan = faltan + ["Ubicación"]
    return {"ok": len(faltan) == 0, "faltan": faltan}


# ----------------------- inserción -----------------------
def _resolve_insumo_id(cur, name, unidad_id, cache):
    if name in cache:
        return cache[name]
    cur.execute("SELECT id FROM insumo WHERE nombre_normalizado = %s", [name])
    row = cur.fetchone()
    if row:
        cache[name] = row[0]
        return row[0]
    new_id = str(uuid.uuid5(NAMESPACE_UUID, f"insumo-{name}"))
    cur.execute(
        "INSERT INTO insumo (id, nombre_normalizado, unidad_medida_id) VALUES (%s, %s, %s) "
        "ON CONFLICT (nombre_normalizado) DO NOTHING",
        [new_id, name, unidad_id],
    )
    cur.execute("SELECT id FROM insumo WHERE nombre_normalizado = %s", [name])
    rid = cur.fetchone()[0]
    cache[name] = rid
    return rid


def _resolve_causa_id(cur, causa, cache):
    if causa in cache:
        return cache[causa]
    sub_id = SUBSYSTEM_MAP[get_subsistema_code(causa)]
    cur.execute("SELECT id FROM cat_causa_raiz WHERE subsistema_id = %s AND nombre = %s", [sub_id, causa])
    row = cur.fetchone()
    if row:
        cache[causa] = row[0]
        return row[0]
    new_id = str(uuid.uuid5(NAMESPACE_UUID, f"causa-{causa}"))
    cur.execute(
        "INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES (%s, %s, %s) "
        "ON CONFLICT (subsistema_id, nombre) DO NOTHING",
        [new_id, sub_id, causa],
    )
    cur.execute("SELECT id FROM cat_causa_raiz WHERE subsistema_id = %s AND nombre = %s", [sub_id, causa])
    rid = cur.fetchone()[0]
    cache[causa] = rid
    return rid


def build_and_insert(activities, conn):
    """Inserta solo actividades válidas. Dedup por import_hash. Devuelve reporte."""
    cur = conn.cursor()
    inserted = skipped = 0
    insumo_cache, causa_cache = {}, {}
    for a in activities:
        if any(i.get("level") == "error" for i in a.get("issues", [])):
            skipped += 1
            continue
        nivel, zona, punto = a["nivel"], a["zona"], a.get("punto")
        ubic_id = str(uuid.uuid5(NAMESPACE_UUID, f"ubicacion-{nivel}-{zona}-{punto}"))
        cur.execute(
            "INSERT INTO ubicacion (id, unidad_minera_id, nivel, zona, punto, texto_original) "
            "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
            [ubic_id, UNIDAD_MINERA_ID, nivel, zona, punto, a.get("texto_original") or "Sin ubicacion"],
        )
        causa_id = _resolve_causa_id(cur, a["causa_raiz"], causa_cache)
        h = a.get("import_hash") or content_hash(a)
        tarea_id = str(uuid.uuid5(NAMESPACE_UUID, f"tarea-{h}"))
        cur.execute(
            """
            INSERT INTO tarea (id, unidad_minera_id, ticket, tipo_id, area_id, origen_id, ubicacion_id,
                               causa_raiz_id, cant_personas, tiempo_horas, fecha_inicio, fecha_fin, periodo,
                               detalle, trabajo_realizado, estado, import_hash)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'Cerrada',%s)
            ON CONFLICT (import_hash) WHERE import_hash IS NOT NULL DO NOTHING
            """,
            [tarea_id, UNIDAD_MINERA_ID, a.get("ticket"), TIPO_MAP[a["tipo"]], AREA_ID_INFRA,
             ORIGEN_MAP[a["origen"]], ubic_id, causa_id, a.get("cant_personas") or 0,
             a.get("tiempo_horas") or 0, a.get("fecha_inicio"), a.get("fecha_fin"), a.get("periodo"),
             a.get("detalle"), a.get("trabajo_realizado"), h],
        )
        if cur.rowcount and cur.rowcount > 0:
            for ins in a.get("insumos", []):
                if ins.get("cantidad") is None or ins["cantidad"] <= 0:
                    continue
                unidad_id = UNIDAD_MEDIDA_MAP.get(ins.get("unidad", "UN"), UNIDAD_MEDIDA_MAP["UN"])
                insumo_id = _resolve_insumo_id(cur, ins["name"], unidad_id, insumo_cache)
                cur.execute(
                    "INSERT INTO tarea_insumo (tarea_id, insumo_id, cantidad, unidad_medida_id) "
                    "VALUES (%s, %s, %s, %s)",
                    [tarea_id, insumo_id, ins["cantidad"], unidad_id],
                )
            inserted += 1
        else:
            skipped += 1  # ya existía (import_hash duplicado)
    conn.commit()
    cur.close()
    return {"inserted": inserted, "skipped": skipped, "total": len(activities)}
