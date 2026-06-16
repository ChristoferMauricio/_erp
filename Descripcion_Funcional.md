# Descripción Funcional — Sistema de Gestión de Mantenimiento de Comunicaciones
### Unidad Minera Corona — Yauricocha (Sociedad Minera Corona)

> Documento **funcional**: describe qué hace el sistema, qué se puede hacer con él, para qué sirve, a quién le sirve y quién lo administra. No incluye detalles técnicos.

---

## 1. ¿Qué es?

Es una **aplicación web** que centraliza y analiza todo el **mantenimiento de la infraestructura de comunicaciones y sistemas** de la mina (telefonía, cámaras, radio, red de datos, fibra óptica, WiFi y geomecánica).

Toma el registro histórico de actividades —incidentes y requerimientos atendidos en cada nivel y zona de la mina— y lo transforma en **indicadores, análisis y predicciones** que apoyan la toma de decisiones de mantenimiento, compras y personal.

Se usa **desde cualquier computadora o celular con el enlace**, sin instalar nada.

---

## 2. ¿Para qué está hecho? (objetivos)

- **Centralizar** en un solo lugar qué se hizo, dónde, por qué, con qué insumos y cuánto esfuerzo costó.
- **Medir la productividad** del equipo en Horas-Hombre (HH) y ver dónde se concentra el trabajo.
- **Anticipar la demanda de insumos** y la **carga de trabajo** para planificar compras y cuadrillas.
- **Priorizar el mantenimiento preventivo**, identificando las zonas con mayor riesgo de falla.
- **Controlar el cumplimiento de tiempos** (ANS / SLA).
- **Cargar la data de cada mes** de forma simple, guiada y validada.

---

## 3. ¿Qué se puede hacer? (módulos y funciones)

El sistema se organiza en módulos accesibles desde el menú lateral:

### 🟦 Resumen — visión general
Panorama del periodo de un vistazo.
- **Indicadores clave (KPIs):** totales de tareas, insumos, personal y horas.
- **Tendencia Mensual de Tareas:** evolución mes a mes, separando **Incidentes** y **Requerimientos**.
- **Tareas por Subsistema:** distribución según el tipo de infraestructura.

### 📈 Productividad — Tiempo y Horas-Hombre
Analiza el esfuerzo del equipo (HH = personas × tiempo).
- **Horas-Hombre por Causa Raíz:** en qué tipo de problema se concentra el esfuerzo.
- **HH por Nivel:** esfuerzo según la profundidad de la mina.
- **Proyección de Carga de Trabajo:** proyección de HH o número de tareas por mes (histórico + pronóstico) para anticipar picos de demanda de personal.

### 📦 Inventario — Suministros y mermas
Controla el consumo de materiales.
- **Materiales por Actividad:** qué insumos se usaron en cada actividad.
- **Top Insumos Consumidos:** los suministros de mayor demanda acumulada.
- **Mermas · Consumo por HH:** mide la **intensidad** del consumo (no el total bruto), para detectar uso excesivo o desperdicio.
- **Predicción de Demanda de Insumos:** pronóstico de consumo por insumo, para planificar compras y stock.

### 🛠️ Mantenimiento — Zonas calientes y causas
Orienta el mantenimiento preventivo.
- **Causa Raíz → Detalle:** análisis jerárquico, del motivo general al detalle específico.
- **Zonas Calientes:** ubicaciones con mayor número de intervenciones.
- **Riesgo de Falla por Zona:** prioriza la prevención según los incidentes por nivel/zona (clasifica el riesgo en Crítico / Alto / Medio / Bajo).
- **Cumplimiento ANS:** porcentaje de tareas atendidas dentro del objetivo de horas (nivel de servicio).

### ⬆️ Ingesta — carga de datos del mes
Para alimentar el sistema de forma autoservicio.
- Se **arrastra el Excel** del mes (solo las filas nuevas).
- El sistema **valida automáticamente**: detecta datos faltantes, duplicados y categorías no reconocidas, y **sugiere** la opción correcta del catálogo.
- Permite **corregir, incluir o excluir** filas antes de confirmar.
- Con **"Insertar data"**, la información se incorpora y todos los indicadores se actualizan. **Re-subir el mismo archivo no duplica datos.**

### 🧾 Tareas — registro de operaciones
- **Listado consultable** de todas las actividades, con su **detalle por ticket** (ubicación, causa, tiempo, personal e insumos).

---

## 4. Filtros e interactividad

Las gráficas y tablas se pueden **filtrar y se recalculan al instante** por:

| Filtro | Opciones |
|---|---|
| **Subsistema** | DAT (datos/red), CCTV (cámaras), RAD (radio), TEL (telefonía), GEO (geomecánica), FO (fibra óptica), WIFI |
| **Tipo** | Incidente · Requerimiento |
| **Origen** | Interior Mina (IM) · Superficie (SUP) |

Esto permite responder preguntas concretas, por ejemplo: *"¿cuántas HH gastamos en cámaras (CCTV) en interior mina este trimestre?"*.

---

## 5. ¿A quién le sirve?

| Perfil | Cómo lo aprovecha |
|---|---|
| **Jefatura / supervisión de Comunicaciones** | Ve carga de trabajo, zonas críticas y cumplimiento; decide dónde reforzar. |
| **Planeamiento / Logística / Almacén** | Usa la predicción de insumos y las mermas para programar compras y mantener stock. |
| **Técnicos / operadores** | Consultan y registran las operaciones; revisan el detalle de cada ticket. |
| **Gerencia / dirección** | Lee KPIs, tendencias y nivel de servicio (ANS) para reportes y seguimiento. |

---

## 6. ¿Quién lo administra?

- **Administrador funcional** (responsable de Comunicaciones / mantenimiento): realiza la **carga mensual** por el módulo *Ingesta*, revisa las validaciones y confirma la incorporación de los datos. Es quien mantiene el sistema "al día".
- **Acceso actual:** el sistema está disponible **para quien tenga el enlace** (sin inicio de sesión por ahora). Esto facilita compartirlo, pero implica que cualquiera con el enlace puede ver e incluso cargar datos.
  - *Mejora prevista:* proteger la **carga de datos** con una clave, dejando la **consulta** abierta o también restringida según se necesite.

---

## 7. ¿Cómo se mantiene actualizado?

El flujo de cada mes es simple y no requiere conocimientos técnicos:

1. El administrador llena la **plantilla del mes** (un Excel con un orden de columnas definido) solo con las actividades nuevas.
2. La **arrastra** al módulo *Ingesta*.
3. Revisa el **reporte de validación** y corrige lo que haga falta.
4. Pulsa **"Insertar data"** → los tableros quedan actualizados al instante para todos los usuarios.

---

*Resumen en una frase:* **es el tablero de control del mantenimiento de comunicaciones de la mina — registra lo que se hace, mide el esfuerzo y los insumos, anticipa demanda y riesgo, y se alimenta con una carga mensual simple y validada.**
