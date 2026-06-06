import os
import re
import uuid
import pandas as pd
import numpy as np

# Rutas de archivos
EXCEL_PATH = r"d:\OneDrive_UNI\OneDrive - UNIVERSIDAD NACIONAL DE INGENIERIA\Documents\ESCRITORIO\Cris\2026\2026-1\9 Emprendimiento\_erp\Yauricocha - CORONA.xlsx"
OUTPUT_SQL_PATH = r"d:\OneDrive_UNI\OneDrive - UNIVERSIDAD NACIONAL DE INGENIERIA\Documents\ESCRITORIO\Cris\2026\2026-1\9 Emprendimiento\_erp\supabase\migration_data.sql"

# UUIDs de base (deben coincidir con seed.sql)
EMPRESA_ID = "99f4852c-c516-43c3-9b88-1d2a450550c6"
UNIDAD_MINERA_ID = "d3f1d530-671e-450f-a42e-13ccb9554fe1"

TIPO_MAP = {
    'Incidente': '76288647-79b8-4c6e-a34f-83602d3345d2',
    'Requerimiento': 'c6a9b40b-77f6-4995-b9f1-d007c08a9844'
}

AREA_MAP = {
    'Infraestructura': 'c525f0e1-7e8c-4a30-80a5-b1a8d052a5ab'
}

ORIGEN_MAP = {
    'IM': '64816fa8-48be-4d9f-9556-32d84c6c06bc',
    'SUP': '8a972c21-f09c-4f7f-acdf-4db2cbf866ef'
}

SUBSYSTEM_MAP = {
    'DAT': 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748',
    'CCTV': 'f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c',
    'RAD': 'a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5',
    'TEL': 'b4b6d080-60b6-4074-be46-34d602db0786',
    'GEO': 'e5f5c04b-cb2b-42fa-b715-db14e2c88fc7',
    'FO': 'da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2',
    'WIFI': 'df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2'
}

UNIDAD_MEDIDA_MAP = {
    'UN': 'e9f96b26-a05e-4c8d-9b55-d14bb22e3745',
    'M': 'cf5b6c20-7f22-482a-aef2-f5bb64c7847c',
    'LT': 'bf2c8230-8a2b-4a50-b98a-2bb64d88fc44'
}

# Diccionario de normalización de Insumos
INSUMO_CLEAN_MAP = {
    'cintillos': 'Cintillos',
    'cintillo': 'Cintillos',
    'cinta aislante': 'Cinta Aislante',
    'Cinta aislante': 'Cinta Aislante',
    'Cable Leaky Feeder': 'Cable Leaky Feeder',
    'Cable Leaky feeder': 'Cable Leaky Feeder',
    'Cable leaky feeder': 'Cable Leaky Feeder',
    'Cable leaky feeder ': 'Cable Leaky Feeder',
    'Cable Acometida': 'Cable Acometida',
    'Cable acometida': 'Cable Acometida',
    'RJ 45': 'Conector RJ45',
    'RJ45': 'Conector RJ45',
    'Rj 45': 'Conector RJ45',
    'Rj45': 'Conector RJ45',
    'RJ11': 'Conector RJ11',
    'Rj11': 'Conector RJ11',
    'Access Point': 'Access Point',
    'AP': 'Access Point',
    'Conversor de teléfono': 'Conversor de Teléfono',
    'Convertidor de telefono': 'Conversor de Teléfono',
    'Cámara ': 'Cámara Dahua',
    'Cámara Dahua': 'Cámara Dahua',
    'Cámara IP': 'Cámara Dahua',
    'Cámara analogica': 'Cámara Analógica',
    'DVR': 'Grabador DVR',
    'DVR de 16 puertos.': 'Grabador DVR 16 Ptos',
    'DVR de 8 puertos.': 'Grabador DVR 8 Ptos',
    'Disco duro': 'Disco Duro',
    'Disco duro ': 'Disco Duro',
    'Disco duro de 10TB': 'Disco Duro 10TB',
    'Jack': 'Jack RJ45',
    'JACK': 'Jack RJ45',
    'Teléfono Analógico': 'Teléfono Analógico',
    'Teléfono analógico': 'Teléfono Analógico',
    'Tubo corrugado': 'Tubo Corrugado',
    'Tuberia corrugada ': 'Tubo Corrugado',
    'cable UTP': 'Cable UTP',
    'Cable UTP': 'Cable UTP',
    'Trapo industrial': 'Trapo Industrial',
    'Pantalla TV': 'Pantalla TV',
    'Pantalla TV ': 'Pantalla TV'
}

# Diccionario manual para causas sin paréntesis en el Excel
CAUSE_TO_SUBSYSTEM = {
    'Balun Averiado': 'CCTV',
    'Cámara Averiado': 'CCTV',
    'Teléfono Averiado': 'TEL',
    'Teléfono averiado': 'TEL',
    'Mantenimiento  Correctivo Switch.': 'DAT',
    'Switch apagado por mónoxido': 'DAT',
    'Equipo Averiado': 'DAT',
    'Fuente averiada': 'DAT',
    'Fuente de radio': 'RAD',
    'Fuente de radio de 12V': 'RAD',
    'Fuente de radio de 24V DC': 'RAD',
    'Poste roto por colición de volquete': 'RAD',
    'Termino de explotación': 'DAT',
    'REQUERIMIENTO': 'DAT',
    'Mantenimiento Programado': 'DAT',
    'AP inoperativo': 'WIFI',
    'Acumulación Monóxido': 'DAT',
    'Falla General del Sistemas Eléctrico': 'DAT',
}

# Namespace fijo para generar UUIDs consistentes y deterministas
NAMESPACE_UUID = uuid.UUID('e5124117-640a-4286-90dc-236b2ad68e54')

def clean_text_encoding(text):
    """Limpia caracteres dañados de la codificación de Excel."""
    if not isinstance(text, str):
        return text
    # Reemplazar codificación rota de Excel
    replacements = {
        'Ubicacin': 'Ubicación',
        'Ubicacin': 'Ubicación',
        'Telfono': 'Teléfono',
        'analgico': 'analógico',
        'Analgico': 'Analógico',
        'Cmara': 'Cámara',
        'cmara': 'cámara',
        'unin': 'unión',
        'Unin': 'Unión',
        'derivacin': 'derivación',
        'Derivacin': 'Derivación',
        'elctrico': 'eléctrico',
        'Elctrico': 'Eléctrico',
        'mnoxido': 'monóxido',
        'Mnoxido': 'monóxido',
        'instalacin': 'instalación',
        'Instalacin': 'Instalación',
        'tubera': 'tubería',
        'Tubera': 'Tubería',
        'polucin': 'polución',
        'colicin': 'colisión',
        'explotacin': 'explotación',
        'gabinete pequeo': 'gabinete pequeño',
        'pequeo': 'pequeño',
        'fibra ptica': 'fibra óptica',
        'ptica': 'óptica'
    }
    cleaned = text
    for bad, good in replacements.items():
        cleaned = cleaned.replace(bad, good)
    return cleaned

def parse_ubicacion(text):
    """Parsea una cadena libre de ubicación en nivel, zona y punto."""
    if not isinstance(text, str):
        return "Interior Mina", "General", None
    
    text = clean_text_encoding(text)
    text_clean = text.strip().strip('.')
    is_superficie = "Superficie" in text_clean or "SUPERFICIE" in text_clean
    
    nivel = None
    zona = None
    punto = None
    
    # Buscar nivel (NV.XXXX)
    level_match = re.search(r'(NV\.\s*\d+)', text_clean, re.IGNORECASE)
    if level_match:
        nivel = level_match.group(1).replace(" ", "").upper()
    elif is_superficie:
        nivel = "Superficie"
    else:
        nivel = "Interior Mina"
        
    # Remover nivel del texto para extraer zona y punto
    parts_text = text_clean
    if level_match:
        parts_text = parts_text.replace(level_match.group(0), "")
    if is_superficie:
        parts_text = re.sub(r',?\s*Superficie', '', parts_text, flags=re.IGNORECASE)
        parts_text = re.sub(r'Superficie,?\s*', '', parts_text, flags=re.IGNORECASE)
        
    parts_text = parts_text.strip(', ')
    
    # Separar por comas o por espacios dobles
    if ',' in parts_text:
        parts = [p.strip() for p in parts_text.split(',') if p.strip()]
    else:
        parts = [p.strip() for p in re.split(r'\s{2,}', parts_text) if p.strip()]
        
    if len(parts) == 0:
        zona = parts_text if parts_text else "General"
    elif len(parts) == 1:
        zona = parts[0]
    else:
        # Buscar candidato de punto (P-0, etc. o Refugios)
        point_candidate = None
        zone_parts = []
        for p in parts:
            if re.match(r'^[P|V|T]-\d+$', p, re.IGNORECASE) or 'camara' in p.lower() or 'refugio' in p.lower() or 'anexo' in p.lower() or 'tolva' in p.lower() or 'gabinete' in p.lower():
                point_candidate = p
            else:
                zone_parts.append(p)
        
        if zone_parts:
            zona = " - ".join(zone_parts)
        else:
            zona = "General"
            
        if point_candidate:
            punto = point_candidate
        else:
            punto = parts[-1]
            zona = " - ".join(parts[:-1])
            
    # Formatear
    if nivel: nivel = re.sub(r'\s+', ' ', nivel).strip()
    if zona: zona = re.sub(r'\s+', ' ', zona).strip()
    if punto: punto = re.sub(r'\s+', ' ', punto).strip()
    
    if not zona:
        zona = "General"
        
    return nivel, zona, punto

def get_subsistema_id(cause):
    """Infiere el ID de subsistema a partir del texto Causa Raiz."""
    if not isinstance(cause, str):
        return SUBSYSTEM_MAP['DAT']
    
    cause = clean_text_encoding(cause)
    # Patrón: Buscar código entre paréntesis
    match = re.search(r'\(([A-Za-z\-]+)\)', cause)
    if match:
        code = match.group(1).upper()
        # Mapear variaciones
        if code == 'WIFI' or code == 'WI-FI':
            code = 'WIFI'
        if code in SUBSYSTEM_MAP:
            return SUBSYSTEM_MAP[code]
            
    cause_clean = cause.strip()
    if cause_clean in CAUSE_TO_SUBSYSTEM:
        code = CAUSE_TO_SUBSYSTEM[cause_clean]
        return SUBSYSTEM_MAP[code]
        
    return SUBSYSTEM_MAP['DAT'] # Default

def normalize_insumo(name):
    """Normaliza y limpia el nombre de un insumo."""
    if not isinstance(name, str):
        return None
    name = clean_text_encoding(name)
    name_clean = name.strip()
    if name_clean in INSUMO_CLEAN_MAP:
        return INSUMO_CLEAN_MAP[name_clean]
    # Limpieza estándar
    cleaned = re.sub(r'\s+', ' ', name_clean)
    return cleaned.strip()

def normalize_unidad(unit):
    """Normaliza el símbolo de unidad de medida."""
    if not isinstance(unit, str):
        return 'UN'
    u = unit.strip().upper()
    if u in ['M', 'METROS', 'METRO', 'METRO LINEAL']:
        return 'M'
    elif u in ['UN', 'UND', 'UNIDAD', 'UNIDADES']:
        return 'UN'
    elif u in ['LT', 'LITROS', 'LITRO']:
        return 'LT'
    return 'UN' # Default seguro

def escape_sql(val):
    """Escapa cadenas de texto para consultas SQL."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    # Es cadena
    v = str(val).replace("'", "''")
    return f"'{v}'"

def main():
    print(f"Leyendo Excel: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH, sheet_name='YAURICOCHA')
    
    # Encontrar la columna de Ubicación (puede tener problemas de codificación)
    ubic_col = [c for c in df.columns if 'Ubic' in c][0]
    
    # Listas para guardar los registros a insertar
    ubicaciones = {}
    insumos = {}
    causas_raiz = {}
    tareas = []
    
    current_task = None
    
    print("Agrupando tareas y procesando consumos de insumos...")
    for idx, row in df.iterrows():
        # Lógica de identificación de Fila Padre
        is_parent = (
            pd.notnull(row['Cant. Person']) or 
            pd.notnull(row['Tiempo']) or 
            pd.notnull(row[ubic_col]) or 
            pd.notnull(row['Detalle'])
        )
        
        # Omitir filas completamente vacías
        is_empty = pd.isnull(row['INSUMO']) and pd.isnull(row['CANTIDAD']) and not is_parent
        if is_empty:
            continue
            
        # Limpieza básica
        tipo_original = clean_text_encoding(row.get('Tipo'))
        tipo_nombre = 'Incidente' if (isinstance(tipo_original, str) and tipo_original.lower().strip() == 'incidente') else 'Requerimiento'
        tipo_id = TIPO_MAP[tipo_nombre]
        
        area_original = clean_text_encoding(row.get('Area'))
        area_id = AREA_MAP['Infraestructura']
        
        origen_original = clean_text_encoding(row.get('IM/SUP'))
        origen_nombre = 'SUP' if (isinstance(origen_original, str) and origen_original.upper().strip() == 'SUP') else 'IM'
        origen_id = ORIGEN_MAP[origen_nombre]
        
        if is_parent:
            # Procesar Ubicación
            ubic_text = clean_text_encoding(row[ubic_col])
            nivel, zona, punto = parse_ubicacion(ubic_text)
            ubic_key = (nivel, zona, punto)
            if ubic_key not in ubicaciones:
                # Generar UUID estable para la ubicación
                ubic_uuid = str(uuid.uuid5(NAMESPACE_UUID, f"ubicacion-{nivel}-{zona}-{punto}"))
                ubicaciones[ubic_key] = {
                    'id': ubic_uuid,
                    'nivel': nivel,
                    'zona': zona,
                    'punto': punto,
                    'texto_original': ubic_text
                }
            
            # Procesar Causa Raíz
            causa_text = clean_text_encoding(row.get('Causa Raiz'))
            if pd.isnull(causa_text) or str(causa_text).strip() == '':
                causa_text = 'Mantenimiento Programado'
            causa_text = causa_text.strip()
            
            subsistema_id = get_subsistema_id(causa_text)
            
            if causa_text not in causas_raiz:
                causa_uuid = str(uuid.uuid5(NAMESPACE_UUID, f"causa-{causa_text}"))
                causas_raiz[causa_text] = {
                    'id': causa_uuid,
                    'subsistema_id': subsistema_id,
                    'nombre': causa_text
                }
            
            # Crear cabecera de Tarea
            task_uuid = str(uuid.uuid5(NAMESPACE_UUID, f"tarea-{idx}"))
            
            # Formatear fechas
            fecha_inc = row['Fecha inic.']
            fecha_fin = row['Fecha Fin']
            periodo = row['Periodo']
            
            fecha_inc_str = fecha_inc.strftime('%Y-%m-%d %H:%M:%S%z') if isinstance(fecha_inc, pd.Timestamp) else str(fecha_inc)
            fecha_fin_str = fecha_fin.strftime('%Y-%m-%d %H:%M:%S%z') if isinstance(fecha_fin, pd.Timestamp) else None
            periodo_str = periodo.strftime('%Y-%m-%d') if isinstance(periodo, pd.Timestamp) else None
            
            current_task = {
                'id': task_uuid,
                'ticket': row.get('Ticket'),
                'tipo_id': tipo_id,
                'area_id': area_id,
                'origen_id': origen_id,
                'ubicacion_id': ubicaciones[ubic_key]['id'],
                'causa_raiz_id': causas_raiz[causa_text]['id'],
                'cant_personas': int(row['Cant. Person']) if pd.notnull(row['Cant. Person']) else 0,
                'tiempo_horas': float(row['Tiempo']) if pd.notnull(row['Tiempo']) else 0.0,
                'fecha_inicio': fecha_inc_str,
                'fecha_fin': fecha_fin_str,
                'periodo': periodo_str,
                'detalle': clean_text_encoding(row.get('Detalle')),
                'trabajo_realizado': clean_text_encoding(row.get('Trabajo Realizado')),
                'insumos': []
            }
            tareas.append(current_task)
            
        # Si la fila actual (sea padre o hijo) tiene insumos, agregarlo
        insumo_raw = row.get('INSUMO')
        if pd.notnull(insumo_raw) and str(insumo_raw).strip() != '':
            insumo_norm = normalize_insumo(insumo_raw)
            if insumo_norm:
                unidad_simbolo = normalize_unidad(row.get('Unidad'))
                unidad_id = UNIDAD_MEDIDA_MAP[unidad_simbolo]
                
                if insumo_norm not in insumos:
                    insumo_uuid = str(uuid.uuid5(NAMESPACE_UUID, f"insumo-{insumo_norm}"))
                    insumos[insumo_norm] = {
                        'id': insumo_uuid,
                        'nombre': insumo_norm,
                        'unidad_id': unidad_id
                    }
                    
                raw_qty = row.get('CANTIDAD', 1.0)
                if pd.isnull(raw_qty):
                    cantidad = 1.0
                else:
                    qty_str = str(raw_qty).strip().replace(" ", "").upper().replace("O", "0")
                    try:
                        cantidad = float(qty_str)
                    except ValueError:
                        cantidad = 1.0
                if cantidad <= 0:
                    cantidad = 1.0
                    
                insumo_rel = {
                    'insumo_id': insumos[insumo_norm]['id'],
                    'cantidad': cantidad,
                    'unidad_medida_id': unidad_id
                }
                
                if current_task is not None:
                    current_task['insumos'].append(insumo_rel)
                else:
                    print(f"WARNING: Consumo de insumo '{insumo_norm}' en fila {idx} no tiene tarea padre asociada!")

    print(f"Procesamiento finalizado:")
    print(f" - Ubicaciones únicas: {len(ubicaciones)}")
    print(f" - Insumos únicos: {len(insumos)}")
    print(f" - Causas raíz únicas: {len(causas_raiz)}")
    print(f" - Tareas creadas: {len(tareas)}")

    # Escribir archivo SQL final
    print(f"Generando archivo SQL en: {OUTPUT_SQL_PATH}")
    with open(OUTPUT_SQL_PATH, 'w', encoding='utf-8') as f:
        f.write("-- ==========================================================\n")
        f.write("-- MIGRACIÓN DE DATOS HISTÓRICOS (YAURICOCHA - CORONA)\n")
        f.write("-- ==========================================================\n\n")
        f.write("BEGIN;\n\n")
        
        # Deshabilitar triggers temporalmente para mejorar rendimiento en inserción masiva
        f.write("ALTER TABLE ubicacion DISABLE TRIGGER ALL;\n")
        f.write("ALTER TABLE insumo DISABLE TRIGGER ALL;\n")
        f.write("ALTER TABLE cat_causa_raiz DISABLE TRIGGER ALL;\n")
        f.write("ALTER TABLE tarea DISABLE TRIGGER ALL;\n")
        f.write("ALTER TABLE tarea_insumo DISABLE TRIGGER ALL;\n\n")
        
        # 1. Insertar Ubicaciones
        f.write("-- 1. Insertar Ubicaciones\n")
        for u_key, u_val in ubicaciones.items():
            f.write(f"INSERT INTO ubicacion (id, unidad_minera_id, nivel, zona, punto, texto_original) VALUES "
                    f"('{u_val['id']}', '{UNIDAD_MINERA_ID}', {escape_sql(u_val['nivel'])}, {escape_sql(u_val['zona'])}, {escape_sql(u_val['punto'])}, {escape_sql(u_val['texto_original'])}) "
                    f"ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")
        
        # 2. Insertar Insumos
        f.write("-- 2. Insertar Insumos Normalizados\n")
        for i_key, i_val in insumos.items():
            f.write(f"INSERT INTO insumo (id, nombre_normalizado, unidad_medida_id) VALUES "
                    f"('{i_val['id']}', {escape_sql(i_val['nombre'])}, '{i_val['unidad_id']}') "
                    f"ON CONFLICT (nombre_normalizado) DO UPDATE SET unidad_medida_id = EXCLUDED.unidad_medida_id;\n")
        f.write("\n")
        
        # 3. Insertar Causas Raíz no contempladas en el seed original
        f.write("-- 3. Insertar Causas Raíz adicionales\n")
        for c_key, c_val in causas_raiz.items():
            f.write(f"INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES "
                    f"('{c_val['id']}', '{c_val['subsistema_id']}', {escape_sql(c_val['nombre'])}) "
                    f"ON CONFLICT (subsistema_id, nombre) DO NOTHING;\n")
        f.write("\n")
        
        # 4. Insertar Almacén por defecto y Stock inicial para Yauricocha
        f.write("-- 4. Insertar Almacén por defecto y Stock Inicial\n")
        almacen_uuid = str(uuid.uuid5(NAMESPACE_UUID, f"almacen-principal-{UNIDAD_MINERA_ID}"))
        f.write(f"INSERT INTO almacen (id, unidad_minera_id, nombre) VALUES "
                f"('{almacen_uuid}', '{UNIDAD_MINERA_ID}', 'Almacén Central Yauricocha') "
                f"ON CONFLICT (unidad_minera_id, nombre) DO NOTHING;\n")
        for i_key, i_val in insumos.items():
            # Seed 1000 unidades en almacén para stock de prueba
            f.write(f"INSERT INTO stock (almacen_id, insumo_id, cantidad, punto_reorden) VALUES "
                    f"('{almacen_uuid}', '{i_val['id']}', 1000.0000, 10.0000) "
                    f"ON CONFLICT (almacen_id, insumo_id) DO NOTHING;\n")
        f.write("\n")

        # 5. Insertar Tareas Cabeceras
        f.write("-- 5. Insertar Tareas (Órdenes de Trabajo)\n")
        for t in tareas:
            # Rellenar con 'Cerrada' por defecto
            f.write(f"INSERT INTO tarea (id, unidad_minera_id, ticket, tipo_id, area_id, origen_id, ubicacion_id, causa_raiz_id, cant_personas, tiempo_horas, fecha_inicio, fecha_fin, periodo, detalle, trabajo_realizado, estado) VALUES "
                    f"('{t['id']}', '{UNIDAD_MINERA_ID}', {escape_sql(t['ticket'])}, '{t['tipo_id']}', '{t['area_id']}', '{t['origen_id']}', '{t['ubicacion_id']}', "
                    f"'{t['causa_raiz_id']}', {t['cant_personas']}, {t['tiempo_horas']}, '{t['fecha_inicio']}', {escape_sql(t['fecha_fin'])}, {escape_sql(t['periodo'])}, "
                    f"{escape_sql(t['detalle'])}, {escape_sql(t['trabajo_realizado'])}, 'Cerrada');\n")
        f.write("\n")
        
        # 6. Insertar Tarea Insumos (Líneas Hijas)
        f.write("-- 6. Insertar Consumo de Insumos (tarea_insumo)\n")
        for t in tareas:
            for ins in t['insumos']:
                f.write(f"INSERT INTO tarea_insumo (tarea_id, insumo_id, cantidad, unidad_medida_id) VALUES "
                        f"('{t['id']}', '{ins['insumo_id']}', {ins['cantidad']}, '{ins['unidad_medida_id']}');\n")
        f.write("\n")
        
        # Rehabilitar triggers
        f.write("ALTER TABLE ubicacion ENABLE TRIGGER ALL;\n")
        f.write("ALTER TABLE insumo ENABLE TRIGGER ALL;\n")
        f.write("ALTER TABLE cat_causa_raiz ENABLE TRIGGER ALL;\n")
        f.write("ALTER TABLE tarea ENABLE TRIGGER ALL;\n")
        f.write("ALTER TABLE tarea_insumo ENABLE TRIGGER ALL;\n\n")
        
        f.write("COMMIT;\n")
        
    print("¡Migración SQL generada con éxito!")

    # Inserción directa en base de datos
    db_url = os.getenv("DATABASE_URL")
    import sys
    run_direct = "--direct" in sys.argv
    
    if db_url:
        should_run = run_direct
        if not should_run:
            try:
                ans = input("\n¿Deseas insertar los datos directamente en la base de datos de Supabase? (s/n): ").strip().lower()
                should_run = (ans == 's')
            except (KeyboardInterrupt, EOFError):
                should_run = False
            
        if should_run:
            print("Iniciando inserción directa en Supabase via pg8000...")
            try:
                import pg8000.dbapi
                
                # Parsear la cadena de conexión
                pattern = r"postgresql://(?P<user>[^:]+):(?P<password>[^@]+)@(?P<host>[^:/]+)(:(?P<port>\d+))?/(?P<database>.+)"
                match = re.match(pattern, db_url)
                if not match:
                    print("Error: El formato de DATABASE_URL no es válido.")
                    return
                
                params = match.groupdict()
                port = int(params['port']) if params['port'] else 5432
                
                print(f"Conectando a PostgreSQL en {params['host']}:{port}...")
                conn = pg8000.dbapi.connect(
                    user=params['user'],
                    password=params['password'],
                    host=params['host'],
                    port=port,
                    database=params['database']
                )
                
                cursor = conn.cursor()
                print("Leyendo archivo SQL generado...")
                with open(OUTPUT_SQL_PATH, 'r', encoding='utf-8') as sql_file:
                    sql_content = sql_file.read()
                
                print("Parseando sentencias SQL...")
                statements = []
                current = []
                in_quote = False
                quote_char = None
                escaped = False
                chars = list(sql_content)
                i = 0
                
                # Ignorar comentarios SQL antes de parsear para mayor rapidez
                sql_lines = []
                for line in sql_content.split('\n'):
                    if not line.strip().startswith('--'):
                        sql_lines.append(line)
                sql_clean = '\n'.join(sql_lines)
                
                chars = list(sql_clean)
                while i < len(chars):
                    char = chars[i]
                    if escaped:
                        current.append(char)
                        escaped = False
                        i += 1
                        continue
                    if char == '\\':
                        current.append(char)
                        escaped = True
                        i += 1
                        continue
                    if (char == "'" or char == '"') and not in_quote:
                        in_quote = True
                        quote_char = char
                        current.append(char)
                    elif char == quote_char and in_quote:
                        if i + 1 < len(chars) and chars[i+1] == quote_char:
                            current.append(char)
                            current.append(chars[i+1])
                            i += 2
                            continue
                        else:
                            in_quote = False
                            quote_char = None
                            current.append(char)
                    elif char == ';' and not in_quote:
                        current.append(char)
                        statements.append(''.join(current).strip())
                        current = []
                    else:
                        current.append(char)
                    i += 1
                    
                if current:
                    stmt = ''.join(current).strip()
                    if stmt:
                        statements.append(stmt)
                
                statements = [s for s in statements if s]
                print(f"Ejecutando {len(statements)} sentencias en bloque de transacción...")
                
                # pg8000 auto-begins transaction.
                for idx, stmt in enumerate(statements):
                    if idx % 250 == 0:
                        print(f" - Progreso: {idx}/{len(statements)} sentencias ejecutadas.")
                    cursor.execute(stmt)
                
                conn.commit()
                print("¡Inserción directa completada con éxito en la base de datos Supabase!")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error durante la inserción directa: {e}")
                if 'conn' in locals() and conn:
                    conn.rollback()
                    conn.close()

if __name__ == '__main__':
    main()
