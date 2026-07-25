# -*- coding: utf-8 -*-
"""Tests de las funciones puras de ingest_core (parseo, normalización, fechas, hash, validación).

No tocan la base de datos: validan la lógica que decide en qué "cubo" cae cada dato.
Ejecutar desde la carpeta predictive/:  python -m pytest -q
"""
from app.ingest_core import (
    parse_ubicacion, _to_date, normalize_insumo, normalize_unidad,
    get_subsistema_code, content_hash, natural_key, parse_rows, validate, check_columns,
)


# ----------------------- parse_ubicacion -----------------------
def test_ubicacion_nivel_y_zona():
    nivel, zona, punto, original = parse_ubicacion("NV. 1070, Bocamina")
    assert nivel == "NV.1070"
    assert zona == "Bocamina"
    assert punto is None
    assert original == "NV. 1070, Bocamina"


def test_ubicacion_superficie():
    nivel, zona, _, _ = parse_ubicacion("Superficie, Taller")
    assert nivel == "Superficie"
    assert zona == "Taller"


def test_ubicacion_vacia_usa_defaults():
    nivel, zona, punto, original = parse_ubicacion("")
    assert (nivel, zona, punto) == ("Interior Mina", "General", None)
    assert original == "Sin ubicacion"


def test_ubicacion_detecta_punto():
    # "refugio" se reconoce como punto, no como zona
    nivel, zona, punto, _ = parse_ubicacion("NV. 800, Rampa, refugio")
    assert nivel == "NV.800"
    assert zona == "Rampa"
    assert punto == "refugio"


# ----------------------- _to_date -----------------------
def test_to_date_iso():
    assert _to_date("2025-07-15") == "2025-07-15"


def test_to_date_dd_mm_yyyy():
    assert _to_date("15/07/2025") == "2025-07-15"


def test_to_date_serial_excel():
    # Serial 1 = 1899-12-31 (base 1899-12-30 + 1 día)
    assert _to_date(1) == "1899-12-31"


def test_to_date_invalida():
    assert _to_date(None) is None
    assert _to_date("nan") is None
    assert _to_date("texto suelto") is None


# ----------------------- normalize_insumo / unidad -----------------------
def test_normalize_insumo_mapeo():
    assert normalize_insumo("RJ 45") == "Conector RJ45"
    assert normalize_insumo("cable UTP") == "Cable UTP"


def test_normalize_insumo_colapsa_espacios():
    assert normalize_insumo("  Foo   Bar ") == "Foo Bar"


def test_normalize_insumo_none():
    assert normalize_insumo(None) is None
    assert normalize_insumo("   ") is None


def test_normalize_unidad():
    assert normalize_unidad("METROS") == "M"
    assert normalize_unidad("Litros") == "LT"
    assert normalize_unidad("und") == "UN"
    assert normalize_unidad("cualquier") == "UN"


# ----------------------- get_subsistema_code -----------------------
def test_subsistema_por_parentesis():
    assert get_subsistema_code("Cámara Averiado (CCTV)") == "CCTV"


def test_subsistema_wifi_normalizado():
    assert get_subsistema_code("AP caído (WI-FI)") == "WIFI"


def test_subsistema_por_mapa_de_causa():
    assert get_subsistema_code("AP inoperativo") == "WIFI"


def test_subsistema_default_dat():
    assert get_subsistema_code("algo desconocido") == "DAT"


# ----------------------- content_hash -----------------------
def _act(**over):
    base = {
        "periodo": "2025-07-01", "nivel": "NV.1070", "zona": "Bocamina", "punto": None,
        "causa_raiz": "X", "fecha_inicio": "2025-07-01", "detalle": "d",
        "cant_personas": 2, "tiempo_horas": 3.0,
        "insumos": [{"name": "A", "cantidad": 1}, {"name": "B", "cantidad": 2}],
    }
    base.update(over)
    return base


def test_hash_es_independiente_del_orden_de_insumos():
    a = _act()
    b = _act(insumos=[{"name": "B", "cantidad": 2}, {"name": "A", "cantidad": 1}])
    assert content_hash(a) == content_hash(b)


def test_hash_cambia_si_cambia_un_campo():
    assert content_hash(_act()) != content_hash(_act(cant_personas=3))


def test_natural_key_normaliza_mayusculas():
    k1 = natural_key("NV.1070", "Bocamina", "X", "2025-07-01", "Detalle")
    k2 = natural_key("nv.1070", "bocamina", "x", "2025-07-01", "detalle")
    assert k1 == k2


# ----------------------- parse_rows (modelo de bloque) -----------------------
def test_parse_rows_cabecera_con_insumos_hijos():
    rows = [
        {"Ubicación": "NV. 1070, Bocamina", "Cant. Person": 2, "Tiempo": 3,
         "Causa Raiz": "Cámara Averiado (CCTV)", "Tipo": "Incidente", "IM/SUP": "IM",
         "Fecha inic.": "2025-07-01", "Periodo": "2025-07-01", "Detalle": "x",
         "INSUMO": "RJ 45", "CANTIDAD": 4, "Unidad": "UN"},
        {"INSUMO": "cable UTP", "CANTIDAD": "1O", "Unidad": "M"},  # hijo; '1O' -> 10
        {"INSUMO": None, "CANTIDAD": None},                        # fila vacía: se ignora
    ]
    acts = parse_rows(rows)
    assert len(acts) == 1
    a = acts[0]
    assert a["subsistema"] == "CCTV"
    assert a["tipo"] == "Incidente"
    assert len(a["insumos"]) == 2
    # la 'O' de la cantidad se interpreta como 0 -> 10.0
    assert a["insumos"][1]["name"] == "Cable UTP"
    assert a["insumos"][1]["cantidad"] == 10.0


def test_parse_rows_insumo_sin_cabecera_se_ignora():
    rows = [{"INSUMO": "X", "CANTIDAD": 1}]
    assert parse_rows(rows) == []


# ----------------------- validate -----------------------
def _catalogos():
    return {"insumos": {"Cable UTP"}, "causas": {"X"}, "unidades": {"UN", "M", "LT"}}


def test_validate_cantidad_invalida_es_error():
    acts = [{
        "nivel": "NV.1070", "zona": "Bocamina", "punto": None,
        "causa_raiz": "X", "causa_raiz_src": "X", "fecha_inicio": "2025-07-01",
        "detalle": "d", "cant_personas": 2, "tiempo_horas": 3.0, "periodo": "2025-07-01",
        "insumos": [{"name": "Cable UTP", "name_src": "cable UTP", "cantidad": 0, "unidad": "M"}],
    }]
    out, summary = validate(acts, _catalogos(), set())
    assert summary["err"] == 1
    assert out[0]["include"] is False
    assert any(i["level"] == "error" for i in out[0]["issues"])


def test_validate_marca_duplicado_en_el_archivo():
    base = {
        "nivel": "NV.1070", "zona": "Bocamina", "punto": None,
        "causa_raiz": "X", "causa_raiz_src": "X", "fecha_inicio": "2025-07-01",
        "detalle": "d", "cant_personas": 2, "tiempo_horas": 3.0, "periodo": "2025-07-01",
        "insumos": [{"name": "Cable UTP", "name_src": "cable UTP", "cantidad": 5, "unidad": "M"}],
    }
    out, summary = validate([dict(base), dict(base)], _catalogos(), set())
    assert summary["total"] == 2
    # el segundo registro idéntico se marca como duplicado dentro del archivo
    assert any(i.get("field") == "_dup" for i in out[1]["issues"])


def test_validate_insumo_nuevo_sugiere():
    acts = [{
        "nivel": "NV.1070", "zona": "Bocamina", "punto": None,
        "causa_raiz": "X", "causa_raiz_src": "X", "fecha_inicio": "2025-07-01",
        "detalle": "d", "cant_personas": 1, "tiempo_horas": 2.0, "periodo": "2025-07-01",
        "insumos": [{"name": "Cable UTPP", "name_src": "Cable UTPP", "cantidad": 3, "unidad": "M"}],
    }]
    out, _ = validate(acts, _catalogos(), set())
    issue = next(i for i in out[0]["issues"] if i["field"] == "insumo")
    assert issue["level"] == "warning"
    assert issue.get("suggestion") == "Cable UTP"  # difflib sugiere el catálogo cercano


# ----------------------- check_columns -----------------------
def test_check_columns_detecta_faltantes():
    rows = [{"Fecha inic.": "2025-07-01", "INSUMO": "x"}]  # faltan Tiempo, Causa Raiz, etc.
    res = check_columns(rows)
    assert res["ok"] is False
    assert "Tiempo" in res["faltan"]
    assert "Ubicación" in res["faltan"]  # no hay ninguna columna con 'Ubic'


def test_check_columns_ok_cuando_estan_todas():
    rows = [{
        "Fecha inic.": "2025-07-01", "Tiempo": 3, "Causa Raiz": "X",
        "INSUMO": "x", "CANTIDAD": 1, "Unidad": "UN", "Ubicación": "NV. 1070",
    }]
    assert check_columns(rows)["ok"] is True
