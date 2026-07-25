import os
import re
import json
import pandas as pd
import numpy as np

SQL_PATH = os.path.join(os.path.dirname(__file__), "..", "supabase", "migration_data.sql")
OUTPUT_EXCEL_ROOT = os.path.join(os.path.dirname(__file__), "..", "Yauricocha - CORONA.xlsx")
OUTPUT_EXCEL_WEB = os.path.join(os.path.dirname(__file__), "..", "web", "Yauricocha - CORONA.xlsx")
OUTPUT_JSON_LIB = os.path.join(os.path.dirname(__file__), "..", "web", "src", "lib", "seed_tasks.json")

def parse_sql_values(line):
    m = re.search(r"VALUES\s*\((.*)\);?\s*$", line, re.DOTALL | re.IGNORECASE)
    if not m:
        return []
    val_str = m.group(1).strip()
    
    tokens = []
    in_quote = False
    current = []
    i = 0
    while i < len(val_str):
        c = val_str[i]
        if c == "'" and not in_quote:
            in_quote = True
        elif c == "'" and in_quote:
            if i + 1 < len(val_str) and val_str[i + 1] == "'":
                current.append("'")
                i += 1
            else:
                in_quote = False
        elif c == ',' and not in_quote:
            token = "".join(current).strip()
            tokens.append(token)
            current = []
        else:
            current.append(c)
        i += 1
    if current:
        tokens.append("".join(current).strip())
        
    cleaned = []
    for t in tokens:
        if t.upper() == 'NULL':
            cleaned.append(None)
        elif t.startswith("'") and t.endswith("'"):
            cleaned.append(t[1:-1])
        else:
            cleaned.append(t)
    return cleaned

def safe_float(val):
    if val is None:
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def main():
    print("Leyendo migration_data.sql...")
    with open(SQL_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    cat_tipo = {
        '76288647-79b8-4c6e-a34f-83602d3345d2': 'Incidente',
        'c6a9b40b-77f6-4995-b9f1-d007c08a9844': 'Requerimiento'
    }
    cat_origen = {
        '64816fa8-48be-4d9f-9556-32d84c6c06bc': 'IM',
        '8a972c21-f09c-4f7f-acdf-4db2cbf866ef': 'SUP'
    }
    cat_unidad = {
        'e9f96b26-a05e-4c8d-9b55-d14bb22e3745': 'UN',
        'cf5b6c20-7f22-482a-aef2-f5bb64c7847c': 'M',
        'bf2c8230-8a2b-4a50-b98a-2bb64d88fc44': 'LT'
    }

    ubicaciones = {}
    causas = {}
    insumos_catalog = {}
    tareas = {}
    tarea_insumos = []

    for line in lines:
        line_str = line.strip()
        if not line_str.startswith("INSERT INTO"):
            continue

        if "INSERT INTO ubicacion" in line_str:
            vals = parse_sql_values(line_str)
            if len(vals) >= 6:
                uid, _, nivel, zona, punto, texto_orig = vals[0], vals[1], vals[2], vals[3], vals[4], vals[5]
                ubicaciones[uid] = {
                    'nivel': nivel or 'Interior Mina',
                    'zona': zona or 'General',
                    'punto': punto,
                    'texto_original': texto_orig or ''
                }

        elif "INSERT INTO cat_causa_raiz" in line_str:
            vals = parse_sql_values(line_str)
            if len(vals) >= 3:
                cid, sub_id, cname = vals[0], vals[1], vals[2]
                causas[cid] = cname

        elif "INSERT INTO insumo" in line_str:
            vals = parse_sql_values(line_str)
            if len(vals) >= 4:
                iid, codigo, nombre_raw, nombre_norm = vals[0], vals[1], vals[2], vals[3]
                insumos_catalog[iid] = nombre_norm or nombre_raw

        elif "INSERT INTO tarea (" in line_str:
            vals = parse_sql_values(line_str)
            # id, unidad_minera_id, ticket, tipo_id, area_id, origen_id, ubicacion_id, causa_raiz_id, cant_personas, tiempo_horas, fecha_inicio, fecha_fin, periodo, detalle, trabajo_realizado, estado
            if len(vals) >= 15:
                tid = vals[0]
                ticket = vals[2]
                tipo_id = vals[3]
                origen_id = vals[5]
                ubic_id = vals[6]
                causa_id = vals[7]
                cant_p = safe_float(vals[8])
                tiempo_h = safe_float(vals[9])
                fecha_ini = vals[10]
                fecha_fin = vals[11]
                periodo = vals[12]
                detalle = vals[13]
                trabajo_r = vals[14] if len(vals) > 14 else detalle

                u_obj = ubicaciones.get(ubic_id, {'nivel': 'Interior Mina', 'zona': 'General', 'punto': None, 'texto_original': ''})
                c_name = causas.get(causa_id, 'Mantenimiento Programado')
                t_nombre = cat_tipo.get(tipo_id, 'Requerimiento')
                o_nombre = cat_origen.get(origen_id, 'IM')

                tareas[tid] = {
                    'id': tid,
                    'ticket': ticket,
                    'tipo': t_nombre,
                    'area': 'Infraestructura',
                    'origen': o_nombre,
                    'ubicacion': u_obj,
                    'causa_raiz': c_name,
                    'cant_personas': cant_p,
                    'tiempo_horas': tiempo_h,
                    'horas_hombre': cant_p * tiempo_h,
                    'fecha_inicio': fecha_ini or '',
                    'fecha_fin': fecha_fin,
                    'periodo': periodo,
                    'detalle': detalle,
                    'trabajo_realizado': trabajo_r,
                    'insumos': []
                }

        elif "INSERT INTO tarea_insumo" in line_str:
            vals = parse_sql_values(line_str)
            if len(vals) >= 5:
                ti_id, tid, iid, um_id, cant = vals[0], vals[1], vals[2], vals[3], vals[4]
                cant_f = safe_float(cant)
                ins_name = insumos_catalog.get(iid, 'Insumo')
                um_sym = cat_unidad.get(um_id, 'UN')
                tarea_insumos.append({
                    'tarea_id': tid,
                    'name': ins_name,
                    'cantidad': cant_f,
                    'unidad': um_sym,
                    'esLineaSeparada': False
                })

    for ti in tarea_insumos:
        if ti['tarea_id'] in tareas:
            tareas[ti['tarea_id']]['insumos'].append({
                'name': ti['name'],
                'cantidad': ti['cantidad'],
                'unidad': ti['unidad'],
                'esLineaSeparada': ti['esLineaSeparada']
            })

    taskList = list(tareas.values())
    print(f"Total Tareas reconstruidas: {len(taskList)}")

    # 1. Guardar JSON en web/src/lib/seed_tasks.json
    os.makedirs(os.path.dirname(OUTPUT_JSON_LIB), exist_ok=True)
    with open(OUTPUT_JSON_LIB, 'w', encoding='utf-8') as f:
        json.dump(taskList, f, ensure_ascii=False, indent=2)
    print(f"OK Guardado JSON en {OUTPUT_JSON_LIB}")

    # 2. Generar Excel Yauricocha - CORONA.xlsx
    rows_excel = []
    for t in taskList:
        base_row = {
            'Ticket': t['ticket'],
            'Tipo': t['tipo'],
            'Area': t['area'],
            'IM/SUP': t['origen'],
            'Ubicacion': t['ubicacion']['texto_original'] or f"{t['ubicacion']['nivel']}, {t['ubicacion']['zona']}",
            'Causa Raiz': t['causa_raiz'],
            'Cant. Person': t['cant_personas'],
            'Tiempo': t['tiempo_horas'],
            'Fecha inic.': t['fecha_inicio'],
            'Fecha Fin': t['fecha_fin'],
            'Periodo': t['periodo'],
            'Detalle': t['detalle'],
            'Trabajo Realizado': t['trabajo_realizado'],
            'INSUMO': t['insumos'][0]['name'] if len(t['insumos']) > 0 else None,
            'CANTIDAD': t['insumos'][0]['cantidad'] if len(t['insumos']) > 0 else None,
            'Unidad': t['insumos'][0]['unidad'] if len(t['insumos']) > 0 else None,
        }
        rows_excel.append(base_row)

        for i in range(1, len(t['insumos'])):
            ins = t['insumos'][i]
            ins_row = {
                'Ticket': None,
                'Tipo': None,
                'Area': None,
                'IM/SUP': None,
                'Ubicacion': None,
                'Causa Raiz': None,
                'Cant. Person': None,
                'Tiempo': None,
                'Fecha inic.': None,
                'Fecha Fin': None,
                'Periodo': None,
                'Detalle': None,
                'Trabajo Realizado': None,
                'INSUMO': ins['name'],
                'CANTIDAD': ins['cantidad'],
                'Unidad': ins['unidad'],
            }
            rows_excel.append(ins_row)

    df = pd.DataFrame(rows_excel)
    with pd.ExcelWriter(OUTPUT_EXCEL_ROOT, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='YAURICOCHA', index=False)
    print(f"OK Excel creado en {OUTPUT_EXCEL_ROOT}")

    with pd.ExcelWriter(OUTPUT_EXCEL_WEB, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='YAURICOCHA', index=False)
    print(f"OK Excel creado en {OUTPUT_EXCEL_WEB}")

if __name__ == "__main__":
    main()
