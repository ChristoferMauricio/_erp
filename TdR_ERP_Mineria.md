# Términos de Referencia (TdR)
## Plataforma ERP de Gestión de Suministros Físicos, Capital Humano y Mantenimiento Predictivo para Operaciones de Comunicaciones en Minería Subterránea

**Versión:** 1.0
**Fecha:** Junio 2026
**Tipo de documento:** Términos de Referencia / Especificación de Requerimientos de Software (SRS)
**Stack objetivo:** Next.js (Vercel) + Supabase (PostgreSQL) + Render / GitHub Actions

---

## 1. Antecedentes y contexto

La empresa presta servicios de instalación, mantenimiento correctivo y mantenimiento preventivo de sistemas de comunicación y monitoreo (telefonía analógica, CCTV, comunicación radial *leaky feeder*, geófonos, switches, NVR/DVR, telemandos) en **8 unidades mineras**, siendo Yauricocha (UM Corona) una de ellas.

Actualmente la información operativa se registra en hojas de cálculo Excel por unidad minera. El análisis de un set representativo (UM Corona – Yauricocha) revela las siguientes características de la data, que condicionan el diseño del sistema:

- **Volumen:** ~3,414 filas en ~10 meses (jun-2025 a abr-2026) para **una sola** unidad minera. Extrapolado a 8 unidades, el sistema debe soportar decenas de miles de registros anuales.
- **Modelo "padre-hijo" implícito:** Cada tarea ocupa una fila "cabecera" (con personal, tiempo, ubicación, causa raíz, detalle) seguida de varias filas "hijas" que **solo** contienen un insumo y su cantidad, dejando vacíos los demás campos. Este patrón debe normalizarse en el modelo de datos (una tarea → N consumos de insumo).
- **Fechas en formato serial Excel** (p. ej. `45834` = 26-jun-2025) que deben convertirse a tipo `date` real.
- **Baja calidad de datos categóricos:** existen duplicados por mayúsculas/minúsculas y tildes (`Incidente` vs `incidente`; `Infraestructura` vs `infraestructura`; `Cinta Aislante` vs `Cinta aislante`; `IM`/`SUP` vs `im`/`sup`; `RJ 45` vs `RJ45`). Requiere catálogos maestros y normalización.
- **Campo `Ubicación` de texto libre** con ~986 valores distintos (p. ej. `NV.1170 Esperanza Sur`, `NV.720 Fortuna`). Necesita parseo y un catálogo jerárquico de ubicaciones (Unidad → Nivel → Zona/Labor → Punto).
- **Indicadores operativos ya presentes:** promedio de **2.7 personas/tarea** y **2.2 horas/tarea**, base directa para módulos de productividad y dimensionamiento.

---

## 2. Objetivos

### 2.1 Objetivo general
Implementar una plataforma web tipo ERP, multi-empresa/multi-unidad-minera, que centralice el registro y la gestión de las tareas de campo, el consumo de suministros físicos y la asignación de personal, y que habilite analítica histórica y **predicción de demanda de insumos y carga de trabajo** basada en patrones.

### 2.2 Objetivos específicos
1. Digitalizar el registro de tareas (incidentes, requerimientos, mantenimientos) reemplazando los Excel actuales.
2. Controlar inventario y consumo de insumos por tarea, ubicación, periodo y unidad minera (control de mermas).
3. Gestionar el capital humano: cuadrillas, asignación, horas-hombre y productividad.
4. Medir cumplimiento de ANS/SLA mediante el tiempo entre `Fecha inic.` y `Fecha Fin`.
5. Identificar "zonas calientes" cruzando fallas recurrentes con la ubicación y la causa raíz.
6. Proveer un motor de **predicción de demanda** de insumos y un módulo de **mantenimiento predictivo** (de reactivo a preventivo).
7. Garantizar trazabilidad y soporte a estándares de seguridad minera (disponibilidad de cámaras de refugio, anexos, leaky feeder).

### 2.3 Fuera de alcance (v1)
Facturación electrónica/SUNAT, contabilidad general, integración con planillas de RR.HH. externas y app móvil nativa (se contempla PWA responsive). Estos quedan como fases posteriores.

---

## 3. Glosario de dominio

| Término | Significado |
|---|---|
| **U.M. / Unidad Minera** | Centro de operación minero (p. ej. UM Corona). |
| **IM / SUP** | Trabajo en interior mina (IM) o en superficie (SUP). |
| **Tipo** | `Incidente` (falla no planificada) o `Requerimiento` (trabajo solicitado/programado). |
| **Causa Raíz** | Motivo del trabajo, con subsistema entre paréntesis: DAT (datos/red), CCTV, RAD (radial), TEL (telefonía), GEO (geófonos). |
| **NV.** | Nivel de la mina (profundidad), p. ej. NV.1170. |
| **Leaky feeder** | Cable radiante para comunicación radial subterránea. |
| **SPL / Balun / NVR / DVR / Telemando** | Componentes de la red de comunicación y video. |
| **ANS / SLA** | Acuerdo de Nivel de Servicio (tiempo de respuesta/resolución pactado). |

---

## 4. Roles de usuario y permisos (RBAC)

| Rol | Capacidades principales |
|---|---|
| **Super Admin** | Gestiona empresas, unidades mineras, catálogos globales, usuarios. |
| **Administrador de Unidad** | Configura su(s) unidad(es), aprueba inventario, ve todos los reportes. |
| **Supervisor / Jefe de cuadrilla** | Crea y cierra tareas, asigna personal, registra consumos y tiempos. |
| **Técnico de campo** | Registra avances/consumos de las tareas asignadas (vía PWA). |
| **Logística / Almacén** | Gestiona stock, recepciones, salidas, alertas de reposición. |
| **Analista / Gerencia** | Solo lectura: dashboards, KPIs, predicciones, exportaciones. |

El control de acceso debe implementarse con **Row Level Security (RLS) de Supabase**, garantizando aislamiento total de datos entre empresas y entre unidades mineras (multi-tenant).

---

## 5. Requerimientos funcionales

### 5.1 Módulo de Tareas / Órdenes de trabajo (núcleo)
- RF-01: Crear, editar, cerrar y anular tareas con: unidad minera, fecha inicio, fecha fin, tipo, IM/SUP, área, ubicación, causa raíz, detalle, trabajo realizado, ticket, periodo.
- RF-02: Cada tarea admite **N líneas de insumo** (insumo, cantidad, unidad), resolviendo el modelo padre-hijo del Excel original.
- RF-03: Cada tarea admite **asignación de personal** (cuadrilla, n.° de personas, horas/tiempo).
- RF-04: Adjuntar evidencias (foto del refugio/empalme) vía Supabase Storage.
- RF-05: Importador de Excel/CSV que ingiera el formato histórico actual: detección de filas cabecera vs filas-insumo, conversión de fechas serial, *fuzzy matching* contra catálogos y reporte de filas rechazadas.

### 5.2 Módulo de Inventario y Suministros (Supply Chain)
- RF-06: Catálogo maestro de insumos (normalizando `Cinta aislante`/`Cinta Aislante`, `RJ 45`/`RJ45`, etc.) con unidad base (UN, M, LT).
- RF-07: Kardex de stock por almacén/unidad: entradas, salidas (descuento automático al cerrar tareas), ajustes.
- RF-08: Punto de reorden y alertas de desabastecimiento/sobrestock.
- RF-09: **Control de mermas:** comparar consumo reportado vs. volumen de trabajos y señalar desviaciones (p. ej. cintillos/cinta por tarea fuera de rango).

### 5.3 Módulo de Capital Humano / Productividad
- RF-10: Maestro de personal y cuadrillas por unidad.
- RF-11: Cálculo de horas-hombre = personas × tiempo por tarea, agregable por periodo/ubicación/causa.
- RF-12: Indicadores de dimensionamiento (personas y horas promedio por tipo de tarea) con alertas de sobreasignación.

### 5.4 Módulo de Mantenimiento y ANS
- RF-13: Cálculo de tiempo de resolución (Fecha Fin − Fecha inic.) y cumplimiento de SLA configurable por tipo (Incidente vs Requerimiento).
- RF-14: Catálogo jerárquico de ubicaciones (Unidad → Nivel → Zona → Punto) con parseo del texto libre histórico.
- RF-15: **Zonas calientes:** ranking de ubicaciones por frecuencia de fallas y por subsistema (CCTV, RAD, TEL, DAT, GEO).
- RF-16: **Análisis de causa raíz:** distribución y tendencia de causas (Equipo Averiado, Balun Averiado, Cable Roto por Trabajos, etc.).

### 5.5 Módulo de Analítica y Predicción
- RF-17: Dashboards por unidad y consolidado de las 8 unidades: KPIs de tareas, insumos, HH, SLA, disponibilidad de equipos críticos de seguridad.
- RF-18: **Predicción de demanda de insumos** por mes/unidad (series temporales sobre el consumo histórico).
- RF-19: **Mantenimiento predictivo:** probabilidad/tendencia de falla por ubicación y equipo, para priorizar preventivos.
- RF-20: Exportación a Excel/PDF y API de consulta.

---

## 6. Requerimientos no funcionales
- **RNF-01 Multi-tenant:** aislamiento estricto por empresa y unidad vía RLS.
- **RNF-02 Rendimiento:** consultas de dashboard < 2 s sobre cientos de miles de filas (índices + vistas materializadas).
- **RNF-03 Disponibilidad:** ≥ 99.5%; objetivo de uso incluso con conectividad intermitente en mina (PWA con cola offline y sincronización posterior).
- **RNF-04 Seguridad:** autenticación Supabase Auth, cifrado en tránsito y reposo, bitácora de auditoría de cambios.
- **RNF-05 Trazabilidad:** historial inmutable de creación/edición/cierre de tareas y movimientos de stock.
- **RNF-06 Internacionalización:** UI en español; manejo correcto de tildes y unidades métricas.
- **RNF-07 Calidad de datos:** validaciones en ingesta; ningún registro con categoría no normalizada.

---

## 7. Modelo de datos (propuesto, PostgreSQL / Supabase)

> Esquema relacional que normaliza el patrón padre-hijo del Excel. Nombres en `snake_case`.

```sql
-- Multi-tenant
empresa(id, nombre, ruc, ...)
unidad_minera(id, empresa_id FK, nombre, codigo)            -- p.ej. UM Corona / Yauricocha

-- Catálogos maestros (normalizan inconsistencias del Excel)
cat_tipo(id, nombre)                                        -- Incidente | Requerimiento
cat_area(id, nombre)                                        -- Infraestructura, ...
cat_origen(id, nombre)                                      -- IM | SUP
cat_subsistema(id, codigo)                                  -- DAT, CCTV, RAD, TEL, GEO
cat_causa_raiz(id, subsistema_id FK, nombre)                -- "Balun Averiado", ...
cat_unidad_medida(id, simbolo)                              -- UN, M, LT

-- Ubicaciones jerárquicas (parseo de texto libre)
ubicacion(id, unidad_minera_id FK, nivel, zona, punto, texto_original)

-- Insumos e inventario
insumo(id, nombre_normalizado, unidad_medida_id FK, categoria)
almacen(id, unidad_minera_id FK, nombre)
stock(id, almacen_id FK, insumo_id FK, cantidad, punto_reorden)
movimiento_stock(id, insumo_id FK, almacen_id FK, tipo, cantidad, tarea_id FK?, fecha, usuario_id FK)

-- Personal
personal(id, unidad_minera_id FK, nombre, rol)
cuadrilla(id, unidad_minera_id FK, nombre)
cuadrilla_miembro(cuadrilla_id FK, personal_id FK)

-- Núcleo: tarea (cabecera) + líneas hijas
tarea(
  id, unidad_minera_id FK, ticket, tipo_id FK, area_id FK, origen_id FK,
  ubicacion_id FK, causa_raiz_id FK, cant_personas, tiempo_horas,
  fecha_inicio DATE, fecha_fin DATE, periodo DATE,
  detalle TEXT, trabajo_realizado TEXT, estado, created_by, created_at
)
tarea_insumo(id, tarea_id FK, insumo_id FK, cantidad, unidad_medida_id FK)  -- filas "hijas"
tarea_personal(id, tarea_id FK, cuadrilla_id FK?, personal_id FK?)
evidencia(id, tarea_id FK, storage_path, descripcion)

-- Auditoría / SLA
sla_config(id, unidad_minera_id FK, tipo_id FK, horas_objetivo)
auditoria(id, entidad, entidad_id, accion, payload JSONB, usuario_id, fecha)
```

**Vistas/materializadas sugeridas:** `vw_consumo_mensual` (predicción de demanda), `vw_zonas_calientes`, `vw_productividad`, `vw_cumplimiento_sla`.

---

## 8. Estrategia de migración de la data histórica

1. **Ingesta cruda** de cada Excel a una tabla `staging` 1:1.
2. **Detección de cabeceras:** una fila es cabecera si tiene `Cant. Person`/`Tiempo`/`Ubicación`; las filas siguientes sin esos campos son sus líneas de insumo (asociadas por proximidad hasta la próxima cabecera).
3. **Transformaciones:** fecha serial → `date`; normalización de texto (trim, capitalización, tildes); *fuzzy matching* contra catálogos; parseo de `Ubicación` a (nivel, zona, punto).
4. **Carga** a tablas finales dentro de transacción; **reporte** de filas rechazadas para revisión manual.
5. Repetir por cada una de las 8 unidades mineras.

---

## 9. Arquitectura técnica

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend: Next.js (App Router) en Vercel — PWA responsive     │
│  UI: React + Tailwind + shadcn/ui · Recharts/Tremor (dashboards)│
└───────────────┬──────────────────────────────────────────────┘
                │  (Supabase JS / Server Actions, JWT)
┌───────────────▼──────────────────────────────────────────────┐
│  Supabase: PostgreSQL · Auth · Storage · RLS · Edge Functions  │
│  - Lógica transaccional (cierre de tarea → descuento de stock) │
│  - Vistas materializadas para analítica                        │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  Servicio de Predicción (Python/FastAPI en Render)             │
│  - Series temporales (Prophet/statsmodels) demanda de insumos  │
│  - Modelos de riesgo de falla por ubicación/equipo             │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  GitHub Actions: CI/CD, migraciones de BD, jobs programados    │
│  - Cron: reentrenamiento de modelos y refresh de materializadas│
└──────────────────────────────────────────────────────────────┘
```

**Justificación del stack:**
- **Vercel + Next.js:** despliegue rápido, SSR/ISR, PWA para campo.
- **Supabase:** Postgres gestionado con Auth + RLS (multi-tenant nativo) + Storage para evidencias, sin operar infraestructura.
- **Render:** aloja el microservicio de ML en Python (cómputo más pesado y dependencias científicas que no caben bien en Edge Functions).
- **GitHub Actions:** CI/CD, migraciones versionadas (Supabase CLI) y *cron jobs* (reentrenamiento, refresco de vistas, alertas de reorden).

---

## 10. Componente de predicción (detalle)

| Caso | Entrada | Técnica sugerida | Salida |
|---|---|---|---|
| Demanda de insumos | `vw_consumo_mensual` por insumo/unidad | Series temporales (Prophet / SARIMA) | Consumo proyectado próximos 1–3 meses + intervalo |
| Carga de trabajo | Tareas por periodo/tipo | Series temporales / regresión | N° tareas y HH esperadas |
| Riesgo de falla | Histórico de fallas por ubicación + causa | Clasificación / tasa de recurrencia | Ranking de puntos a intervenir preventivamente |

**Consideración de datos:** el horizonte histórico inicial (~10 meses por unidad) es limitado para modelos complejos; iniciar con *baselines* (medias móviles, estacionalidad simple) y escalar a modelos avanzados conforme crezca el histórico. El sistema debe registrar métricas de error (MAE/MAPE) y permitir reentrenamiento programado.

---

## 11. KPIs e indicadores del tablero

- Tareas por periodo, tipo, unidad y subsistema (DAT/CCTV/RAD/TEL/GEO).
- Consumo de insumos top-N y desviación vs. predicción (mermas).
- Horas-hombre y promedio personas/tarea y horas/tarea (línea base: 2.7 y 2.2).
- % cumplimiento de SLA por tipo de tarea.
- Top "zonas calientes" por frecuencia de falla.
- Disponibilidad de equipos críticos de seguridad (cámaras de refugio, anexos, leaky feeder).

---

## 12. Plan de implementación por fases

| Fase | Entregable | Duración estimada |
|---|---|---|
| **0. Descubrimiento** | Validación de catálogos y reglas con usuarios; backlog priorizado | 2 sem |
| **1. Fundaciones** | Modelo de datos + Auth + RLS multi-tenant + CI/CD | 3 sem |
| **2. Núcleo operativo** | Módulo de Tareas + Inventario + Personal + importador histórico | 5 sem |
| **3. Analítica** | Dashboards, SLA, zonas calientes, vistas materializadas | 3 sem |
| **4. Predicción** | Microservicio ML, demanda de insumos, riesgo de falla | 4 sem |
| **5. Despliegue 8 UM + PWA offline** | Migración masiva, capacitación, hardening | 4 sem |

> Las duraciones son referenciales y deben ajustarse al equipo asignado.

---

## 13. Criterios de aceptación
1. Importación correcta de al menos una unidad histórica completa con < 2% de filas rechazadas justificadas.
2. Cierre de tarea descuenta stock automáticamente y queda auditado.
3. Aislamiento multi-tenant verificado (un usuario no accede a datos de otra unidad/empresa).
4. Dashboards reflejan KPIs de la sección 11 con datos reales.
5. Predicción de demanda operativa con métrica de error reportada por insumo.
6. PWA registra tareas sin conexión y sincroniza al recuperar señal.

---

## 14. Riesgos y supuestos
- **Calidad del dato fuente:** la normalización depende de catálogos bien definidos; mitigar con validación en ingesta y revisión humana de rechazos.
- **Histórico corto para ML:** mitigar con baselines y reentrenamiento incremental.
- **Conectividad en mina:** mitigar con PWA offline-first.
- **Heterogeneidad entre las 8 unidades:** los formatos de Excel pueden diferir; el importador debe ser configurable por unidad.

---

*Fin del documento.*
