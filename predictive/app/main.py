import os
import re
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from statsmodels.tsa.holtwinters import ExponentialSmoothing

app = FastAPI(
    title="Servicio de Predicción ERP Minero",
    description="API para estimación de demanda de suministros y riesgo de fallas",
    version="1.0"
)

# Habilitar CORS para consultas desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conexión a Base de Datos
DATABASE_URL = os.getenv("DATABASE_URL")
LOCAL_EXCEL_PATH = r"d:\OneDrive_UNI\OneDrive - UNIVERSIDAD NACIONAL DE INGENIERIA\Documents\ESCRITORIO\Cris\2026\2026-1\9 Emprendimiento\_erp\Yauricocha - CORONA.xlsx"

def get_connection():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return None

def load_data_from_excel():
    """Fallback para desarrollo local si no hay Supabase aún."""
    if os.path.exists(LOCAL_EXCEL_PATH):
        df = pd.read_excel(LOCAL_EXCEL_PATH, sheet_name='YAURICOCHA')
        return df
    return None

@app.get("/health")
def health_check():
    db_connected = False
    if DATABASE_URL:
        try:
            conn = get_connection()
            if conn:
                conn.close()
                db_connected = True
        except Exception:
            pass
    return {
        "status": "healthy",
        "database_connected": db_connected,
        "mode": "Supabase Cloud" if DATABASE_URL else "Local Excel Fallback"
    }

@app.get("/predict/insumos")
def predict_insumos(insumo_nombre: Optional[str] = None, meses_proyeccion: int = 3):
    """
    Realiza una predicción de demanda para los próximos meses de un insumo específico
    utilizando Suavizado Exponencial de Holt-Winters o regresión lineal simple.
    """
    df = None
    # 1. Intentar cargar datos de Supabase si hay conexión
    if DATABASE_URL:
        try:
            conn = get_connection()
            cursor = conn.cursor()
            query = """
                SELECT t.periodo, ti.cantidad, i.nombre_normalizado as insumo
                FROM tarea_insumo ti
                JOIN tarea t ON ti.tarea_id = t.id
                JOIN insumo i ON ti.insumo_id = i.id
                WHERE t.periodo IS NOT NULL
            """
            if insumo_nombre:
                query += f" AND i.nombre_normalizado = {psycopg2.extensions.adapt(insumo_nombre)}"
            
            cursor.execute(query)
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            if rows:
                df = pd.DataFrame(rows)
                # Normalizar nombres de columnas para que coincidan con la lógica siguiente
                df.rename(columns={'periodo': 'Periodo', 'cantidad': 'CANTIDAD', 'insumo': 'INSUMO'}, inplace=True)
        except Exception as e:
            print(f"Error cargando de Supabase, usando Excel: {e}")
            
    # 2. Si no hay Supabase o falló, usar Excel local
    if df is None or len(df) == 0:
        df_excel = load_data_from_excel()
        if df_excel is not None:
            df = df_excel[['Periodo', 'INSUMO', 'CANTIDAD']].copy()
            df.dropna(subset=['Periodo', 'INSUMO', 'CANTIDAD'], inplace=True)
            if insumo_nombre:
                df = df[df['INSUMO'].str.lower() == insumo_nombre.lower()]
        else:
            raise HTTPException(status_code=500, detail="No se encontraron fuentes de datos disponibles.")

    if len(df) == 0:
        return {"insumo": insumo_nombre, "prediction": [], "message": "Sin histórico suficiente."}

    # Limpiar cantidades
    df['CANTIDAD'] = df['CANTIDAD'].astype(str).str.replace(" ", "").str.replace("O", "0").str.replace("o", "0")
    df['CANTIDAD'] = pd.to_numeric(df['CANTIDAD'], errors='coerce').fillna(1.0)
    
    # Asegurar tipo fecha
    df['Periodo'] = pd.to_datetime(df['Periodo'])
    
    # Agrupar por mes
    df_grouped = df.groupby([df['Periodo'].dt.to_period('M'), 'INSUMO'])['CANTIDAD'].sum().reset_index()
    df_grouped['Periodo'] = df_grouped['Periodo'].dt.to_timestamp()
    
    predictions = []
    
    # Si se pide uno específico o todos los insumos principales
    insumos_to_predict = [insumo_nombre] if insumo_nombre else df_grouped['INSUMO'].unique()[:5] # Top 5 por defecto si no se indica uno
    
    for ins in insumos_to_predict:
        df_ins = df_grouped[df_grouped['INSUMO'] == ins].sort_values('Periodo')
        if len(df_ins) < 3:
            # Muy pocos datos, usar promedio móvil
            avg_consumption = df_ins['CANTIDAD'].mean() if len(df_ins) > 0 else 0
            pred_values = [float(avg_consumption)] * meses_proyeccion
        else:
            try:
                # Modelo de Holt-Winters para series temporales
                series = df_ins.set_index('Periodo')['CANTIDAD']
                # Frecuencia mensual
                series = series.asfreq('MS', fill_value=0.0)
                
                # Ajustar modelo simple
                model = ExponentialSmoothing(series, trend='add', seasonal=None, initialization_method="estimated")
                fit = model.fit()
                forecast = fit.forecast(meses_proyeccion)
                pred_values = [max(0.0, float(val)) for val in forecast.values]
            except Exception as e:
                # Fallback a promedio móvil
                avg_consumption = df_ins['CANTIDAD'].mean()
                pred_values = [float(avg_consumption)] * meses_proyeccion

        # Generar fechas futuras
        last_date = df_ins['Periodo'].max() if len(df_ins) > 0 else pd.Timestamp.now()
        future_dates = [
            (last_date + pd.DateOffset(months=i+1)).strftime('%Y-%m-%d')
            for i in range(meses_proyeccion)
        ]
        
        predictions.append({
            "insumo": ins,
            "historico": [
                {"fecha": row['Periodo'].strftime('%Y-%m-%d'), "cantidad": float(row['CANTIDAD'])}
                for _, row in df_ins.iterrows()
            ],
            "proyeccion": [
                {"fecha": future_dates[i], "cantidad": round(pred_values[i], 2)}
                for i in range(meses_proyeccion)
            ]
        })

    return {
        "meses_proyeccion": meses_proyeccion,
        "predictions": predictions
    }

@app.get("/predict/mantenimiento")
def predict_mantenimiento(nivel: Optional[str] = None):
    """
    Estima la probabilidad de falla y prioridad de mantenimiento predictivo
    por nivel y zona minera cruzando causas raíz y frecuencias de fallas recurrentes.
    """
    df = None
    if DATABASE_URL:
        try:
            conn = get_connection()
            cursor = conn.cursor()
            query = """
                SELECT t.fecha_inicio, t.tipo_id, u.nivel, u.zona, u.punto, c.nombre as causa_raiz
                FROM tarea t
                JOIN ubicacion u ON t.ubicacion_id = u.id
                JOIN cat_causa_raiz c ON t.causa_raiz_id = c.id
                JOIN cat_tipo ct ON t.tipo_id = ct.id
                WHERE ct.nombre = 'Incidente'
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            cursor.close()
            conn.close()
            if rows:
                df = pd.DataFrame(rows)
                # Normalizar columnas
                df.rename(columns={'fecha_inicio': 'Fecha inic.', 'nivel': 'nivel', 'zona': 'zona', 'causa_raiz': 'Causa Raiz'}, inplace=True)
        except Exception as e:
            print(f"Error cargando de Supabase para fallas: {e}")

    if df is None or len(df) == 0:
        df_excel = load_data_from_excel()
        if df_excel is not None:
            # Encontrar columna ubicación
            ubic_col = [c for c in df_excel.columns if 'Ubic' in c][0]
            # Filtrar solo incidentes
            df_excel = df_excel[df_excel['Tipo'].str.lower().str.strip() == 'incidente']
            
            # Recrear estructura de ubicaciones
            from app.main import parse_ubicacion_local
            parsed_locs = df_excel[ubic_col].apply(parse_ubicacion_local)
            df = pd.DataFrame({
                'Fecha inic.': df_excel['Fecha inic.'],
                'nivel': [p[0] for p in parsed_locs],
                'zona': [p[1] for p in parsed_locs],
                'Causa Raiz': df_excel['Causa Raiz']
            })
        else:
            raise HTTPException(status_code=500, detail="No se encontraron fuentes de datos disponibles.")

    if len(df) == 0:
        return {"results": [], "message": "Sin incidentes registrados."}

    # Agrupar fallas por ubicación y zona
    df_locs = df.groupby(['nivel', 'zona']).size().reset_index(name='total_fallas')
    
    # Calcular la recurrencia reciente (últimos 3 meses del histórico, jul-sep 2025 aprox)
    df['Fecha inic.'] = pd.to_datetime(df['Fecha inic.'])
    max_date = df['Fecha inic.'].max()
    three_months_ago = max_date - pd.DateOffset(months=3)
    
    df_recent = df[df['Fecha inic.'] >= three_months_ago]
    df_recent_locs = df_recent.groupby(['nivel', 'zona']).size().reset_index(name='fallas_recientes')
    
    # Unir métricas
    res_df = pd.merge(df_locs, df_recent_locs, on=['nivel', 'zona'], how='left').fillna(0)
    
    # Calcular Score de Riesgo (combinando total histórico y velocidad reciente de fallas)
    # Score = (Total historico normalizado * 40) + (Fallas recientes normalizadas * 60)
    if not res_df.empty:
        max_total = res_df['total_fallas'].max() or 1
        max_recent = res_df['fallas_recientes'].max() or 1
        
        res_df['risk_score'] = (
            (res_df['total_fallas'] / max_total * 40) + 
            (res_df['fallas_recientes'] / max_recent * 60)
        )
        # Escalar a entero entre 0 y 100
        res_df['risk_score'] = res_df['risk_score'].round().astype(int)
    else:
        res_df['risk_score'] = 0
        
    # Clasificar el nivel de riesgo
    def classify_risk(score):
        if score >= 75: return "Crítico"
        if score >= 45: return "Alto"
        if score >= 15: return "Medio"
        return "Bajo"
        
    res_df['nivel_riesgo'] = res_df['risk_score'].apply(classify_risk)
    
    # Ordenar por riesgo
    res_df = res_df.sort_values('risk_score', ascending=False)
    
    if nivel:
        res_df = res_df[res_df['nivel'].str.lower() == nivel.lower()]
        
    results = []
    for _, row in res_df.head(15).iterrows():
        results.append({
            "nivel": row['nivel'],
            "zona": row['zona'],
            "total_fallas": int(row['total_fallas']),
            "fallas_recientes": int(row['fallas_recientes']),
            "risk_score": int(row['risk_score']),
            "nivel_riesgo": row['nivel_riesgo']
        })
        
    return {
        "results": results
    }

def parse_ubicacion_local(text):
    """Auxiliar para parsear ubicaciones sin cargar scripts externos en el microservicio."""
    if not isinstance(text, str):
        return "Interior Mina", "General", None
    
    text_clean = text.strip().strip('.')
    is_superficie = "Superficie" in text_clean or "SUPERFICIE" in text_clean
    
    nivel = "Interior Mina"
    level_match = re.search(r'(NV\.\s*\d+)', text_clean, re.IGNORECASE)
    if level_match:
        nivel = level_match.group(1).replace(" ", "").upper()
    elif is_superficie:
        nivel = "Superficie"
        
    parts_text = text_clean
    if level_match:
        parts_text = parts_text.replace(level_match.group(0), "")
    if is_superficie:
        parts_text = re.sub(r',?\s*Superficie', '', parts_text, flags=re.IGNORECASE)
        
    parts_text = parts_text.strip(', ')
    
    if ',' in parts_text:
        parts = [p.strip() for p in parts_text.split(',') if p.strip()]
    else:
        parts = [p.strip() for p in re.split(r'\s{2,}', parts_text) if p.strip()]
        
    zona = parts[0] if len(parts) > 0 else (parts_text if parts_text else "General")
    return nivel, zona, None
