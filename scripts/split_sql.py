"""
Divide el archivo migration_data.sql en partes más pequeñas
para ejecutarlas en el SQL Editor de Supabase.

Uso:
    python scripts/split_sql.py

Genera archivos en supabase/parts/:
    part_01_ubicaciones.sql
    part_02_insumos.sql
    part_03_causas_raiz.sql
    part_04_almacen_stock.sql
    part_05_tareas_001.sql
    part_06_tareas_002.sql
    ...
    part_XX_tarea_insumos_001.sql
    ...
    part_XX_final.sql
"""

import os
import re

# Configuración
SOURCE_FILE = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'migration_data.sql')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'parts')
MAX_STATEMENTS_PER_FILE = 400  # Supabase SQL Editor maneja bien ~400 sentencias

def main():
    # Leer el archivo fuente
    source_path = os.path.abspath(SOURCE_FILE)
    print(f"Leyendo: {source_path}")
    
    with open(source_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Crear directorio de salida
    output_dir = os.path.abspath(OUTPUT_DIR)
    os.makedirs(output_dir, exist_ok=True)
    
    # Separar las líneas
    lines = content.split('\n')
    
    # Clasificar las sentencias por sección
    sections = {
        'setup': [],          # BEGIN, DISABLE TRIGGER, etc.
        'ubicaciones': [],
        'insumos': [],
        'causas_raiz': [],
        'almacen_stock': [],
        'tareas': [],
        'tarea_insumos': [],
        'teardown': [],       # ENABLE TRIGGER, COMMIT
    }
    
    current_section = 'setup'
    
    for line in lines:
        line_clean = line.strip()
        
        # Detectar secciones por comentarios
        if '-- 1. Insertar Ubicaciones' in line:
            current_section = 'ubicaciones'
            continue
        elif '-- 2. Insertar Insumos' in line:
            current_section = 'insumos'
            continue
        elif '-- 3. Insertar Causas' in line:
            current_section = 'causas_raiz'
            continue
        elif '-- 4. Insertar Almacén' in line or '-- 4. Insertar Almac' in line:
            current_section = 'almacen_stock'
            continue
        elif '-- 5. Insertar Tareas' in line:
            current_section = 'tareas'
            continue
        elif '-- 6. Insertar Consumo' in line:
            current_section = 'tarea_insumos'
            continue
        
        # Detectar ENABLE TRIGGER y COMMIT como teardown
        if 'ENABLE TRIGGER' in line or line_clean == 'COMMIT;':
            current_section = 'teardown'
        
        # Ignorar líneas vacías y comentarios decorativos
        if not line_clean or line_clean.startswith('--'):
            if current_section in ('setup', 'teardown'):
                sections[current_section].append(line)
            continue
        
        sections[current_section].append(line)
    
    print(f"\nSentencias por sección:")
    for name, stmts in sections.items():
        # Contar solo sentencias SQL reales (no líneas vacías)
        real = [s for s in stmts if s.strip() and not s.strip().startswith('--')]
        print(f"  {name}: {len(real)} sentencias")
    
    # Generar archivos
    file_counter = 1
    files_created = []
    
    def write_part(filename, statements, header_comment):
        """Escribe un archivo SQL con las sentencias dadas."""
        nonlocal file_counter
        full_name = f"part_{file_counter:02d}_{filename}.sql"
        filepath = os.path.join(output_dir, full_name)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"-- ==========================================\n")
            f.write(f"-- {header_comment}\n")
            f.write(f"-- Archivo {file_counter}: {full_name}\n")
            f.write(f"-- ==========================================\n\n")
            for stmt in statements:
                f.write(stmt.rstrip('\r') + '\n')
            f.write('\n')
        
        files_created.append(full_name)
        real_count = len([s for s in statements if s.strip() and not s.strip().startswith('--')])
        print(f"  [OK] {full_name} ({real_count} sentencias)")
        file_counter += 1
    
    print(f"\nGenerando archivos en: {output_dir}\n")
    
    # 1. Setup (DISABLE TRIGGERS)
    setup_stmts = [s for s in sections['setup'] if s.strip()]
    write_part("setup_triggers", setup_stmts, "SETUP: Deshabilitar triggers para carga masiva")
    
    # 2. Ubicaciones
    write_part("ubicaciones", sections['ubicaciones'], "Insertar Ubicaciones")
    
    # 3. Insumos
    write_part("insumos", sections['insumos'], "Insertar Insumos Normalizados")
    
    # 4. Causas Raíz
    write_part("causas_raiz", sections['causas_raiz'], "Insertar Causas Raíz")
    
    # 5. Almacén y Stock
    write_part("almacen_stock", sections['almacen_stock'], "Insertar Almacén y Stock Inicial")
    
    # 6. Tareas (dividir en chunks)
    tareas = [s for s in sections['tareas'] if s.strip()]
    chunk_num = 1
    for i in range(0, len(tareas), MAX_STATEMENTS_PER_FILE):
        chunk = tareas[i:i + MAX_STATEMENTS_PER_FILE]
        write_part(
            f"tareas_{chunk_num:03d}",
            chunk,
            f"Insertar Tareas (lote {chunk_num}, filas {i+1}-{min(i+MAX_STATEMENTS_PER_FILE, len(tareas))})"
        )
        chunk_num += 1
    
    # 7. Tarea-Insumos (dividir en chunks)
    tarea_insumos = [s for s in sections['tarea_insumos'] if s.strip()]
    chunk_num = 1
    for i in range(0, len(tarea_insumos), MAX_STATEMENTS_PER_FILE):
        chunk = tarea_insumos[i:i + MAX_STATEMENTS_PER_FILE]
        write_part(
            f"tarea_insumos_{chunk_num:03d}",
            chunk,
            f"Insertar Consumos de Insumos (lote {chunk_num}, filas {i+1}-{min(i+MAX_STATEMENTS_PER_FILE, len(tarea_insumos))})"
        )
        chunk_num += 1
    
    # 8. Teardown (ENABLE TRIGGERS + COMMIT)
    teardown_stmts = [s for s in sections['teardown'] if s.strip()]
    write_part("final_enable_triggers", teardown_stmts, "FINAL: Rehabilitar triggers y COMMIT")
    
    # Resumen
    print(f"\n{'='*50}")
    print(f"✅ {len(files_created)} archivos generados en: {output_dir}")
    print(f"\n📋 ORDEN DE EJECUCIÓN en Supabase SQL Editor:")
    print(f"   Ejecuta cada archivo en orden, uno por uno:\n")
    for i, name in enumerate(files_created, 1):
        print(f"   {i}. {name}")
    print(f"\n⚠️  IMPORTANTE: Ejecuta los archivos EN ORDEN.")
    print(f"   El primero deshabilita triggers y el último los rehabilita + COMMIT.")


if __name__ == '__main__':
    main()
