import type { fetchDashboardData } from '@/app/actions';

/**
 * Forma del objeto que alimenta el tablero, derivada automáticamente del server action
 * `fetchDashboardData` (que a su vez devuelve `buildDashboardFromTasks`). Al estar derivada,
 * si se renombra o quita un campo en la fuente, el consumo en page.tsx falla EN COMPILACIÓN
 * (antes, al ser `any`, fallaba en runtime con un gráfico vacío).
 *
 * Se usa `import type` para que el bundler no intente importar el módulo "use server" en cliente.
 */
export type DashboardData = Awaited<ReturnType<typeof fetchDashboardData>>;
