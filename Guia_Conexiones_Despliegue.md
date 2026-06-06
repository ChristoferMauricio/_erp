# Guía de Conexiones y Despliegue - ERP Minero

Esta guía detalla **paso a paso** el procedimiento completo para configurar la base de datos en **Supabase**, desplegar la aplicación web en **Vercel**, el microservicio de analítica predictiva en **Render**, y conectarlos entre sí. Incluye requisitos previos, solución de problemas comunes y sugerencias de mejora.

---

## Requisitos Previos

Antes de iniciar, asegúrate de tener lo siguiente:

| Requisito | Versión mínima | Para qué se usa |
|---|---|---|
| **Node.js** | 18.x o superior | Compilar el frontend Next.js |
| **Python** | 3.9 o superior | Ejecutar el script de ingesta (`ingest.py`) |
| **Git** | 2.x | Subir el código a GitHub |
| **pip** (Python) | 21.x | Instalar dependencias de Python |
| **Cuenta GitHub** | — | Repositorio de código fuente |
| **Navegador moderno** | Chrome/Firefox/Edge | Acceder a Supabase, Vercel y Render |

### Librerías Python necesarias para la ingesta

Antes de ejecutar `ingest.py`, instala las dependencias:

```powershell
pip install pandas openpyxl pg8000 numpy
```

> **Nota:** No es necesario instalar `psycopg2` en tu máquina local. El script usa `pg8000` (puro Python) para evitar problemas de compilación en Windows.

---

## Mapa de Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│              USUARIO (Navegador / PWA)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            Next.js Web App (Vercel)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Server Actions (actions.ts)                           │ │
│  │  ┌──────────────┐  ┌────────────────────────────────┐  │ │
│  │  │ Pool `pg`    │  │ fetch() → Render Predictive    │  │ │
│  │  │ (SQL directo)│  │ (HTTP REST API)                │  │ │
│  │  └──────┬───────┘  └──────────────┬─────────────────┘  │ │
│  └─────────┼─────────────────────────┼────────────────────┘ │
│            │ Fallback: excelParser   │                      │
│            │ (xlsx local)            │                      │
└────────────┼─────────────────────────┼──────────────────────┘
             │ TCP/SSL :6543           │ HTTPS
             ▼                         ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│   Supabase PostgreSQL    │  │  FastAPI Predictive (Render)  │
│  ┌─────────────────────┐ │  │  ┌─────────────────────────┐  │
│  │ Tablas:             │ │  │  │ Holt-Winters (statsmod) │  │
│  │ - empresa           │ │  │  │ Exponential Smoothing   │  │
│  │ - tarea             │ │  │  │ Pronóstico de Insumos   │  │
│  │ - tarea_insumo      │ │  │  └────────────┬────────────┘  │
│  │ - insumo, stock     │ │  │               │ psycopg2       │
│  │ - ubicacion, etc.   │ │  │  Lee datos históricos de ──►  │
│  └─────────────────────┘ │  └───────────────────────────────┘
│          ▲               │
│          │               │
└──────────┼───────────────┘
           │ pg8000 (Python)
┌──────────┴───────────────┐
│    Script de Ingesta     │
│  (scripts/ingest.py)     │
│  Lee Excel → Inserta DB  │
└──────────────────────────┘
```

### Flujo de datos resumido

1. **Ingesta inicial:** El script `ingest.py` lee el Excel histórico y lo inserta en Supabase.
2. **Consultas del Dashboard:** El frontend (Vercel) consulta Supabase directamente via SQL para mostrar KPIs, gráficos y tablas.
3. **Predicciones ML:** El frontend llama al microservicio de Render, que lee datos históricos de Supabase y devuelve predicciones de consumo de insumos.
4. **Fallback local:** Si Supabase no está disponible, el frontend lee el archivo `.xlsx` como respaldo temporal.

---

## Paso 1: Configuración de Supabase (Base de Datos)

Supabase aloja la base de datos PostgreSQL, gestiona la autenticación y puede almacenar evidencias fotográficas.

### 1.1 — Crear cuenta y proyecto

1. Ve a [supabase.com](https://supabase.com) y haz clic en **"Start your project"**.
2. Regístrate con tu **cuenta de GitHub** (recomendado) o con email.
3. Una vez dentro del dashboard, haz clic en **"New project"**.
4. Selecciona tu **organización** (se crea una automáticamente al registrarte).
5. Completa los campos:

   | Campo | Valor recomendado |
   |---|---|
   | **Name** | `erp-minero` |
   | **Database Password** | Genera una contraseña segura (mín. 16 caracteres con mayúsculas, minúsculas, números y símbolos). **Cópiala y guárdala de inmediato**, la necesitarás para la cadena de conexión. |
   | **Region** | `South America (São Paulo)` — elige la más cercana a la ubicación física de la mina o de los usuarios principales. |
   | **Pricing Plan** | `Free` (incluye 500 MB de base de datos y 1 GB de ancho de banda) |

6. Haz clic en **"Create new project"**.
7. Espera ~2-3 minutos mientras Supabase aprovisiona la base de datos.

> **⚠️ IMPORTANTE:** Si pierdes la contraseña de la base de datos, puedes resetearla en **Settings > Database > Database Password**, pero deberás actualizar todas las cadenas de conexión en Vercel, Render y tu entorno local.

### 1.2 — Copiar las credenciales

Una vez que el proyecto esté activo (indicador verde), necesitas **3 credenciales** distintas:

#### A) Project URL y API Key

1. En el panel izquierdo, haz clic en el **ícono de engranaje** (⚙️ Settings).
2. Ve a **API** en el menú lateral.
3. En la sección **Project URL**:
   - Copia la URL (ejemplo: `https://abcdefghij.supabase.co`).
   - **Guárdala como:** `NEXT_PUBLIC_SUPABASE_URL`
4. En la sección **Project API keys**:
   - Copia la clave que dice **anon public** (es la fila superior).
   - **Guárdala como:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> **Nota:** La clave `anon` es pública y segura de usar en el frontend. La clave `service_role` es secreta y **nunca** debe exponerse en el frontend.

#### B) Cadena de conexión (Connection String)

1. En Settings, ve a **Database**.
2. Baja a la sección **Connection string**.
3. Selecciona la pestaña **URI**.
4. Copia la cadena completa. Se verá así:
   ```
   postgresql://postgres.[PROJECT_ID]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
5. **Reemplaza `[YOUR-PASSWORD]`** con la contraseña real que creaste en el paso 1.1.
6. **Guárdala como:** `DATABASE_URL`

> **⚠️ IMPORTANTE:** Asegúrate de que el puerto sea `6543` (connection pooler) y **no** `5432` (conexión directa). El pooler es obligatorio para funcionar con Vercel y Render.

#### Resumen de credenciales

Al finalizar este paso, deberás tener guardados estos 3 valores:

| Variable | Ejemplo | Dónde se usa |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefghij.supabase.co` | Vercel (frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | Vercel (frontend) |
| `DATABASE_URL` | `postgresql://postgres.xyz:MiPass@...pooler.supabase.com:6543/postgres` | Vercel, Render, y tu PC local |

### 1.3 — Crear las tablas (Ejecutar migración SQL)

1. En el panel izquierdo de Supabase, haz clic en **SQL Editor** (ícono `<>`).
2. Haz clic en **"New query"** (Consulta nueva).

**Paso A — Esquema de tablas:**

3. Abre en tu editor de texto el archivo local:
   `_erp/supabase/migrations/0001_initial_schema.sql`
4. Selecciona **todo** el contenido (`Ctrl+A`), cópialo (`Ctrl+C`).
5. Pégalo en el editor SQL de Supabase (`Ctrl+V`).
6. Haz clic en el botón **"Run"** (o presiona `Ctrl+Enter`).
7. Verifica que el resultado diga **"Success. No rows returned"** — esto es correcto, ya que los `CREATE TABLE` no devuelven filas.

**Paso B — Datos semilla (catálogos):**

8. Haz clic en **"New query"** nuevamente para abrir un editor limpio.
9. Abre el archivo local: `_erp/supabase/seed.sql`
10. Copia todo su contenido y pégalo en el editor SQL de Supabase.
11. Haz clic en **"Run"**.
12. Verifica que no haya errores.

**Verificación rápida:**

13. Ve a **Table Editor** en el panel izquierdo.
14. Deberías ver las tablas creadas: `empresa`, `unidad_minera`, `cat_tipo`, `cat_area`, `cat_origen`, `cat_subsistema`, `cat_unidad_medida`, `tarea`, `insumo`, `ubicacion`, etc.
15. Haz clic en `empresa` y verifica que exista un registro con nombre "Sociedad Minera Corona".

> **🔧 Troubleshooting:** Si ves un error `relation already exists`, significa que ya ejecutaste el script antes. Puedes ignorar el error o agregar `IF NOT EXISTS` a los `CREATE TABLE` para que sea idempotente.

---

## Paso 2: Ingesta del Histórico desde el Excel

Este paso poblará la base de datos con las ~2,277 tareas históricas y sus consumos de insumos desde el Excel.

### 2.1 — Preparar el entorno local

1. Abre **PowerShell** (o Windows Terminal).
2. Navega a la carpeta del proyecto:
   ```powershell
   cd "d:\...\9 Emprendimiento\_erp"
   ```
3. Define la variable de entorno con tu cadena de conexión de Supabase:
   ```powershell
   $env:DATABASE_URL="postgresql://postgres.TU_ID:TU_CONTRASEÑA@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
   ```

> **⚠️ Nota:** En PowerShell, usa comillas dobles (`"`) para la cadena. Si tu contraseña contiene caracteres especiales como `$`, `!`, o `#`, enciérralos con comilla simple dentro de la doble, o usa el carácter de escape `` ` `` de PowerShell.

### 2.2 — Instalar dependencias Python

Si aún no lo has hecho:
```powershell
pip install pandas openpyxl pg8000 numpy
```

### 2.3 — Ejecutar el script de ingesta

```powershell
python scripts/ingest.py --direct
```

El script hará lo siguiente en orden:
1. Lee el archivo Excel `Yauricocha - CORONA.xlsx`.
2. Parsea las ~2,277 filas, identificando tareas padre e hijos (insumos).
3. Normaliza ubicaciones, insumos y causas raíz.
4. Genera un archivo SQL de respaldo en `supabase/migration_data.sql`.
5. **Inserta directamente** los datos en Supabase via `pg8000`.

**Salida esperada en consola:**
```
Leyendo Excel: d:\...\Yauricocha - CORONA.xlsx
Agrupando tareas y procesando consumos de insumos...
Procesamiento finalizado:
 - Ubicaciones únicas: ~350
 - Insumos únicos: ~45
 - Causas raíz únicas: ~60
 - Tareas creadas: ~2277
Generando archivo SQL en: d:\...\supabase\migration_data.sql
Iniciando inserción directa en Supabase via pg8000...
Conectando a PostgreSQL en aws-0-us-east-1.pooler.supabase.com:6543...
Parseando sentencias SQL...
Ejecutando XXXX sentencias en bloque de transacción...
 - Progreso: 0/XXXX sentencias ejecutadas.
 - Progreso: 250/XXXX sentencias ejecutadas.
 ...
¡Inserción directa completada con éxito en la base de datos Supabase!
```

### 2.4 — Verificar la ingesta en Supabase

1. Ve al **Table Editor** en Supabase.
2. Haz clic en la tabla `tarea`.
3. Deberías ver ~2,277 filas.
4. Haz clic en la tabla `tarea_insumo` — deberías ver los registros de consumo de insumos.
5. Haz clic en `insumo` — verifica que los nombres estén normalizados (sin duplicados como "cintillos" vs "Cintillos").

> **🔧 Troubleshooting:**
>
> | Error | Causa probable | Solución |
> |---|---|---|
> | `pg8000 not found` | No instalaste la dependencia | `pip install pg8000` |
> | `Connection refused` | Cadena de conexión incorrecta | Verifica que `DATABASE_URL` esté bien definida y que el puerto sea `6543` |
> | `password authentication failed` | Contraseña incorrecta en la URI | Ve a Supabase > Settings > Database y resetea la contraseña |
> | `relation "tarea" does not exist` | No ejecutaste la migración del Paso 1.3 | Ejecuta primero `0001_initial_schema.sql` y `seed.sql` |
> | `duplicate key violates unique constraint` | Ya ejecutaste la ingesta previamente | Los `ON CONFLICT DO NOTHING` previenen duplicados para catálogos, pero las tareas no tienen esa protección. Borra los datos con `TRUNCATE tarea CASCADE;` en SQL Editor antes de reintentar. |

---

## Paso 3: Subir el Código a GitHub

### 3.1 — Crear el repositorio

1. Ve a [github.com](https://github.com) e inicia sesión.
2. Haz clic en **"+"** (arriba a la derecha) → **"New repository"**.
3. Configura:

   | Campo | Valor |
   |---|---|
   | **Repository name** | `erp-minero` |
   | **Visibility** | `Private` (recomendado para código empresarial) |
   | **Initialize** | **NO** marques "Add a README file" (ya tienes archivos locales) |

4. Haz clic en **"Create repository"**.

### 3.2 — Crear archivo `.gitignore` en la raíz del proyecto

Antes de subir, asegúrate de que exista un `.gitignore` en la carpeta `_erp/` con este contenido mínimo:

```gitignore
# Dependencias
node_modules/
web/node_modules/
web/.next/

# Variables de entorno
.env
.env.local
.env.production

# Python
__pycache__/
*.pyc
venv/
.venv/

# Datos sensibles
supabase/migration_data.sql

# OS
.DS_Store
Thumbs.db
```

> **⚠️ IMPORTANTE:** Incluye `supabase/migration_data.sql` en `.gitignore` porque contiene todas las sentencias SQL con datos reales. No lo subas a GitHub.

### 3.3 — Subir el código

Abre PowerShell en la carpeta `_erp/` y ejecuta:

```powershell
git init
git add .
git commit -m "feat: initial commit - ERP Minero v1"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/erp-minero.git
git push -u origin main
```

> **Nota:** Reemplaza `TU-USUARIO` con tu nombre de usuario de GitHub. Si es la primera vez que usas Git en esta PC, se te pedirá autenticarte. Usa un **Personal Access Token** (PAT) como contraseña — puedes generarlo en GitHub > Settings > Developer settings > Personal access tokens.

---

## Paso 4: Despliegue del Frontend en Vercel

Vercel compilará y servirá la aplicación Next.js del dashboard.

### 4.1 — Crear cuenta en Vercel

1. Ve a [vercel.com](https://vercel.com) y haz clic en **"Sign Up"**.
2. Selecciona **"Continue with GitHub"** para vincular tu cuenta de GitHub (recomendado).
3. Autoriza el acceso cuando GitHub lo solicite.

### 4.2 — Importar el proyecto

1. En el dashboard de Vercel, haz clic en **"Add New..."** → **"Project"**.
2. En la sección **"Import Git Repository"**, busca y selecciona `erp-minero`.
   - Si no ves tu repositorio, haz clic en **"Adjust GitHub App Permissions"** y otorga acceso al repo específico.
3. Vercel detectará automáticamente que es un proyecto Next.js.

### 4.3 — Configurar el proyecto

En la pantalla de configuración del proyecto, ajusta:

| Campo | Valor | Motivo |
|---|---|---|
| **Project Name** | `erp-minero` | Nombre de tu app en Vercel |
| **Framework Preset** | `Next.js` | Debería autodetectarse |
| **Root Directory** | `web` | El frontend está en la subcarpeta `web/`, no en la raíz |
| **Build Command** | *(dejar por defecto: `next build`)* | Vercel lo infiere automáticamente |
| **Output Directory** | *(dejar por defecto)* | Next.js usa `.next` internamente |
| **Install Command** | *(dejar por defecto: `npm install`)* | Instala las dependencias |

### 4.4 — Configurar variables de entorno

Expande la sección **"Environment Variables"** y agrega las siguientes:

| Key (nombre de variable) | Value (valor) | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.xyz:Pass@...pooler.supabase.com:6543/postgres` | La cadena URI completa de Supabase (Paso 1.2B) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefghij.supabase.co` | La Project URL de Supabase (Paso 1.2A) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` | La clave anon de Supabase (Paso 1.2A) |
| `NEXT_PUBLIC_PREDICTIVE_API_URL` | *(Agregar después del Paso 5.3)* | La URL del servicio en Render |

> **Nota:** Las variables con prefijo `NEXT_PUBLIC_` son accesibles desde el navegador del usuario. Las que no tienen ese prefijo (como `DATABASE_URL`) solo están disponibles en el servidor de Vercel (Server Actions).

### 4.5 — Desplegar

1. Haz clic en **"Deploy"**.
2. Vercel clonará el repositorio, instalará dependencias y compilará el proyecto.
3. El proceso de build tarda ~2-4 minutos.
4. Una vez completado, Vercel te mostrará una URL pública:
   ```
   https://erp-minero.vercel.app
   ```
   (o un nombre similar generado automáticamente)

### 4.6 — Verificar el despliegue

1. Abre la URL proporcionada en tu navegador.
2. Deberías ver el dashboard con:
   - KPIs (total tareas, insumos, promedio personas, horas).
   - Gráficos de barras con los insumos más usados.
   - Gráfico de líneas con tendencia mensual.
   - Tabla paginada de tareas.
3. Si los datos vienen de Supabase, verás las ~2,277 tareas reales del Excel.

> **🔧 Troubleshooting:**
>
> | Síntoma | Causa | Solución |
> |---|---|---|
> | Dashboard vacío (0 tareas) | `DATABASE_URL` no configurada o incorrecta | Verifica las env vars en Vercel > Settings > Environment Variables |
> | Error 500 en producción | Error en Server Actions | Ve a Vercel > Deployments > Functions > Logs para ver el error |
> | Build falla con "Module not found" | Root Directory no es `web` | Ve a Vercel > Settings > General > Root Directory y verifica que sea `web` |
> | Datos del Excel (no de Supabase) | Fallback activado | Revisa los logs del servidor; probablemente la cadena de conexión tiene un error |

---

## Paso 5: Despliegue del Microservicio de ML en Render

Render compilará y ejecutará el modelo predictivo de series de tiempo (Holt-Winters).

### 5.1 — Crear cuenta en Render

1. Ve a [render.com](https://render.com) y haz clic en **"Get Started for Free"**.
2. Selecciona **"GitHub"** para registrarte con tu misma cuenta de GitHub.
3. Autoriza el acceso.

### 5.2 — Crear el Web Service

1. En el dashboard de Render, haz clic en **"New +"** (arriba a la derecha) → **"Web Service"**.
2. En **"Source Code"**, selecciona **"Build and deploy from a Git repository"** → Next.
3. Conecta tu cuenta de GitHub (si no lo hiciste al registrarte) y selecciona el repositorio `erp-minero`.

### 5.3 — Configurar el servicio

| Campo | Valor | Motivo |
|---|---|---|
| **Name** | `erp-predictive-service` | Nombre del servicio en Render |
| **Region** | `Oregon (US West)` o la más cercana a São Paulo | Minimizar latencia con Supabase |
| **Branch** | `main` | La rama principal del repositorio |
| **Root Directory** | `predictive` | El microservicio de ML vive en esta subcarpeta |
| **Runtime** | `Docker` | El Dockerfile ya está configurado con `python:3.9-slim`, `build-essential` y `libpq-dev`, asegurando compatibilidad con `psycopg2` y librerías científicas |
| **Instance Type** | `Free` | Suficiente para el volumen actual (~2,300 tareas históricas) |

> **⚠️ Nota sobre el plan Free de Render:** Los servicios gratuitos se **suspenden después de 15 minutos de inactividad** y tardan ~30-60 segundos en "despertar" (cold start) cuando reciben la primera petición. Esto es aceptable para un MVP pero no para producción.

### 5.4 — Configurar variables de entorno

En la misma pantalla de configuración, ve a la sección **"Environment Variables"** y agrega:

| Key | Value |
|---|---|
| `DATABASE_URL` | La misma cadena URI de Supabase del Paso 1.2B |

### 5.5 — Desplegar

1. Haz clic en **"Create Web Service"**.
2. Render clonará el repositorio, construirá la imagen Docker y desplegará el servicio.
3. El primer build puede tardar ~5-8 minutos (descarga la imagen base, instala dependencias científicas).
4. Una vez activo, Render te mostrará una URL pública:
   ```
   https://erp-predictive-service.onrender.com
   ```

### 5.6 — Verificar el servicio

Puedes probar que el servicio está activo haciendo una petición GET al endpoint raíz:

```powershell
curl https://erp-predictive-service.onrender.com/
```

O abriendo la URL en el navegador. Deberías ver una respuesta JSON como:
```json
{"status": "ok", "service": "ERP Predictive API"}
```

### 5.7 — Vincular Render con Vercel

**Este paso es crítico para cerrar el circuito:**

1. Copia la URL pública de Render (ej. `https://erp-predictive-service.onrender.com`).
2. Ve a **Vercel** → Tu proyecto `erp-minero` → **Settings** → **Environment Variables**.
3. Agrega (o edita si ya existe):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_PREDICTIVE_API_URL` | `https://erp-predictive-service.onrender.com` |

4. Haz clic en **"Save"**.
5. Ve a **Deployments** y haz clic en **"Redeploy"** en el último deployment (las env vars nuevas no surten efecto hasta el siguiente deploy).

---

## Paso 6: Verificación Integral del Sistema

### 6.1 — Lista de verificación final

| # | Verificación | Cómo comprobarlo | ✅ |
|---|---|---|---|
| 1 | Supabase tiene tablas creadas | Table Editor muestra `tarea`, `insumo`, etc. | ☐ |
| 2 | Datos históricos cargados | Tabla `tarea` tiene ~2,277 filas | ☐ |
| 3 | Frontend desplegado | Acceder a `https://erp-minero.vercel.app` muestra el dashboard | ☐ |
| 4 | Dashboard muestra datos reales | KPIs muestran ~2,277 tareas, no 0 | ☐ |
| 5 | Servicio ML activo | `curl https://erp-predictive-service.onrender.com/` responde OK | ☐ |
| 6 | Predicciones funcionan | El botón de predicción en el dashboard devuelve resultados | ☐ |

### 6.2 — Flujo de producción

Una vez completados todos los pasos:

1. **Dashboard en tiempo real:** Al acceder a la URL de Vercel, el dashboard consultará directamente la base de datos de Supabase en tiempo real, mostrando KPIs, gráficos y tablas.
2. **Registro de tareas:** Al registrar una nueva tarea desde la interfaz, se guardará directamente en Supabase de forma instantánea.
3. **Predicción de insumos:** El microservicio de Render consultará las tablas históricas para generar predicciones de consumo de insumos y mantenimiento preventivo, sin afectar el rendimiento del frontend.
4. **Despliegue automático:** Cada vez que hagas `git push` a la rama `main`, tanto Vercel como Render **redesplegarán automáticamente** la nueva versión del código.

---

## Paso 7: Despliegues Futuros y Workflow Diario

### 7.1 — Cómo desplegar una actualización

```powershell
# 1. Haz tus cambios en el código local
# 2. Verifica localmente
cd web
npm run dev
# 3. Si todo funciona, sube los cambios
git add .
git commit -m "fix: descripción del cambio"
git push origin main
# 4. Vercel y Render detectan el push y redesplegan automáticamente (~2-5 min)
```

### 7.2 — Cómo agregar nuevos datos al histórico

Si recibes un nuevo Excel con datos adicionales:

1. Actualiza el archivo `Yauricocha - CORONA.xlsx` con los nuevos datos.
2. Ejecuta la ingesta nuevamente:
   ```powershell
   $env:DATABASE_URL="tu_cadena_de_conexion"
   python scripts/ingest.py --direct
   ```
3. Los nuevos datos se agregarán a la base de datos (las tareas existentes permanecerán intactas gracias a los UUIDs deterministas).

---

## Sugerencias de Mejora

### 🟢 Prioridad Alta (Implementar antes de ir a producción)

#### 1. Row Level Security (RLS) en Supabase

Actualmente, cualquier persona con la clave `anon` puede leer/escribir en todas las tablas. Esto es un **riesgo de seguridad**.

**Qué hacer:**
```sql
-- Habilitar RLS en cada tabla
ALTER TABLE tarea ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarea_insumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumo ENABLE ROW LEVEL SECURITY;
-- ... (repetir para cada tabla)

-- Crear políticas de acceso
CREATE POLICY "Usuarios autenticados pueden leer tareas de su unidad" ON tarea
  FOR SELECT
  USING (unidad_minera_id IN (
    SELECT unidad_minera_id FROM user_unit_access WHERE user_id = auth.uid()
  ));
```

**Beneficio:** Cada usuario solo ve los datos de su unidad minera, implementando multi-tenancy real a nivel de base de datos.

---

#### 2. Autenticación de Usuarios con Supabase Auth

Actualmente el dashboard es público. Implementar un sistema de login.

**Qué hacer:**
- Habilitar **Supabase Auth** en el dashboard de Supabase (Authentication > Providers > Email).
- Instalar `@supabase/auth-helpers-nextjs` en el frontend.
- Crear una página `/login` con formulario de email/contraseña.
- Proteger las Server Actions verificando el token JWT del usuario.

**Beneficio:** Solo usuarios autorizados acceden al sistema. El campo `created_by` de la tabla `tarea` empezará a llenarse con el UUID del usuario autenticado.

---

#### 3. Variables de entorno seguras con `.env.local`

En lugar de definir `DATABASE_URL` manualmente en PowerShell cada vez, crea un archivo `.env.local` en `_erp/`:

```env
DATABASE_URL=postgresql://postgres.xyz:MiPass@...pooler.supabase.com:6543/postgres
```

Y modifica `ingest.py` para leerlo:
```python
from dotenv import load_dotenv
load_dotenv()  # Lee .env.local automáticamente
```

> **⚠️** Asegúrate de que `.env.local` esté en `.gitignore` para no subirlo a GitHub.

---

### 🟡 Prioridad Media (Mejoras de funcionalidad)

#### 4. Migrar de `psycopg2` a `pg8000` en el microservicio predictivo

El archivo `predictive/requirements.txt` aún usa `psycopg2-binary`. Aunque funciona en Docker con las dependencias de sistema, es recomendable migrar a `pg8000` por consistencia con el script de ingesta.

**Qué hacer:** En `predictive/requirements.txt`:
```diff
- psycopg2-binary>=2.9.0
+ pg8000>=1.30.0
```

Y actualizar las conexiones en `predictive/app/main.py` para usar `pg8000.dbapi` en lugar de `psycopg2`.

**Beneficio:** Imagen Docker más pequeña (no necesita `build-essential` ni `libpq-dev`), builds más rápidos en Render.

---

#### 5. Health Check endpoint en el microservicio

Agregar un endpoint `/health` que verifique la conexión a la base de datos:

```python
@app.get("/health")
async def health_check():
    try:
        # Intentar hacer una consulta simple
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": str(e)}
        )
```

**Beneficio:** Render puede usar este endpoint para monitorear automáticamente la salud del servicio y reiniciarlo si falla.

---

#### 6. Implementar Connection Pooling en el microservicio

Actualmente, cada petición al microservicio de Render crea una nueva conexión a la base de datos. Implementar un pool de conexiones.

**Qué hacer:** Usar un pool de conexiones con `pg8000`:
```python
from contextlib import contextmanager
import pg8000.dbapi

pool_connections = []

@contextmanager
def get_db():
    conn = pg8000.dbapi.connect(...)
    try:
        yield conn
    finally:
        conn.close()
```

**Beneficio:** Mejor rendimiento y menor latencia en las consultas al modelo predictivo.

---

#### 7. Cache de predicciones

Las predicciones de consumo de insumos no cambian con cada petición. Implementar un cache en memoria con TTL (Time To Live).

**Qué hacer:** Usar `functools.lru_cache` o `cachetools.TTLCache`:
```python
from cachetools import TTLCache
prediction_cache = TTLCache(maxsize=100, ttl=3600)  # 1 hora de cache
```

**Beneficio:** Reduce la carga en la base de datos y acelera las respuestas del microservicio de ML.

---

### 🔵 Prioridad Baja (Mejoras avanzadas para el futuro)

#### 8. Dominio personalizado

Configurar un dominio propio como `erp.minera-corona.com` en Vercel.

**Qué hacer:**
1. Compra un dominio en Namecheap, GoDaddy, o similar (~$10-15/año).
2. En Vercel > Settings > Domains, agrega tu dominio.
3. Configura los registros DNS (CNAME y A) según las instrucciones de Vercel.

---

#### 9. CI/CD Pipeline con GitHub Actions

Agregar tests automatizados que se ejecuten antes de cada despliegue:

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: cd web && npm ci && npm run build
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.9'
      - run: cd predictive && pip install -r requirements.txt
      - run: cd predictive && python -m pytest tests/ -v
```

**Beneficio:** Detectar errores antes de que lleguen a producción.

---

#### 10. Monitoreo y Alertas

Implementar observabilidad para detectar problemas proactivamente:

- **Sentry** (gratuito para proyectos pequeños): Captura errores del frontend y backend automáticamente.
- **Supabase Dashboard**: Monitorea el uso de la base de datos, conexiones activas, y espacio utilizado.
- **UptimeRobot** (gratuito): Envía alertas por email/Telegram si la URL de Vercel o Render deja de responder.

---

#### 11. PWA (Progressive Web App)

Convertir la aplicación en una PWA para uso offline en la mina (donde la conectividad puede ser limitada):

**Qué hacer:**
- Agregar un `manifest.json` con iconos y configuración de la app.
- Implementar un Service Worker con `next-pwa` para cachear las páginas del dashboard.
- Habilitar modo offline con datos cacheados del último sincronismo.

**Beneficio:** Los técnicos en mina pueden usar la aplicación incluso sin cobertura de red, y los datos se sincronizan automáticamente cuando recuperan conectividad.

---

#### 12. Backup automático de base de datos

Configurar backups periódicos de la base de datos Supabase:

**Qué hacer:**
- Supabase Free incluye backups diarios automáticos (retención de 7 días).
- Para backup adicional, crear un script con `pg_dump` que se ejecute via GitHub Actions:

```yaml
# .github/workflows/backup.yml
name: DB Backup
on:
  schedule:
    - cron: '0 6 * * 1'  # Cada lunes a las 6AM UTC
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Dump database
        run: pg_dump ${{ secrets.DATABASE_URL }} > backup_$(date +%Y%m%d).sql
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_number }}
          path: backup_*.sql
          retention-days: 30
```

---

## Resumen de URLs del Sistema

| Servicio | URL | Propósito |
|---|---|---|
| **Dashboard (Vercel)** | `https://erp-minero.vercel.app` | Frontend principal del ERP |
| **API Predictiva (Render)** | `https://erp-predictive-service.onrender.com` | Microservicio de ML |
| **Base de Datos (Supabase)** | `https://abcdefghij.supabase.co` | Panel de administración DB |
| **Repositorio (GitHub)** | `https://github.com/tu-usuario/erp-minero` | Código fuente |
