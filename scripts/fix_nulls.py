import re

filepath = r'd:\OneDrive_UNI\OneDrive - UNIVERSIDAD NACIONAL DE INGENIERIA\Documents\ESCRITORIO\Cris\2026\2026-1\9 Emprendimiento\_erp\supabase\parts\part_02_ubicaciones.sql'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# Fix: texto_original is the LAST column value before ') ON CONFLICT'
# Replace NULL texto_original with 'Sin ubicacion'
fixed = re.sub(
    r",\s*NULL\)\s*ON\s*CONFLICT",
    ", 'Sin ubicacion') ON CONFLICT",
    content
)

count_before = len(re.findall(r",\s*NULL\)\s*ON\s*CONFLICT", original))
print(f"Encontradas {count_before} filas con NULL texto_original")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(fixed)

print("Archivo corregido!")
