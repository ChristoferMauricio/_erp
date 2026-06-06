import os
import re

def main():
    parts_dir = 'supabase/parts'
    part_04_path = os.path.join(parts_dir, 'part_04_causas_raiz.sql')
    seed_path = 'supabase/seed.sql'
    
    # 1. Parse part_04_causas_raiz.sql to get (subsistema_id, nombre) -> id
    causa_map = {}
    print(f"Reading {part_04_path}...")
    with open(part_04_path, 'r', encoding='utf-8') as f:
        for line in f:
            if 'INSERT INTO cat_causa_raiz' in line:
                # Format: INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES ('id', 'subsistema_id', 'nombre') ON CONFLICT...
                match = re.search(r"VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)", line)
                if match:
                    uuid_id, subsistema_id, nombre = match.groups()
                    causa_map[(subsistema_id, nombre.strip())] = uuid_id
                else:
                    # Try single quote escaping or other formats
                    # Let's do a more robust parse
                    # P. ej. VALUES ('...', '...', '...')
                    vals_match = re.search(r"VALUES\s*\((.+?)\)\s*(?:ON CONFLICT|;)", line)
                    if vals_match:
                        parts = [p.strip().strip("'") for p in vals_match.group(1).split(',')]
                        if len(parts) >= 3:
                            uuid_id = parts[0]
                            subsistema_id = parts[1]
                            nombre = parts[2]
                            causa_map[(subsistema_id, nombre.strip())] = uuid_id

    print(f"Loaded {len(causa_map)} causa_raiz mappings from part_04.")

    # Let's inspect causa_map keys and values
    for k, v in list(causa_map.items())[:3]:
        print(f"  {k} -> {v}")

    # 2. Read seed.sql and rewrite it
    print(f"Reading {seed_path}...")
    with open(seed_path, 'r', encoding='utf-8') as f:
        seed_content = f.read()

    # We want to replace the sections of cat_causa_raiz inserts.
    # The inserts look like:
    # INSERT INTO cat_causa_raiz (subsistema_id, nombre) VALUES
    # ('b4b6d080-60b6-4074-be46-34d602db0786', 'Instalación Nueva (TEL)'),
    # ...
    # ('b4b6d080-60b6-4074-be46-34d602db0786', 'Mantenimiento Programado (TEL)');
    
    # We can do this programmatically or by replacing the whole INSERT block for cat_causa_raiz.
    # Actually, let's write a new SQL segment that deletes all records and inserts them with explicit IDs,
    # and replace the cat_causa_raiz segment in seed.sql.
    # Let's check how the seed.sql is structured.
    # Since seed.sql is small (93 lines), let's just rewrite the whole file's cat_causa_raiz section!
    
    # Let's define the exact lines we want to generate for seed.sql.
    # We'll group them by subsistema like the original seed.sql.
    
    new_seed_blocks = []
    
    # Subsistemas in order: TEL, CCTV, DAT, RAD, GEO, FO, WIFI
    subsistemas = {
        'b4b6d080-60b6-4074-be46-34d602db0786': 'Telefonía (TEL)',
        'f92ee93c-2ee2-4bf1-a8e5-f5b24479e02c': 'CCTV (CCTV)',
        'c4fa48db-4e20-4357-a3a8-4bb9a2d3c748': 'Datos (DAT)',
        'a0c325c4-722a-4db3-90d5-1fa8d3c7c4e5': 'Radial / Leaky Feeder (RAD)',
        'e5f5c04b-cb2b-42fa-b715-db14e2c88fc7': 'Geófonos (GEO)',
        'da4d4a8e-a4b5-4b35-862d-9442a8b9e6c2': 'Fibra Óptica (FO)',
        'df3a0c50-b0d4-42b7-a3a4-1234a8b9e6c2': 'Wi-Fi (WIFI)'
    }
    
    # We will build the new SQL text for seed.sql
    new_causas_sql = "-- 8. Insertar Catálogo de Causas Raíz Semilla (por Subsistema)\n"
    
    for sub_id, label in subsistemas.items():
        new_causas_sql += f"-- {label}\n"
        new_causas_sql += "INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES\n"
        
        # Find all causas for this subsistema
        sub_causas = []
        for (sid, name), uid in causa_map.items():
            if sid == sub_id:
                # normalize name if needed, but keep original
                sub_causas.append((uid, name))
        
        # Sort or keep order
        lines = []
        for uid, name in sub_causas:
            # Escape single quotes in name if they exist
            escaped_name = name.replace("'", "''")
            lines.append(f"('{uid}', '{sub_id}', '{escaped_name}')")
        
        new_causas_sql += ",\n".join(lines) + "\nON CONFLICT (subsistema_id, nombre) DO UPDATE SET id = EXCLUDED.id;\n\n"
        
    # Let's locate "-- 8. Insertar Catálogo de Causas Raíz Semilla (por Subsistema)" in seed_content
    prefix_idx = seed_content.find("-- 8. Insertar Catálogo de Causas Raíz Semilla")
    if prefix_idx != -1:
        prefix = seed_content[:prefix_idx]
        new_seed_content = prefix + new_causas_sql.strip() + "\n"
        
        with open(seed_path, 'w', encoding='utf-8') as f:
            f.write(new_seed_content)
        print("Updated seed.sql successfully!")
    else:
        print("Error: Could not find Causes block in seed.sql")
        
    # 3. Create a repair SQL script for the user to execute directly in Supabase SQL editor
    fix_sql_path = 'supabase/parts/fix_cat_causa_raiz.sql'
    print(f"Creating repair SQL: {fix_sql_path}...")
    with open(fix_sql_path, 'w', encoding='utf-8') as f:
        f.write("-- ==========================================\n")
        f.write("-- REPARACIÓN: Alinear IDs de cat_causa_raiz con Tareas\n")
        f.write("-- Ejecuta esto en Supabase SQL Editor para corregir\n")
        f.write("-- la desalineación de UUIDs generados por el seed.\n")
        f.write("-- ==========================================\n\n")
        
        f.write("-- 1. Limpiar causas raíz antiguas (que no tengan relaciones válidas)\n")
        f.write("DELETE FROM cat_causa_raiz;\n\n")
        
        f.write("-- 2. Insertar causas raíz con UUIDs correctos alineados con la migración\n")
        f.write("INSERT INTO cat_causa_raiz (id, subsistema_id, nombre) VALUES\n")
        
        all_vals = []
        for (sid, name), uid in causa_map.items():
            escaped_name = name.replace("'", "''")
            all_vals.append(f"('{uid}', '{sid}', '{escaped_name}')")
            
        f.write(",\n".join(all_vals) + ";\n")
        
    print("Repair SQL created successfully!")

if __name__ == '__main__':
    main()
