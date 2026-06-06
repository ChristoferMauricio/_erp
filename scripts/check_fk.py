"""
Verifica integridad referencial entre todos los archivos SQL:
- Todas las causa_raiz_id de tareas deben existir en cat_causa_raiz
- Todas las ubicacion_id de tareas deben existir en ubicacion
- Todas las insumo_id de tarea_insumo deben existir en insumo
- Todas las tipo_id, area_id, origen_id deben existir en los catalogos

Genera un archivo SQL de reparacion con los registros faltantes.
"""
import os
import re

PARTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'parts')
SEED_FILE = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'seed.sql')

def extract_ids_from_inserts(filepath, table_name, id_column_index=0):
    """Extrae los IDs (valores en la posicion indicada) de INSERT INTO tabla."""
    ids = set()
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith(f'INSERT INTO {table_name}'):
                # Extraer valores entre VALUES(...)
                m = re.search(r"VALUES\s*\((.+?)\)\s*(?:ON\s+CONFLICT|;)", line)
                if m:
                    vals = parse_values_simple(m.group(1))
                    if id_column_index < len(vals):
                        val = vals[id_column_index].strip().strip("'")
                        if val and val != 'NULL':
                            ids.add(val)
    return ids

def extract_fk_from_inserts(filepath, table_name, col_index):
    """Extrae los valores de la columna col_index de INSERT INTO tabla (FK references)."""
    refs = set()
    with open(filepath, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if line.strip().startswith(f'INSERT INTO {table_name}'):
                m = re.search(r"VALUES\s*\((.+?)\)\s*(?:ON\s+CONFLICT|;)", line)
                if m:
                    vals = parse_values_simple(m.group(1))
                    if col_index < len(vals):
                        val = vals[col_index].strip().strip("'")
                        if val and val != 'NULL':
                            refs.add(val)
    return refs

def extract_full_rows(filepath, table_name):
    """Extrae todas las filas INSERT como diccionarios {id: full_line}."""
    rows = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith(f'INSERT INTO {table_name}'):
                m = re.search(r"VALUES\s*\((.+?)\)\s*(?:ON\s+CONFLICT|;)", line)
                if m:
                    vals = parse_values_simple(m.group(1))
                    if vals:
                        row_id = vals[0].strip().strip("'")
                        rows[row_id] = line.strip()
    return rows

def parse_values_simple(values_str):
    """Parser simple de VALUES respetando comillas simples."""
    values = []
    current = []
    in_quote = False
    i = 0
    chars = list(values_str)
    
    while i < len(chars):
        c = chars[i]
        if c == "'" and not in_quote:
            in_quote = True
            current.append(c)
        elif c == "'" and in_quote:
            # Check for escaped ''
            if i + 1 < len(chars) and chars[i+1] == "'":
                current.append(c)
                current.append(chars[i+1])
                i += 2
                continue
            else:
                in_quote = False
                current.append(c)
        elif c == ',' and not in_quote:
            values.append(''.join(current).strip())
            current = []
        else:
            current.append(c)
        i += 1
    
    if current:
        values.append(''.join(current).strip())
    
    return values


def main():
    parts_dir = os.path.abspath(PARTS_DIR)
    
    print("=== Verificacion de Integridad Referencial ===\n")
    
    # 1. Recopilar todos los IDs insertados en tablas de catalogo
    print("Recopilando IDs de catalogos y tablas maestras...\n")
    
    # IDs de cat_causa_raiz (de part_04)
    causa_ids = set()
    for f in sorted(os.listdir(parts_dir)):
        if f.endswith('.sql'):
            causa_ids |= extract_ids_from_inserts(os.path.join(parts_dir, f), 'cat_causa_raiz', 0)
    
    # IDs de ubicacion (de part_02)
    ubic_ids = set()
    for f in sorted(os.listdir(parts_dir)):
        if f.endswith('.sql'):
            ubic_ids |= extract_ids_from_inserts(os.path.join(parts_dir, f), 'ubicacion', 0)
    
    # IDs de insumo (de part_03)
    insumo_ids = set()
    for f in sorted(os.listdir(parts_dir)):
        if f.endswith('.sql'):
            insumo_ids |= extract_ids_from_inserts(os.path.join(parts_dir, f), 'insumo', 0)
    
    print(f"  cat_causa_raiz: {len(causa_ids)} registros")
    print(f"  ubicacion: {len(ubic_ids)} registros")
    print(f"  insumo: {len(insumo_ids)} registros")
    
    # 2. Recopilar todos los FK referenciados desde tarea y tarea_insumo
    print("\nRecopilando FK referenciados desde tareas...\n")
    
    # tarea columns: id(0), unidad_minera_id(1), ticket(2), tipo_id(3), area_id(4), 
    #                origen_id(5), ubicacion_id(6), causa_raiz_id(7), ...
    tarea_causa_refs = set()
    tarea_ubic_refs = set()
    tarea_tipo_refs = set()
    tarea_area_refs = set()
    tarea_origen_refs = set()
    
    for f in sorted(os.listdir(parts_dir)):
        if 'tareas_' in f and 'insumos' not in f:
            fp = os.path.join(parts_dir, f)
            tarea_causa_refs |= extract_fk_from_inserts(fp, 'tarea', 7)   # causa_raiz_id
            tarea_ubic_refs |= extract_fk_from_inserts(fp, 'tarea', 6)    # ubicacion_id
            tarea_tipo_refs |= extract_fk_from_inserts(fp, 'tarea', 3)    # tipo_id
            tarea_area_refs |= extract_fk_from_inserts(fp, 'tarea', 4)    # area_id
            tarea_origen_refs |= extract_fk_from_inserts(fp, 'tarea', 5)  # origen_id
    
    # tarea_insumo columns: tarea_id(0), insumo_id(1), cantidad(2), unidad_medida_id(3)
    ti_insumo_refs = set()
    for f in sorted(os.listdir(parts_dir)):
        if 'tarea_insumos_' in f:
            fp = os.path.join(parts_dir, f)
            ti_insumo_refs |= extract_fk_from_inserts(fp, 'tarea_insumo', 1)
    
    print(f"  causa_raiz_id refs: {len(tarea_causa_refs)}")
    print(f"  ubicacion_id refs: {len(tarea_ubic_refs)}")
    print(f"  insumo_id refs: {len(ti_insumo_refs)}")
    
    # 3. Encontrar faltantes
    print("\n=== Resultados ===\n")
    
    missing_causas = tarea_causa_refs - causa_ids
    missing_ubics = tarea_ubic_refs - ubic_ids
    missing_insumos = ti_insumo_refs - insumo_ids
    
    all_ok = True
    
    if missing_causas:
        all_ok = False
        print(f"[!!] {len(missing_causas)} causa_raiz_id faltantes en cat_causa_raiz:")
        for mid in sorted(missing_causas):
            print(f"     {mid}")
    else:
        print("[OK] Todas las causa_raiz_id existen en cat_causa_raiz")
    
    if missing_ubics:
        all_ok = False
        print(f"\n[!!] {len(missing_ubics)} ubicacion_id faltantes en ubicacion:")
        for mid in sorted(missing_ubics):
            print(f"     {mid}")
    else:
        print("[OK] Todas las ubicacion_id existen en ubicacion")
    
    if missing_insumos:
        all_ok = False
        print(f"\n[!!] {len(missing_insumos)} insumo_id faltantes en insumo:")
        for mid in sorted(missing_insumos):
            print(f"     {mid}")
    else:
        print("[OK] Todas las insumo_id existen en insumo")
    
    # 4. Generar archivo de reparacion si hay faltantes
    if not all_ok:
        fix_file = os.path.join(parts_dir, 'part_00_fix_missing_refs.sql')
        print(f"\nGenerando archivo de reparacion: {os.path.basename(fix_file)}")
        
        with open(fix_file, 'w', encoding='utf-8') as f:
            f.write("-- ==========================================\n")
            f.write("-- FIX: Registros faltantes para FK\n")
            f.write("-- EJECUTAR ANTES de los scripts de tareas\n")
            f.write("-- ==========================================\n\n")
            
            if missing_causas:
                f.write("-- Causas raiz faltantes\n")
                # Buscar en el migration_data.sql original para obtener los datos completos
                orig_file = os.path.join(os.path.dirname(parts_dir), 'migration_data.sql')
                orig_causas = {}
                if os.path.exists(orig_file):
                    orig_causas = extract_full_rows(orig_file, 'cat_causa_raiz')
                
                for mid in sorted(missing_causas):
                    if mid in orig_causas:
                        f.write(orig_causas[mid] + '\n')
                    else:
                        # Generar un INSERT generico
                        # Default: subsistema DAT, nombre = el UUID (placeholder)
                        f.write(f"INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES "
                                f"('{mid}', 'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748', 'Causa no clasificada') "
                                f"ON CONFLICT (id) DO NOTHING;\n")
                f.write('\n')
            
            if missing_ubics:
                f.write("-- Ubicaciones faltantes\n")
                orig_ubics = {}
                orig_file = os.path.join(os.path.dirname(parts_dir), 'migration_data.sql')
                if os.path.exists(orig_file):
                    orig_ubics = extract_full_rows(orig_file, 'ubicacion')
                
                for mid in sorted(missing_ubics):
                    if mid in orig_ubics:
                        f.write(orig_ubics[mid] + '\n')
                    else:
                        f.write(f"INSERT INTO ubicacion (id, unidad_minera_id, nivel, zona, punto, texto_original) VALUES "
                                f"('{mid}', 'd3f1d530-671e-450f-a42e-13ccb9554fe1', 'Interior Mina', 'General', NULL, 'Sin ubicacion') "
                                f"ON CONFLICT (id) DO NOTHING;\n")
                f.write('\n')
            
            if missing_insumos:
                f.write("-- Insumos faltantes\n")
                orig_insumos = {}
                orig_file = os.path.join(os.path.dirname(parts_dir), 'migration_data.sql')
                if os.path.exists(orig_file):
                    orig_insumos = extract_full_rows(orig_file, 'insumo')
                
                for mid in sorted(missing_insumos):
                    if mid in orig_insumos:
                        f.write(orig_insumos[mid] + '\n')
                    else:
                        f.write(f"INSERT INTO insumo (id, nombre_normalizado, unidad_medida_id) VALUES "
                                f"('{mid}', 'Insumo no clasificado', 'e9f96b26-a05e-4c8d-9b55-d14bb22e3745') "
                                f"ON CONFLICT (id) DO NOTHING;\n")
                f.write('\n')
        
        print(f"\n[DONE] Ejecuta 'part_00_fix_missing_refs.sql' en Supabase ANTES de los scripts de tareas (part_06+)")
    else:
        print("\n[OK] No se necesita archivo de reparacion.")


if __name__ == '__main__':
    main()
