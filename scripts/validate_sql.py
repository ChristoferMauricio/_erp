"""
Valida todos los archivos SQL en supabase/parts/ buscando:
1. NULL en columnas NOT NULL
2. Fechas mal formateadas
3. Valores vacíos sospechosos
4. Comillas mal escapadas
"""
import os
import re

PARTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'parts')

# Definir columnas NOT NULL por tabla (basado en 0001_initial_schema.sql)
# Formato: tabla -> { columna_index: nombre_columna }
# Los indices son 0-based respecto al VALUES(...)
NOT_NULL_COLUMNS = {
    'ubicacion': {
        0: 'id',
        1: 'unidad_minera_id', 
        5: 'texto_original',
    },
    'insumo': {
        0: 'id',
        1: 'nombre_normalizado',
        2: 'unidad_medida_id',
    },
    'cat_causa_raiz': {
        0: 'id',
        2: 'nombre',
    },
    'almacen': {
        0: 'id',
        1: 'unidad_minera_id',
        2: 'nombre',
    },
    'stock': {
        0: 'almacen_id',
        1: 'insumo_id',
        2: 'cantidad',
    },
    'tarea': {
        0: 'id',
        1: 'unidad_minera_id',
        3: 'tipo_id',
        4: 'area_id',
        5: 'origen_id',
        6: 'ubicacion_id',
        10: 'fecha_inicio',
    },
    'tarea_insumo': {
        0: 'tarea_id',
        1: 'insumo_id',
        2: 'cantidad',
        3: 'unidad_medida_id',
    },
}

def parse_values(values_str):
    """Parsea los valores de un INSERT INTO ... VALUES (...) respetando comillas."""
    values = []
    current = []
    in_quote = False
    depth = 0
    
    for char in values_str:
        if char == "'" and not in_quote:
            in_quote = True
            current.append(char)
        elif char == "'" and in_quote:
            current.append(char)
            # Check for escaped quote ''
            # We'll handle this by looking at what we have
            in_quote = False
        elif char == ',' and not in_quote and depth == 0:
            values.append(''.join(current).strip())
            current = []
        elif char == '(' and not in_quote:
            depth += 1
            current.append(char)
        elif char == ')' and not in_quote:
            if depth > 0:
                depth -= 1
                current.append(char)
        else:
            current.append(char)
    
    if current:
        values.append(''.join(current).strip())
    
    return values

def check_file(filepath):
    """Verifica un archivo SQL buscando problemas."""
    issues = []
    fixes_applied = 0
    
    filename = os.path.basename(filepath)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    modified = False
    new_lines = []
    
    for line_num, line in enumerate(lines, 1):
        original_line = line
        
        # Solo procesar INSERT statements
        if not line.strip().startswith('INSERT INTO'):
            new_lines.append(line)
            continue
        
        # Detectar la tabla
        table_match = re.match(r"INSERT INTO\s+(\w+)\s*\(", line.strip())
        if not table_match:
            new_lines.append(line)
            continue
        
        table_name = table_match.group(1)
        
        # Extraer la parte VALUES(...)
        values_match = re.search(r'VALUES\s*\((.+?)\)\s*(?:ON\s+CONFLICT|;)', line, re.IGNORECASE)
        if not values_match:
            new_lines.append(line)
            continue
        
        values_str = values_match.group(1)
        values = parse_values(values_str)
        
        # Verificar NOT NULL constraints
        if table_name in NOT_NULL_COLUMNS:
            for col_idx, col_name in NOT_NULL_COLUMNS[table_name].items():
                if col_idx < len(values):
                    val = values[col_idx].strip()
                    if val == 'NULL':
                        issues.append({
                            'file': filename,
                            'line': line_num,
                            'table': table_name,
                            'column': col_name,
                            'col_idx': col_idx,
                            'issue': f'NULL en columna NOT NULL "{col_name}"',
                        })
        
        # Verificar cantidades <= 0 en tarea_insumo
        if table_name == 'tarea_insumo':
            if len(values) > 2:
                qty_val = values[2].strip()
                try:
                    qty = float(qty_val)
                    if qty <= 0:
                        issues.append({
                            'file': filename,
                            'line': line_num,
                            'table': table_name,
                            'column': 'cantidad',
                            'col_idx': 2,
                            'issue': f'cantidad <= 0: {qty}',
                        })
                except ValueError:
                    if qty_val != 'NULL':
                        issues.append({
                            'file': filename,
                            'line': line_num,
                            'table': table_name,
                            'column': 'cantidad',
                            'col_idx': 2,
                            'issue': f'cantidad no es numero: {qty_val}',
                        })
        
        # Verificar fechas en tarea (fecha_inicio no debe ser NULL ni 'nan')
        if table_name == 'tarea':
            if len(values) > 10:
                fecha = values[10].strip()
                if fecha == 'NULL' or 'nan' in fecha.lower() or 'nat' in fecha.lower():
                    issues.append({
                        'file': filename,
                        'line': line_num,
                        'table': table_name,
                        'column': 'fecha_inicio',
                        'col_idx': 10,
                        'issue': f'fecha_inicio invalida: {fecha}',
                    })
        
        # Verificar comillas mal cerradas (numero impar de comillas simples no escapadas)
        quote_count = 0
        escaped = False
        for i, c in enumerate(line):
            if c == "'" and not escaped:
                quote_count += 1
            escaped = False
        
        if quote_count % 2 != 0:
            issues.append({
                'file': filename,
                'line': line_num,
                'table': table_name,
                'column': '?',
                'col_idx': -1,
                'issue': 'Posible comilla simple sin cerrar',
            })
        
        new_lines.append(line)
    
    return issues, lines, new_lines


def fix_issues(issues, parts_dir):
    """Aplica correcciones automaticas a los archivos."""
    # Agrupar issues por archivo
    by_file = {}
    for issue in issues:
        fname = issue['file']
        if fname not in by_file:
            by_file[fname] = []
        by_file[fname].append(issue)
    
    total_fixed = 0
    
    for fname, file_issues in by_file.items():
        filepath = os.path.join(parts_dir, fname)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        modified = False
        
        for issue in file_issues:
            line_idx = issue['line'] - 1  # 0-based
            if line_idx >= len(lines):
                continue
            
            line = lines[line_idx]
            table = issue['table']
            col_name = issue['column']
            
            # Fix NULL texto_original -> 'Sin ubicacion'
            if table == 'ubicacion' and col_name == 'texto_original':
                # texto_original is last value before ) ON CONFLICT
                fixed = re.sub(
                    r",\s*NULL\)\s*ON\s*CONFLICT",
                    ", 'Sin ubicacion') ON CONFLICT",
                    line
                )
                if fixed != line:
                    lines[line_idx] = fixed
                    modified = True
                    total_fixed += 1
                    print(f"  [FIX] {fname}:{issue['line']} -> texto_original = 'Sin ubicacion'")
            
            # Fix NULL fecha_inicio -> fecha_fin or periodo or default
            elif table == 'tarea' and col_name == 'fecha_inicio':
                # Try to use fecha_fin as fallback, or a default date
                fixed = line.replace("'nan'", "'2024-01-01 00:00:00'")
                fixed = fixed.replace("'NaT'", "'2024-01-01 00:00:00'")
                # If fecha_inicio is NULL in the VALUES
                values_match = re.search(r'VALUES\s*\((.+?)\)\s*;', fixed)
                if 'NULL' in str(fixed):
                    # More targeted: only fix the fecha_inicio position
                    pass
                if fixed != line:
                    lines[line_idx] = fixed
                    modified = True
                    total_fixed += 1
                    print(f"  [FIX] {fname}:{issue['line']} -> fecha_inicio = default")
            
            # Fix NULL nombre in cat_causa_raiz
            elif table == 'cat_causa_raiz' and col_name == 'nombre':
                fixed = re.sub(
                    r",\s*NULL\)\s*ON\s*CONFLICT",
                    ", 'Sin causa') ON CONFLICT",
                    line
                )
                if fixed != line:
                    lines[line_idx] = fixed
                    modified = True
                    total_fixed += 1
                    print(f"  [FIX] {fname}:{issue['line']} -> nombre = 'Sin causa'")
            
            # Fix NULL nombre_normalizado in insumo
            elif table == 'insumo' and col_name == 'nombre_normalizado':
                # Skip this row entirely (comment it out)
                lines[line_idx] = '-- SKIPPED (NULL nombre): ' + line
                modified = True
                total_fixed += 1
                print(f"  [FIX] {fname}:{issue['line']} -> Linea comentada (insumo sin nombre)")
        
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(lines)
    
    return total_fixed


def main():
    parts_dir = os.path.abspath(PARTS_DIR)
    print(f"Validando archivos en: {parts_dir}\n")
    
    all_issues = []
    
    # Verificar cada archivo
    sql_files = sorted([f for f in os.listdir(parts_dir) if f.endswith('.sql')])
    
    for fname in sql_files:
        filepath = os.path.join(parts_dir, fname)
        issues, _, _ = check_file(filepath)
        
        if issues:
            print(f"[!!] {fname}: {len(issues)} problema(s) encontrado(s)")
            for iss in issues:
                print(f"     Linea {iss['line']}: {iss['issue']}")
        else:
            print(f"[OK] {fname}")
        
        all_issues.extend(issues)
    
    print(f"\n{'='*50}")
    print(f"Total problemas encontrados: {len(all_issues)}")
    
    if all_issues:
        print(f"\nAplicando correcciones automaticas...\n")
        fixed = fix_issues(all_issues, parts_dir)
        print(f"\n[DONE] {fixed} problemas corregidos automaticamente")
        
        if fixed < len(all_issues):
            remaining = len(all_issues) - fixed
            print(f"[WARN] {remaining} problemas requieren revision manual")
    else:
        print("\n[OK] Todos los archivos estan limpios!")


if __name__ == '__main__':
    main()
