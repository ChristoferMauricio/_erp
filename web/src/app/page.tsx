"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import {
  fetchDashboardData,
  fetchTasks,
  fetchCargaPrediction,
  fetchInsumosPrediction,
  fetchMantenimientoPrediction,
  validarIngesta,
  confirmarIngesta,
  exportarExcel
} from './actions';
import * as XLSX from 'xlsx';
import {
  Wrench,
  TrendingUp,
  Boxes,
  Users,
  Clock,
  MapPin,
  Search,
  ChevronRight,
  ChevronLeft,
  FileText,
  HelpCircle,
  Activity,
  Layers,
  ArrowUpRight,
  Sun,
  Moon,
  PanelLeft,
  PanelLeftClose,
  LayoutDashboard,
  BarChart3,
  Bell,
  Menu,
  Filter,
  ShieldCheck,
  AlertTriangle,
  UploadCloud,
  Download,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ComposedChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { BoxPlot } from '@/components/BoxPlot';
import { HowCalc } from '@/components/HowCalc';
import { Heatmap } from '@/components/Heatmap';
import { SubsistemaGlosario } from '@/components/SubsistemaGlosario';

const VALID_TABS = ['dashboard', 'productividad', 'inventario', 'mantenimiento', 'estadisticas', 'ingesta', 'tasks'] as const;
type TabId = typeof VALID_TABS[number];

// Lee pestaña + filtros desde la URL (?tab=...&sub=...&tipo=...&origen=...). Solo cliente.
function readUrlState(): { tab: TabId; filters: { subsistema?: string; tipo?: string; origen?: string } } {
  if (typeof window === 'undefined') return { tab: 'dashboard', filters: {} };
  const sp = new URLSearchParams(window.location.search);
  const t = sp.get('tab') || '';
  const filters: { subsistema?: string; tipo?: string; origen?: string } = {};
  const sub = sp.get('sub'); if (sub) filters.subsistema = sub;
  const tipo = sp.get('tipo'); if (tipo) filters.tipo = tipo;
  const ori = sp.get('origen'); if (ori) filters.origen = ori;
  return { tab: (VALID_TABS as readonly string[]).includes(t) ? (t as TabId) : 'dashboard', filters };
}

const CAUSE_TO_SUBSYSTEM: { [key: string]: string } = {
  'Balun Averiado': 'CCTV',
  'Cámara Averiado': 'CCTV',
  'Teléfono Averiado': 'TEL',
  'Teléfono averiado': 'TEL',
  'Mantenimiento  Correctivo Switch.': 'DAT',
  'Switch apagado por mónoxido': 'DAT',
  'Equipo Averiado': 'DAT',
  'Fuente averiada': 'DAT',
  'Fuente de radio': 'RAD',
  'Fuente de radio de 12V': 'RAD',
  'Fuente de radio de 24V DC': 'RAD',
  'Poste roto por colición de volquete': 'RAD',
  'Termino de explotación': 'DAT',
  'REQUERIMIENTO': 'DAT',
  'Mantenimiento Programado': 'DAT',
  'AP inoperativo': 'WIFI',
  'Acumulación Monóxido': 'DAT',
  'Falla General del Sistemas Eléctrico': 'DAT',
};

function inferSubsystem(cause: string | null | undefined): string {
  if (!cause) return 'DAT';
  const causeClean = cause.trim();
  const parentMatch = causeClean.match(/\(([A-Za-z\-]+)\)/);
  if (parentMatch) {
    const code = parentMatch[1].toUpperCase();
    if (code === 'WI-FI') return 'WIFI';
    return code;
  }
  if (causeClean in CAUSE_TO_SUBSYSTEM) {
    return CAUSE_TO_SUBSYSTEM[causeClean];
  }
  return 'DAT';
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>(() => readUrlState().tab);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [dashboardData, setDashboardData] = useState<any>(null);

  const [tasks, setTasks] = useState<any[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');

  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Filtros interactivos (re-consultan el dashboard) y estado de predicción
  const [filters, setFilters] = useState<{ subsistema?: string; tipo?: string; origen?: string }>(() => readUrlState().filters);
  const [cargaPred, setCargaPred] = useState<any[] | null>(null);
  const [cargaMetric, setCargaMetric] = useState<'hh' | 'tareas'>('hh');
  const [selectedInsumo, setSelectedInsumo] = useState<string>('');
  const [insumoPred, setInsumoPred] = useState<any[] | null>(null);
  const [insumoPredLoading, setInsumoPredLoading] = useState(false);
  const [riesgoZonas, setRiesgoZonas] = useState<any[] | null>(null);
  // Ingesta mensual
  const [ingestResult, setIngestResult] = useState<any>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestCommit, setIngestCommit] = useState<any>(null);
  const [ingestFileName, setIngestFileName] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  // Exportar a Excel
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState<string>('');

  async function doExport() {
    setExportMsg('');
    setExportLoading(true);
    try {
      const r: any = await exportarExcel();
      if (!r.ok || !r.base64) { setExportMsg(r.error || 'No se pudo exportar.'); return; }
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = r.filename || 'ERP_export.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportMsg('Error inesperado al exportar.');
    } finally {
      setExportLoading(false);
    }
  }

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    fetchDashboardData(filters).then(setDashboardData);
    fetchCargaPrediction().then(r => { if (r.ok) setCargaPred(r.data); });
    fetchMantenimientoPrediction().then(r => { if (r.ok) setRiesgoZonas(r.data); });
    loadTasks(1, '', '', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflejar pestaña + filtros en la URL (?tab=...&sub=...&tipo=...&origen=...): persiste al recargar y es compartible
  useEffect(() => {
    if (!mounted) return;
    const sp = new URLSearchParams();
    if (activeTab !== 'dashboard') sp.set('tab', activeTab);
    if (filters.subsistema) sp.set('sub', filters.subsistema);
    if (filters.tipo) sp.set('tipo', filters.tipo);
    if (filters.origen) sp.set('origen', filters.origen);
    const qs = sp.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [activeTab, filters, mounted]);

  // Re-consultar el dashboard cuando cambian los filtros
  useEffect(() => {
    if (!mounted) return;
    fetchDashboardData(filters).then(setDashboardData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Seleccionar un insumo por defecto cuando llegan los datos
  useEffect(() => {
    if (dashboardData?.insumoNames?.length && !selectedInsumo) {
      setSelectedInsumo(dashboardData.insumoNames[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardData]);

  // Pedir la predicción del insumo seleccionado al microservicio
  useEffect(() => {
    if (!selectedInsumo) return;
    setInsumoPredLoading(true);
    fetchInsumosPrediction(selectedInsumo).then(r => { setInsumoPred(r.data); setInsumoPredLoading(false); });
  }, [selectedInsumo]);

  const loadTasks = (page: number, searchVal: string, typeVal: string, originVal: string) => {
    startTransition(async () => {
      const res = await fetchTasks(page, 20, searchVal, typeVal, originVal);
      setTasks(res.items);
      setTotalTasks(res.total);
      setTotalPages(res.pages);
      setCurrentPage(page);
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadTasks(1, val, typeFilter, originFilter);
  };

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type);
    loadTasks(1, search, type, originFilter);
  };

  const handleOriginFilter = (origin: string) => {
    setOriginFilter(origin);
    loadTasks(1, search, typeFilter, origin);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      loadTasks(currentPage - 1, search, typeFilter, originFilter);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      loadTasks(currentPage + 1, search, typeFilter, originFilter);
    }
  };

  // ===== Ingesta mensual =====
  const handleIngestFile = async (file: File) => {
    setIngestCommit(null);
    setIngestResult(null);
    setIngestFileName(file.name);
    setIngestLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as any[];
      // A objetos planos (las fechas Date -> string ISO) para pasarlas al server action
      const plainRows = JSON.parse(JSON.stringify(rows));
      const res = await validarIngesta(plainRows);
      setIngestResult(res);
    } catch {
      setIngestResult({ ok: false, error: 'No se pudo leer el Excel.', activities: [] });
    } finally {
      setIngestLoading(false);
    }
  };

  const toggleInclude = (idx: number) =>
    setIngestResult((r: any) => r ? { ...r, activities: r.activities.map((a: any, i: number) => i === idx ? { ...a, include: !a.include } : a) } : r);

  const applyCausaSuggestion = (idx: number, suggestion: string) =>
    setIngestResult((r: any) => r ? { ...r, activities: r.activities.map((a: any, i: number) => i === idx ? { ...a, causa_raiz: suggestion, issues: (a.issues || []).filter((x: any) => x.field !== 'causa_raiz') } : a) } : r);

  const doCommit = async () => {
    if (!ingestResult) return;
    setIngestLoading(true);
    const included = ingestResult.activities.filter((a: any) => a.include);
    const res = await confirmarIngesta(included);
    setIngestCommit(res);
    setIngestLoading(false);
    if (res.ok) fetchDashboardData(filters).then(setDashboardData);
  };

  const COLORS = ['#2dd4bf', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f97316', '#64748b'];

  const tooltipStyle = theme === 'dark'
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#e2e8f0', fontSize: '12px' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', color: '#1f2937', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };

  const gridStroke = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const axisStroke = theme === 'dark' ? '#64748b' : '#9ca3af';

  const goTab = (id: TabId) => setActiveTab(id);

  const navItems = [
    { id: 'dashboard' as const, label: 'Resumen', icon: LayoutDashboard, desc: 'Visión general' },
    { id: 'productividad' as const, label: 'Productividad', icon: TrendingUp, desc: 'Tiempo y Horas-Hombre' },
    { id: 'inventario' as const, label: 'Inventario', icon: Boxes, desc: 'Suministros y mermas' },
    { id: 'mantenimiento' as const, label: 'Mantenimiento', icon: Activity, desc: 'Zonas calientes y causas' },
    { id: 'estadisticas' as const, label: 'Estadísticas', icon: BarChart3, desc: 'Dispersión, cajas, histograma' },
    { id: 'ingesta' as const, label: 'Ingesta', icon: UploadCloud, desc: 'Cargar Excel del mes' },
    { id: 'tasks' as const, label: 'Tareas', icon: Wrench, desc: 'Registro de operaciones', badge: totalTasks },
  ];

  const tabLabels: Record<string, string> = {
    dashboard: 'Resumen Analítico',
    productividad: 'Productividad · Tiempo & HH',
    inventario: 'Inventario · Suministros',
    mantenimiento: 'Mantenimiento · Análisis',
    estadisticas: 'Análisis Estadístico',
    ingesta: 'Ingesta de Datos',
    tasks: 'Registro de Tareas',
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-teal-500/20">
            <Activity className="h-7 w-7 text-white animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-gray-900 dark:text-white font-bold text-lg">ERP Minero</p>
            <p className="text-gray-500 dark:text-slate-500 text-sm mt-1">Iniciando plataforma...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-slate-100 selection:bg-teal-500/20 font-sans">

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* ========== SIDEBAR ========== */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen
        flex flex-col shrink-0
        bg-white dark:bg-slate-950
        border-r border-gray-200 dark:border-slate-800/80
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-64' : 'w-[72px]'}
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-gray-200 dark:border-slate-800/80 shrink-0 ${sidebarOpen ? 'px-5 justify-between' : 'px-0 justify-center'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-md shadow-teal-500/15 shrink-0">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">ERP Minero</h1>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">UM Corona</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors hidden lg:flex items-center justify-center"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {sidebarOpen && (
            <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-widest px-3 mb-3 block">
              Módulos
            </span>
          )}
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { goTab(item.id); setMobileSidebarOpen(false); }}
                title={!sidebarOpen ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-xl transition-all duration-200 group
                  ${sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
                  ${active
                    ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-teal-600 dark:text-teal-400' : 'group-hover:text-gray-700 dark:group-hover:text-white'}`} />
                {sidebarOpen && (
                  <>
                    <div className="text-left min-w-0 flex-1">
                      <span className="text-[13px] font-medium block truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="text-[10px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-md">
                        {item.badge.toLocaleString()}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}

          {/* Exportar todo a Excel (datos + tablas dinámicas) vía microservicio */}
          <button
            onClick={doExport}
            disabled={exportLoading}
            title="Exportar todo a Excel (datos + tablas dinámicas)"
            className={`
              w-full flex items-center gap-3 rounded-xl transition-colors mt-1
              ${sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
              text-gray-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400
              ${exportLoading ? 'opacity-60 cursor-wait' : ''}
            `}
          >
            {exportLoading
              ? <Activity className="h-[18px] w-[18px] shrink-0 animate-spin" />
              : <Download className="h-[18px] w-[18px] shrink-0" />}
            {sidebarOpen && <span className="text-sm font-medium">{exportLoading ? 'Generando…' : 'Exportar a Excel'}</span>}
          </button>
          {sidebarOpen && exportMsg && (
            <p className="text-[10px] text-rose-500 px-3 mt-1 leading-snug">{exportMsg}</p>
          )}

          <div className="pt-4">
            {sidebarOpen && (
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-widest px-3 mb-3 block">
                Próximamente
              </span>
            )}
            {[
              { label: 'Personal', icon: Users },
              { label: 'Reportes', icon: FileText },
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  disabled
                  title={item.label}
                  className={`
                    w-full flex items-center gap-3 rounded-xl cursor-not-allowed opacity-30
                    ${sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
                    text-gray-400 dark:text-slate-500
                  `}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {sidebarOpen && <span className="text-[13px] font-medium truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-gray-200 dark:border-slate-800/80 p-3 shrink-0">
          {!sidebarOpen ? (
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-full p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1">
              <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${dashboardData?.source === 'supabase' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'}`}>
                <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${dashboardData?.source === 'supabase' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className={`text-[10px] font-semibold ${dashboardData?.source === 'supabase' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{dashboardData?.source === 'supabase' ? 'Postgres / Supabase' : 'Excel Local'}</span>
              </div>
              <span className="text-[10px] text-gray-400 dark:text-slate-600 font-medium ml-auto">v1.0</span>
            </div>
          )}
        </div>
      </aside>

      {/* ========== MAIN AREA ========== */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Header */}
        <header className="h-16 shrink-0 border-b border-gray-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 flex items-center justify-between px-4 md:px-6 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-gray-400 dark:text-slate-500 font-medium">ERP Minero</span>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-slate-700" />
              <span className="font-semibold text-gray-800 dark:text-white">{tabLabels[activeTab]}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            <button className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all relative">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-teal-500 ring-2 ring-white dark:ring-slate-950" />
            </button>

            <div className="w-px h-6 bg-gray-200 dark:bg-slate-800 mx-1 hidden sm:block" />

            <div className="flex items-center gap-2.5 ml-1">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                CM
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-gray-800 dark:text-white leading-tight">Christofer M.</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Administrador</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0B0F19]">
          <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">

            {/* ========== METRIC CARDS ========== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

              <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 opacity-[0.04] group-hover:scale-110 transition-transform duration-300">
                  <Wrench className="h-28 w-28" />
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 tracking-wider uppercase">Total Tareas</span>
                  <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 p-1.5 rounded-lg">
                    <FileText className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {dashboardData ? dashboardData.totalTasks.toLocaleString() : '---'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">cerradas</span>
                </div>
                <p className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-2 flex items-center gap-1 font-medium">
                  UM Corona <ArrowUpRight className="h-3 w-3" />
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 opacity-[0.04] group-hover:scale-110 transition-transform duration-300">
                  <Boxes className="h-28 w-28" />
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 tracking-wider uppercase">Suministros</span>
                  <span className="bg-teal-50 dark:bg-teal-500/10 text-teal-500 dark:text-teal-400 p-1.5 rounded-lg">
                    <Boxes className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {dashboardData ? dashboardData.suministros.UN.toLocaleString() : '---'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">UN</span>
                </div>
                <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-2 flex items-center gap-2 font-medium">
                  <span>{dashboardData ? dashboardData.suministros.M.toLocaleString() : '--'} m</span>
                  <span className="text-gray-300 dark:text-slate-600">·</span>
                  <span>{dashboardData ? dashboardData.suministros.LT.toLocaleString() : '--'} lt</span>
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 opacity-[0.04] group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-28 w-28" />
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 tracking-wider uppercase">Personal / Tarea</span>
                  <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 p-1.5 rounded-lg">
                    <Users className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {dashboardData ? dashboardData.avgPerson : '---'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">promedio</span>
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1 font-medium">
                  Asignación óptima <ArrowUpRight className="h-3 w-3" />
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 opacity-[0.04] group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-28 w-28" />
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 tracking-wider uppercase">Tiempo / Tarea</span>
                  <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 p-1.5 rounded-lg">
                    <Clock className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {dashboardData ? dashboardData.avgHours : '---'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">horas prom.</span>
                </div>
                <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-2 flex items-center gap-1 font-medium">
                  Esfuerzo medio (col. Tiempo) <ArrowUpRight className="h-3 w-3" />
                </p>
              </div>
            </div>

            {/* ========== MÓDULOS ANALÍTICOS (Resumen / Productividad / Inventario / Mantenimiento) ========== */}
            {(activeTab === 'dashboard' || activeTab === 'productividad' || activeTab === 'inventario' || activeTab === 'mantenimiento') && (
              <div className="space-y-6">
                {/* ===== BARRA DE FILTROS INTERACTIVOS ===== */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap gap-2.5 items-center">
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-1.5 px-1">
                    <Filter className="h-3.5 w-3.5" /> Filtros
                  </span>
                  {[
                    { key: 'subsistema', label: 'Subsistema', opts: ([['DAT', 'Datos'], ['CCTV', 'Cámaras'], ['RAD', 'Radio'], ['TEL', 'Teléfono'], ['GEO', 'Geomecánica'], ['FO', 'Fibra óptica'], ['WIFI', 'WiFi']] as [string, string][]).map(([v, n]) => ({ v, l: `${v} · ${n}` })) },
                    { key: 'tipo', label: 'Tipo', opts: [{ v: 'Incidente', l: 'Incidente' }, { v: 'Requerimiento', l: 'Requerimiento' }] },
                    { key: 'origen', label: 'Origen', opts: [{ v: 'IM', l: 'Interior Mina' }, { v: 'SUP', l: 'Superficie' }] },
                  ].map(f => (
                    <select
                      key={f.key}
                      value={(filters as any)[f.key] || ''}
                      onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value || undefined }))}
                      className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 dark:text-white outline-none cursor-pointer hover:border-gray-300 dark:hover:border-slate-600 font-medium"
                    >
                      <option value="">{f.label}: Todos</option>
                      {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ))}
                  {(filters.subsistema || filters.tipo || filters.origen) && (
                    <button onClick={() => setFilters({})} className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline px-2">Limpiar</button>
                  )}
                  <span className="ml-auto text-[11px] text-gray-400 dark:text-slate-500 font-medium px-1">
                    {dashboardData ? dashboardData.totalTasks.toLocaleString() : '--'} tareas
                  </span>
                </div>

                {dashboardData ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ===== RESUMEN ===== */}
                    {activeTab === 'dashboard' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Tendencia Mensual de Tareas</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Distribución temporal entre Incidentes y Requerimientos</p>
                        </div>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dashboardData.monthlyTrend}>
                              <defs>
                                <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                              <XAxis dataKey="month" stroke={axisStroke} fontSize={11} tickLine={false} />
                              <YAxis stroke={axisStroke} fontSize={11} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Area type="monotone" name="Incidentes" dataKey="incidentes" stroke="#f43f5e" fillOpacity={1} fill="url(#colorInc)" strokeWidth={2} />
                              <Area type="monotone" name="Requerimientos" dataKey="requerimientos" stroke="#3b82f6" fillOpacity={1} fill="url(#colorReq)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {activeTab === 'dashboard' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Tareas por Subsistema</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Por tipo de infraestructura</p>
                          <SubsistemaGlosario />
                        </div>
                        <div className="h-56 w-full flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={dashboardData.subsistemas}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={78}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {dashboardData.subsistemas.map((_: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          {dashboardData.subsistemas.slice(0, 6).map((sub: any, idx: number) => (
                            <div key={sub.name} className="p-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/30">
                              <span className="block font-bold text-gray-800 dark:text-white">{sub.value}</span>
                              <span className="text-[10px] font-medium text-gray-400 dark:text-slate-400 flex items-center justify-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                {sub.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ===== PRODUCTIVIDAD (Tiempo / Horas-Hombre) ===== */}
                    {activeTab === 'productividad' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Horas-Hombre por Causa Raíz</h3>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">HH = personas × tiempo · dónde se concentra el esfuerzo</p>
                            <HowCalc
                              que="Horas-Hombre (HH) acumuladas por causa raíz; muestra en qué tipo de problema se concentra el esfuerzo (top 8 causas)."
                              formula={'HH (tarea) = Personas × Tiempo (h)\nHH (causa) = Σ HH de las tareas de esa causa'}
                              pasos={[
                                'Para cada tarea se calcula HH = personas × tiempo.',
                                'Se agrupan las tareas por su causa raíz y se suman las HH.',
                                'Se ordenan de mayor a menor y se muestran las 8 primeras.',
                              ]}
                              leer="Las causas con más HH son las que más mano de obra consumen — candidatas a prevención o mejora de procesos."
                            />
                          </div>
                          <div className="text-right shrink-0">
                            <span className="block text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{dashboardData.totalHH?.toLocaleString()}</span>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-semibold">HH totales</span>
                          </div>
                        </div>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.hhPorCausa} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                              <XAxis type="number" stroke={axisStroke} fontSize={11} tickLine={false} />
                              <YAxis dataKey="name" type="category" stroke={axisStroke} fontSize={10} width={150} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="hh" name="Horas-Hombre" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {activeTab === 'productividad' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">HH por Nivel</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Esfuerzo por profundidad de mina</p>
                        </div>
                        <div className="space-y-2.5">
                          {dashboardData.hhPorNivel.map((n: any) => {
                            const maxN = dashboardData.hhPorNivel[0]?.hh || 1;
                            return (
                              <div key={n.name} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="font-semibold text-gray-700 dark:text-slate-200 truncate mr-2">{n.name}</span>
                                  <span className="font-bold text-gray-800 dark:text-white shrink-0">{n.hh.toLocaleString()} HH</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full" style={{ width: `${Math.max(4, (n.hh / maxN) * 100)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {activeTab === 'productividad' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-start gap-3 flex-wrap">
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              Proyección de Carga de Trabajo
                              {cargaPred && <span className="text-[9px] font-bold uppercase bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 px-1.5 py-0.5 rounded">ML</span>}
                            </h3>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                              {cargaMetric === 'hh' ? 'Horas-Hombre' : 'Nº de tareas'} por mes · histórico (sólido) y proyección {cargaPred ? 'Holt-Winters' : 'baseline'} (punteado)
                            </p>
                          </div>
                          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5 text-[11px] font-semibold shrink-0">
                            {(['hh', 'tareas'] as const).map(m => (
                              <button key={m} onClick={() => setCargaMetric(m)}
                                className={`px-2.5 py-1 rounded-md transition-colors ${cargaMetric === m ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-300 shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}>
                                {m === 'hh' ? 'HH' : 'Tareas'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cargaPred || dashboardData.cargaProyeccion}>
                              <defs>
                                <linearGradient id="colorHH" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                              <XAxis dataKey="month" stroke={axisStroke} fontSize={11} tickLine={false} />
                              <YAxis stroke={axisStroke} fontSize={11} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Area type="monotone" name="Histórico" dataKey={cargaMetric} stroke="#8b5cf6" fillOpacity={1} fill="url(#colorHH)" strokeWidth={2} connectNulls />
                              <Area type="monotone" name="Rango estimado" dataKey={cargaMetric === 'hh' ? 'hhBanda' : 'tareasBanda'} stroke="none" fill="#14b8a6" fillOpacity={0.12} connectNulls />
                              <Area type="monotone" name="Proyectado" dataKey={cargaMetric === 'hh' ? 'hhProy' : 'tareasProy'} stroke="#14b8a6" strokeDasharray="5 5" fill="none" strokeWidth={2} connectNulls />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <HowCalc
                          que={<>Serie mensual de <strong>HH</strong> (o nº de tareas): histórico (línea sólida) y proyección a futuro (punteada) con banda de incertidumbre.</>}
                          formula={'proyección: Holt-Winters (suavizado exponencial)\nbanda = proyección ± 1.28 · σ · √h'}
                          pasos={[
                            'El microservicio proyecta con Holt-Winters; si no está disponible, usa una regresión lineal baseline.',
                            'σ = desviación estándar del histórico; h = nº de meses hacia adelante.',
                            'La banda se ensancha con √h: a mayor horizonte, más incertidumbre.',
                          ]}
                          leer="La línea punteada es el valor más probable; la banda (~80%) es el rango esperado. Úsala para anticipar picos y dimensionar cuadrillas."
                          nota="Rango orientativo, no un intervalo de confianza exacto."
                        />
                      </div>
                    )}
                    {activeTab === 'productividad' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Materiales por Actividad</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Cada actividad = bloque de filas (cabecera + sus materiales)</p>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                              <span className="block text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">{dashboardData.materialesResumen.actividades.toLocaleString()}</span>
                              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">Actividades</span>
                            </div>
                            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20">
                              <span className="block text-2xl font-extrabold text-teal-700 dark:text-teal-300">{dashboardData.materialesResumen.lineasMaterial.toLocaleString()}</span>
                              <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 uppercase">Líneas de material</span>
                            </div>
                          </div>
                          <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Prom. materiales / actividad</span>
                            <span className="text-lg font-extrabold text-gray-800 dark:text-white">{dashboardData.materialesResumen.promPorActividad}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Actividades con material</span>
                              <span className="text-xs font-bold text-gray-800 dark:text-white">{dashboardData.materialesResumen.pctConMaterial}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full" style={{ width: `${dashboardData.materialesResumen.pctConMaterial}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ===== INVENTARIO (Suministros / Mermas) ===== */}
                    {activeTab === 'inventario' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Top 8 Insumos Consumidos</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Suministros con mayor demanda acumulada</p>
                        </div>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.topInsumos} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                              <XAxis type="number" stroke={axisStroke} fontSize={11} tickLine={false} />
                              <YAxis dataKey="name" type="category" stroke={axisStroke} fontSize={10} width={130} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Bar dataKey="value" name="Consumo Total" fill="#2dd4bf" radius={[0, 6, 6, 0]}>
                                {dashboardData.topInsumos.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={entry.name.includes('Cintillos') ? '#8b5cf6' : '#2dd4bf'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    {activeTab === 'inventario' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Mermas · Consumo por HH</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Intensidad de consumo, no total bruto</p>
                          <HowCalc
                            que="Intensidad de consumo de cada insumo: cuánto material se gasta por unidad de esfuerzo (no el total bruto)."
                            formula="Intensidad = Cantidad consumida ⁄ HH"
                            pasos={[
                              'Por insumo se suma la cantidad consumida y las HH de las tareas donde se usó.',
                              'Se divide cantidad ⁄ HH para obtener el consumo por hora-hombre.',
                              'Se incluyen solo insumos con ≥ 10 HH acumulado (para evitar ruido).',
                            ]}
                            leer="Una intensidad alta indica mucho material por hora trabajada: posible uso anormal, desperdicio o merma a revisar."
                          />
                        </div>
                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                          {dashboardData.mermas.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8">Sin datos suficientes.</p>
                          ) : dashboardData.mermas.map((m: any) => (
                            <div key={m.name} className="flex justify-between items-center p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 text-xs">
                              <span className="font-semibold text-gray-700 dark:text-slate-200 truncate mr-2">{m.name}</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-500/15 shrink-0">{m.porHH} /HH</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === 'inventario' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-3 space-y-4">
                        <div className="flex justify-between items-start gap-3 flex-wrap">
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              Predicción de Demanda de Insumos
                              <span className="text-[9px] font-bold uppercase bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 px-1.5 py-0.5 rounded">ML</span>
                            </h3>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Consumo histórico y proyección (Holt-Winters) · vía microservicio FastAPI</p>
                          </div>
                          <select value={selectedInsumo} onChange={e => setSelectedInsumo(e.target.value)}
                            className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-white outline-none cursor-pointer hover:border-gray-300 dark:hover:border-slate-600 font-medium max-w-[240px]">
                            {(dashboardData.insumoNames || []).slice(0, 50).map((n: string) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div className="h-72 w-full">
                          {insumoPredLoading ? (
                            <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm gap-2"><Activity className="h-5 w-5 animate-spin text-teal-500" /> Calculando predicción...</div>
                          ) : (insumoPred && insumoPred.length > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={insumoPred}>
                                <defs>
                                  <linearGradient id="colorIns" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.25}/>
                                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                <XAxis dataKey="fecha" stroke={axisStroke} fontSize={11} tickLine={false} />
                                <YAxis stroke={axisStroke} fontSize={11} tickLine={false} />
                                <Tooltip contentStyle={tooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Area type="monotone" name="Consumo histórico" dataKey="cantidad" stroke="#2dd4bf" fillOpacity={1} fill="url(#colorIns)" strokeWidth={2} connectNulls />
                                <Area type="monotone" name="Rango estimado" dataKey="banda" stroke="none" fill="#f59e0b" fillOpacity={0.12} connectNulls />
                                <Area type="monotone" name="Proyección" dataKey="cantidadProy" stroke="#f59e0b" strokeDasharray="5 5" fill="none" strokeWidth={2} connectNulls />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm text-center px-6">
                              Sin histórico suficiente para <strong className="mx-1">{selectedInsumo}</strong> (o microservicio no disponible).
                            </div>
                          )}
                        </div>
                        <HowCalc
                          que="Consumo mensual histórico del insumo seleccionado y su proyección a futuro con banda de incertidumbre."
                          formula={'proyección: Holt-Winters (suavizado exponencial)\nbanda = proyección ± 1.28 · σ · √h'}
                          pasos={[
                            'El microservicio proyecta el consumo del insumo elegido con Holt-Winters.',
                            'σ = desviación estándar del histórico; h = nº de meses hacia adelante.',
                            'La banda se ensancha con √h (más incertidumbre a mayor horizonte).',
                          ]}
                          leer="Toma el borde superior de la banda como referencia para definir el stock de seguridad y evitar quiebres."
                        />
                      </div>
                    )}

                    {/* ===== MANTENIMIENTO (Zonas calientes / Causa→Detalle) ===== */}
                    {activeTab === 'mantenimiento' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Causa Raíz → Detalle</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Jerarquía de análisis: del motivo general al detalle específico</p>
                        </div>
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                          {dashboardData.causaDetalle.map((c: any) => {
                            const maxDet = c.detalles[0]?.value || 1;
                            return (
                              <div key={c.name} className="rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 p-3 space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-xs font-bold text-gray-800 dark:text-white">{c.name}</span>
                                  <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 shrink-0">{c.total} tareas · {c.hh.toLocaleString()} HH</span>
                                </div>
                                <div className="space-y-1 pl-2 border-l-2 border-teal-200 dark:border-teal-500/30">
                                  {c.detalles.map((d: any) => (
                                    <div key={d.name} className="flex items-center gap-2">
                                      <span className="text-[11px] text-gray-600 dark:text-slate-300 truncate flex-1">{d.name}</span>
                                      <div className="h-1.5 w-20 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.max(6, (d.value / maxDet) * 100)}%` }} />
                                      </div>
                                      <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 w-6 text-right shrink-0">{d.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {activeTab === 'mantenimiento' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Zonas Calientes</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Mayor índice de intervenciones</p>
                        </div>
                        <div className="space-y-2.5">
                          {dashboardData.topLocations.map((loc: any, index: number) => (
                            <div key={loc.name} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-[10px] font-bold bg-white dark:bg-slate-900 text-gray-400 dark:text-slate-500 h-6 w-6 rounded-md flex items-center justify-center border border-gray-200 dark:border-slate-700 shrink-0">
                                  {index + 1}
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold text-gray-800 dark:text-white truncate">{loc.name}</span>
                                  <span className="text-[10px] text-gray-400 dark:text-slate-500">UM Corona</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 shrink-0 ml-2">
                                {loc.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {activeTab === 'mantenimiento' && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" /> Riesgo de Falla por Zona
                            <span className="text-[9px] font-bold uppercase bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 px-1.5 py-0.5 rounded">ML</span>
                          </h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Prioridad de mantenimiento preventivo (incidentes por nivel/zona) · vía microservicio</p>
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {(!riesgoZonas || riesgoZonas.length === 0) ? (
                            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8">Sin datos del microservicio (¿está activo?).</p>
                          ) : riesgoZonas.slice(0, 12).map((z: any, i: number) => {
                            const st = z.nivel_riesgo === 'Crítico'
                              ? { bar: 'bg-rose-500', badge: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' }
                              : z.nivel_riesgo === 'Alto'
                              ? { bar: 'bg-amber-500', badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' }
                              : z.nivel_riesgo === 'Medio'
                              ? { bar: 'bg-yellow-500', badge: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20' }
                              : { bar: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' };
                            return (
                              <div key={`${z.nivel}-${z.zona}-${i}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 w-5 text-right shrink-0">{i + 1}</span>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-xs font-semibold text-gray-800 dark:text-white truncate">{z.nivel} · {z.zona}</span>
                                  <span className="text-[10px] text-gray-400 dark:text-slate-500">{z.total_fallas} fallas · {z.fallas_recientes} recientes</span>
                                </div>
                                <div className="h-1.5 w-24 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                                  <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${Math.max(4, z.risk_score)}%` }} />
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 w-16 text-center border ${st.badge}`}>{z.nivel_riesgo}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {activeTab === 'mantenimiento' && dashboardData.sla && (
                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-teal-500" /> Cumplimiento ANS
                          </h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">% de tareas dentro del objetivo de horas (col. Tiempo)</p>
                          <HowCalc
                            que="Porcentaje de tareas atendidas dentro del objetivo de horas (nivel de servicio)."
                            formula="Cumplimiento = (tareas con Tiempo ≤ objetivo ⁄ total con tiempo) × 100"
                            pasos={[
                              'Objetivos por tipo: Incidente ≤ 3 h, Requerimiento ≤ 4 h.',
                              'Se cuentan las tareas (con tiempo registrado) cuyo Tiempo ≤ su objetivo.',
                              'Se divide entre el total de tareas con tiempo y se multiplica por 100.',
                            ]}
                            leer="Mayor porcentaje = mejor cumplimiento del nivel de servicio acordado."
                            nota="Usa la columna Tiempo como esfuerzo de resolución (no fechas de inicio/fin)."
                          />
                        </div>
                        <div className="text-center py-1">
                          <span className="text-4xl font-extrabold text-teal-600 dark:text-teal-400">{dashboardData.sla.pct}%</span>
                          <span className="block text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{dashboardData.sla.cumple.toLocaleString()} / {dashboardData.sla.total.toLocaleString()} tareas</span>
                        </div>
                        <div className="space-y-2.5">
                          {dashboardData.sla.porTipo.map((s: any) => (
                            <div key={s.tipo} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold text-gray-700 dark:text-slate-200">{s.tipo} <span className="text-gray-400 dark:text-slate-500 font-normal">(≤{s.objetivo}h)</span></span>
                                <span className="font-bold text-gray-800 dark:text-white">{s.pct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full" style={{ width: `${s.pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="h-96 flex items-center justify-center bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl">
                    <div className="flex flex-col items-center gap-3">
                      <Activity className="h-8 w-8 text-teal-500 animate-spin" />
                      <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Procesando datos...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========== ESTADÍSTICAS TAB ========== */}
            {activeTab === 'estadisticas' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Dispersión */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dispersión · Personas vs. Tiempo</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      Cada punto = una tarea (tamaño ∝ HH). Correlación de Pearson r = <strong>{dashboardData.corrPersonasTiempo ?? 0}</strong>. Útil para detectar tareas atípicas (mucho esfuerzo).
                    </p>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 24, bottom: 24, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis type="number" dataKey="personas" name="Personas" stroke={axisStroke} fontSize={11} tickLine={false}
                          label={{ value: 'Personas', position: 'insideBottom', offset: -10, fontSize: 11, fill: axisStroke }} />
                        <YAxis type="number" dataKey="tiempo" name="Tiempo (h)" stroke={axisStroke} fontSize={11} tickLine={false}
                          label={{ value: 'Tiempo (h)', angle: -90, position: 'insideLeft', fontSize: 11, fill: axisStroke }} />
                        <ZAxis type="number" dataKey="hh" range={[20, 240]} name="HH" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Scatter name="Incidente" data={(dashboardData.dispersion || []).filter((d: any) => d.tipo === 'Incidente')} fill="#f43f5e" fillOpacity={0.45} />
                        <Scatter name="Requerimiento" data={(dashboardData.dispersion || []).filter((d: any) => d.tipo === 'Requerimiento')} fill="#3b82f6" fillOpacity={0.45} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <HowCalc
                    que={<>Cada punto es una tarea: eje X = nº de <strong>personas</strong>, eje Y = <strong>tiempo</strong> (h), y el tamaño del punto ∝ <strong>HH</strong>. El color distingue Incidente y Requerimiento.</>}
                    formula={'HH = Personas × Tiempo\nr (Pearson) = Σ(xᵢ−x̄)(yᵢ−ȳ) ⁄ √(Σ(xᵢ−x̄)²·Σ(yᵢ−ȳ)²)'}
                    pasos={[
                      'Se toman las tareas con personas y tiempo mayores que 0.',
                      'Cada tarea se ubica por (personas, tiempo) y se dimensiona por HH.',
                      'Se calcula el coeficiente de correlación de Pearson (r) entre personas y tiempo.',
                    ]}
                    leer={<><strong>r</strong> va de −1 a 1: ≈0 sin relación lineal; &gt;0 a más personas más tiempo; &lt;0 lo contrario. Los puntos alejados de la nube son tareas atípicas (mucho esfuerzo).</>}
                    nota="Se grafican hasta 2.000 tareas."
                  />
                </div>

                {/* Boxplot Tiempo por Subsistema */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Distribución de Tiempo (h) por Subsistema</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Caja = Q1–Q3 · línea = mediana · rombo = media · puntos = atípicos</p>
                    <SubsistemaGlosario />
                  </div>
                  <BoxPlot data={dashboardData.boxTiempoSub || []} unit="horas" color="#2dd4bf" dark={theme === 'dark'} height={300} />
                  <HowCalc
                    que="Distribución del tiempo (horas) de las tareas, una caja por subsistema."
                    formula={'IQR = Q3 − Q1\nbigotes = [ Q1 − 1.5·IQR ,  Q3 + 1.5·IQR ]'}
                    pasos={[
                      'Se ordenan los tiempos de cada subsistema.',
                      'Se obtienen Q1 (25%), mediana (50%) y Q3 (75%) por interpolación.',
                      'La caja va de Q1 a Q3; la línea es la mediana y el rombo la media.',
                      'Los bigotes llegan al dato más extremo dentro de 1.5·IQR; lo de afuera son atípicos.',
                    ]}
                    leer="La altura de la caja indica variabilidad; compara las medianas entre subsistemas. Muchos atípicos arriba = tareas que se disparan en tiempo."
                    nota="Solo subsistemas con ≥ 5 tareas."
                  />
                </div>

                {/* Boxplot HH por Tipo */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Distribución de HH por Tipo</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Incidente vs. Requerimiento — compara el esfuerzo (Horas-Hombre)</p>
                  </div>
                  <BoxPlot data={dashboardData.boxHHTipo || []} unit="HH" color="#8b5cf6" dark={theme === 'dark'} height={300} />
                  <HowCalc
                    que="Distribución de Horas-Hombre (HH) comparando Incidente vs Requerimiento."
                    formula={'HH = Personas × Tiempo\nIQR = Q3 − Q1'}
                    pasos={[
                      'Se agrupan las tareas por tipo (Incidente / Requerimiento).',
                      'En cada grupo se calculan los cuartiles de HH (Q1, mediana, Q3) y la media.',
                      'Caja = Q1–Q3, bigotes = 1.5·IQR, puntos = atípicos.',
                    ]}
                    leer="Compara la mediana (esfuerzo típico) y la dispersión entre ambos tipos: cajas más altas = más variabilidad."
                  />
                </div>

                {/* Histograma de Tiempo */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Histograma · Tiempo (h) por tarea</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Frecuencia de tareas por rango de horas — muestra la forma de la distribución</p>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.histTiempo || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="rango" stroke={axisStroke} fontSize={10} tickLine={false} interval={0} angle={-35} textAnchor="end" height={54} />
                        <YAxis stroke={axisStroke} fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" name="Tareas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <HowCalc
                    que="Frecuencia de tareas según su duración (horas)."
                    formula={'ancho_bin = (máx − mín) ⁄ 12\nbin(t) = ⌊ (t − mín) ⁄ ancho_bin ⌋'}
                    pasos={[
                      'Se toma el rango de tiempos (mínimo a máximo).',
                      'Se divide en 12 intervalos iguales (bins).',
                      'Cada barra cuenta cuántas tareas caen en ese intervalo.',
                    ]}
                    leer="La forma muestra si las duraciones se concentran en un pico o tienen cola larga (pocas tareas muy largas)."
                  />
                </div>

                {/* Pareto de causas */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pareto · Causa Raíz (80/20)</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Pocas causas explican la mayoría de las tareas — prioriza dónde atacar</p>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dashboardData.paretoCausas || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="name" stroke={axisStroke} fontSize={9} tickLine={false} interval={0} angle={-30} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" stroke={axisStroke} fontSize={11} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" stroke={axisStroke} fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar yAxisId="left" dataKey="count" name="Tareas" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="acumulado" name="% acumulado" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <HowCalc
                    que="Causas ordenadas por nº de tareas (barras) junto con el porcentaje acumulado (línea)."
                    formula="% acumulado (causa k) = (Σ tareas de las causas 1..k ⁄ total) × 100"
                    pasos={[
                      'Se cuentan las tareas por causa raíz y se ordenan de mayor a menor.',
                      'Se muestran las 10 primeras; el resto se agrupa en “Otros”.',
                      'La línea acumula el porcentaje hasta llegar a 100%.',
                    ]}
                    leer="Principio 80/20: donde la línea sube rápido están las pocas causas que explican la mayoría de las tareas — prioriza esas."
                  />
                </div>

                {/* Mapa de calor Nivel x Subsistema */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Mapa de calor · Nivel × Subsistema</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Dónde y en qué tecnología se concentran las intervenciones</p>
                    <SubsistemaGlosario />
                  </div>
                  <Heatmap rows={dashboardData.heatNivelSub?.rows || []} cols={dashboardData.heatNivelSub?.cols || []} matrix={dashboardData.heatNivelSub?.matrix || []} max={dashboardData.heatNivelSub?.max || 1} dark={theme === 'dark'} />
                  <HowCalc
                    que="Matriz de conteo de tareas por Nivel (filas) × Subsistema (columnas)."
                    formula="intensidad_color = valor_celda ⁄ valor_máximo_de_la_matriz"
                    pasos={[
                      'Se cuentan las tareas para cada combinación Nivel × Subsistema.',
                      'Se eligen los 10 niveles con más actividad.',
                      'El color de cada celda es proporcional a su valor (más oscuro = más tareas).',
                    ]}
                    leer="Las celdas más oscuras señalan dónde y en qué tecnología se concentran las intervenciones (puntos calientes)."
                  />
                </div>

                {/* % Incidentes vs Requerimientos por mes */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">% Incidentes vs Requerimientos por mes</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">¿El equipo apaga incendios (correctivo) o mejora (evolutivo)?</p>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboardData.monthlyTrend || []} stackOffset="expand">
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="month" stroke={axisStroke} fontSize={11} tickLine={false} />
                        <YAxis stroke={axisStroke} fontSize={11} tickLine={false} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Area type="monotone" dataKey="incidentes" name="Incidentes" stackId="1" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.5} />
                        <Area type="monotone" dataKey="requerimientos" name="Requerimientos" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <HowCalc
                    que="Proporción mensual de Incidentes vs Requerimientos (área 100% apilada)."
                    formula="% tipo (mes) = (tareas del tipo ⁄ total del mes) × 100"
                    pasos={[
                      'Por mes se cuentan los Incidentes y los Requerimientos.',
                      'Cada banda se normaliza a 100% del total de ese mes.',
                    ]}
                    leer={<>Más incidentes = trabajo <strong>correctivo</strong> (reactivo); más requerimientos = trabajo <strong>evolutivo</strong> (mejoras/instalaciones). Tendencia creciente de incidentes = se está “apagando incendios”.</>}
                  />
                </div>

                {/* Radar por subsistema */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Radar · Subsistema (Tareas vs HH)</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Dónde el esfuerzo no acompaña al nº de tareas</p>
                    <SubsistemaGlosario />
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={dashboardData.radarSub || []} outerRadius="72%">
                        <PolarGrid stroke={gridStroke} />
                        <PolarAngleAxis dataKey="sub" tick={{ fontSize: 11, fill: axisStroke }} />
                        <PolarRadiusAxis domain={[0, 100]} angle={90} tick={{ fontSize: 9, fill: axisStroke }} />
                        <Radar name="% Tareas" dataKey="tareasPct" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.3} />
                        <Radar name="% HH" dataKey="hhPct" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <HowCalc
                    que="Comparación por subsistema de su % de tareas y su % de HH (cada eje es un subsistema)."
                    formula={'%Tareas = tareas_sub ⁄ máx(tareas) × 100\n%HH = HH_sub ⁄ máx(HH) × 100'}
                    pasos={[
                      'Por subsistema se suman las tareas y las HH.',
                      'Cada métrica se normaliza a su propio máximo (escala 0–100) para compararlas en los mismos ejes.',
                    ]}
                    leer="Si la banda de HH (ámbar) sobresale de la de tareas (verde) en un subsistema, ese consume más esfuerzo por tarea de lo normal."
                  />
                </div>

                {/* Dispersión HH vs nº de insumos */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dispersión · HH vs nº de insumos</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Identifica actividades intensivas en material</p>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 24, bottom: 24, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis type="number" dataKey="nInsumos" name="N.º insumos" stroke={axisStroke} fontSize={11} tickLine={false}
                          label={{ value: 'N.º de insumos', position: 'insideBottom', offset: -10, fontSize: 11, fill: axisStroke }} />
                        <YAxis type="number" dataKey="hh" name="HH" stroke={axisStroke} fontSize={11} tickLine={false}
                          label={{ value: 'HH', angle: -90, position: 'insideLeft', fontSize: 11, fill: axisStroke }} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Scatter name="Incidente" data={(dashboardData.dispersionInsumos || []).filter((d: any) => d.tipo === 'Incidente')} fill="#f43f5e" fillOpacity={0.45} />
                        <Scatter name="Requerimiento" data={(dashboardData.dispersionInsumos || []).filter((d: any) => d.tipo === 'Requerimiento')} fill="#3b82f6" fillOpacity={0.45} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <HowCalc
                    que={<>Cada punto es una actividad: eje X = <strong>nº de insumos</strong> (líneas de material), eje Y = <strong>HH</strong>.</>}
                    formula="HH = Personas × Tiempo"
                    pasos={[
                      'Se toman las actividades con al menos un insumo y HH > 0.',
                      'Cada actividad se ubica por (nº de insumos, HH) y se colorea por tipo.',
                    ]}
                    leer="Los puntos arriba-derecha combinan mucho material y mucho esfuerzo — candidatas a estandarizar o revisar."
                  />
                </div>
              </div>
            )}

            {/* ========== INGESTA TAB ========== */}
            {activeTab === 'ingesta' && (
              <div className="space-y-6">
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 flex gap-3 items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Sube el Excel del mes (mismo formato que el histórico). Se <strong>valida antes de insertar</strong>: puedes excluir filas con problemas. La inserción es <strong>idempotente</strong> (re-subir el mismo archivo no duplica).
                  </p>
                </div>

                <div
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleIngestFile(f); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${dragOver ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10' : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900/80'}`}
                >
                  <UploadCloud className="h-10 w-10 mx-auto text-teal-500 mb-3" />
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">Arrastra el Excel del mes aquí</p>
                  <label className="inline-block mt-3 cursor-pointer text-xs font-semibold text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30 rounded-lg px-3 py-1.5 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors">
                    o seleccionar archivo
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIngestFile(f); }} />
                  </label>
                  {ingestFileName && <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-3">Archivo: <strong className="text-gray-700 dark:text-slate-200">{ingestFileName}</strong></p>}
                </div>

                {ingestLoading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400 py-4">
                    <Activity className="h-5 w-5 animate-spin text-teal-500" /> Procesando…
                  </div>
                )}

                {ingestResult && !ingestResult.ok && (
                  <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300">
                    {ingestResult.error}
                  </div>
                )}

                {ingestResult && ingestResult.ok && (
                  <>
                    {ingestResult.columns && !ingestResult.columns.ok && (
                      <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-3 text-xs text-rose-700 dark:text-rose-300">
                        Faltan columnas esperadas: <strong>{ingestResult.columns.faltan.join(', ')}</strong>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Total', value: ingestResult.summary?.total ?? 0, cls: 'text-gray-800 dark:text-white' },
                        { label: 'OK', value: ingestResult.summary?.ok ?? 0, cls: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Advertencias', value: ingestResult.summary?.warn ?? 0, cls: 'text-amber-600 dark:text-amber-400' },
                        { label: 'Con error', value: ingestResult.summary?.err ?? 0, cls: 'text-rose-600 dark:text-rose-400' },
                      ].map((s) => (
                        <div key={s.label} className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                          <span className={`block text-2xl font-extrabold ${s.cls}`}>{s.value}</span>
                          <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase">{s.label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto max-h-[520px]">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 sticky top-0">
                              <th className="p-3 w-10"></th>
                              <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase">Fecha</th>
                              <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase">Ubicación</th>
                              <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase">Causa</th>
                              <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase text-center">P/H</th>
                              <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase text-center">Ins.</th>
                              <th className="p-3 font-semibold text-gray-500 dark:text-slate-400 uppercase">Validación</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                            {ingestResult.activities.map((a: any, idx: number) => (
                              <tr key={idx} className={a.include ? '' : 'opacity-40'}>
                                <td className="p-3"><input type="checkbox" checked={!!a.include} onChange={() => toggleInclude(idx)} className="accent-teal-500" /></td>
                                <td className="p-3 text-gray-700 dark:text-slate-300 whitespace-nowrap">{a.fecha_inicio || '—'}</td>
                                <td className="p-3 text-gray-700 dark:text-slate-300">{a.nivel} · {a.zona}</td>
                                <td className="p-3 font-medium text-gray-800 dark:text-white">{a.causa_raiz}</td>
                                <td className="p-3 text-center text-gray-500 dark:text-slate-400 whitespace-nowrap">{a.cant_personas}p · {a.tiempo_horas}h</td>
                                <td className="p-3 text-center text-gray-500 dark:text-slate-400">{(a.insumos || []).length}</td>
                                <td className="p-3">
                                  {(!a.issues || a.issues.length === 0) ? (
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">OK</span>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {a.issues.map((iss: any, j: number) => (
                                        <div key={j} className="flex items-center gap-1.5 flex-wrap">
                                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${iss.level === 'error' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>{iss.msg}</span>
                                          {iss.suggestion && iss.field === 'causa_raiz' && (
                                            <button onClick={() => applyCausaSuggestion(idx, iss.suggestion)} className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 underline">usar “{iss.suggestion}”</button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        <strong className="text-gray-800 dark:text-white">{ingestResult.activities.filter((a: any) => a.include).length}</strong> actividades marcadas para insertar
                      </span>
                      <button
                        onClick={doCommit}
                        disabled={ingestLoading || ingestResult.activities.filter((a: any) => a.include).length === 0}
                        className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
                      >
                        Insertar data
                      </button>
                    </div>

                    {ingestCommit && (
                      ingestCommit.ok ? (
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4 text-sm text-emerald-700 dark:text-emerald-300">
                          ✓ Insertadas: <strong>{ingestCommit.inserted}</strong> · Omitidas/duplicadas: <strong>{ingestCommit.skipped}</strong>
                        </div>
                      ) : (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300">
                          {ingestCommit.error}
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            )}

            {/* ========== TASKS TAB ========== */}
            {activeTab === 'tasks' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

                <div className="xl:col-span-2 space-y-4">

                  {/* Filters */}
                  <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center">
                    <div className="relative w-full">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar por ticket, detalle o ubicación..."
                        value={search}
                        onChange={handleSearchChange}
                        className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500 transition-all"
                      />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                      <select
                        value={typeFilter}
                        onChange={(e) => handleTypeFilter(e.target.value)}
                        className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-gray-700 dark:text-white outline-none cursor-pointer hover:border-gray-300 dark:hover:border-slate-600 transition-colors font-medium"
                      >
                        <option value="">Todos los Tipos</option>
                        <option value="Incidente">Incidentes</option>
                        <option value="Requerimiento">Requerimientos</option>
                      </select>
                      <select
                        value={originFilter}
                        onChange={(e) => handleOriginFilter(e.target.value)}
                        className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-gray-700 dark:text-white outline-none cursor-pointer hover:border-gray-300 dark:hover:border-slate-600 transition-colors font-medium"
                      >
                        <option value="">Todos los Orígenes</option>
                        <option value="IM">Interior Mina</option>
                        <option value="SUP">Superficie</option>
                      </select>
                    </div>
                  </div>

                  {/* Tasks Table */}
                  <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                    <div className="overflow-x-auto max-h-[600px]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 sticky top-0 z-10">
                            <th className="p-4 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ticket</th>
                            <th className="p-4 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tipo/Origen</th>
                            <th className="p-4 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ubicación</th>
                            <th className="p-4 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Causa Raíz</th>
                            <th className="p-4 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-center">Insumos</th>
                            <th className="p-4 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                          {isPending ? (
                            <tr>
                              <td colSpan={6} className="p-16 text-center text-gray-400 dark:text-slate-500 text-sm">
                                <div className="flex flex-col items-center gap-2">
                                  <Activity className="h-6 w-6 text-teal-500 animate-spin" />
                                  Cargando registros...
                                </div>
                              </td>
                            </tr>
                          ) : tasks.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-16 text-center text-gray-400 dark:text-slate-500 text-sm">
                                No se encontraron tareas coincidentes.
                              </td>
                            </tr>
                          ) : (
                            tasks.map((task) => (
                              <tr
                                key={task.id}
                                onClick={() => setSelectedTask(task)}
                                className={`cursor-pointer transition-colors ${
                                  selectedTask?.id === task.id
                                    ? 'bg-teal-50 dark:bg-teal-500/5'
                                    : 'hover:bg-gray-50 dark:hover:bg-slate-800/30'
                                }`}
                              >
                                <td className="p-4 font-mono text-xs font-semibold text-gray-800 dark:text-white">
                                  {task.ticket || 'S/N'}
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col gap-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-max border ${
                                      task.tipo === 'Incidente'
                                        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                                        : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                                    }`}>
                                      {task.tipo}
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                                      <Layers className="h-3 w-3" />
                                      {task.origen === 'IM' ? 'Interior Mina' : 'Superficie'}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col max-w-[200px]">
                                    <span className="text-xs font-semibold text-gray-800 dark:text-white truncate">
                                      {task.ubicacion.zona}
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {task.ubicacion.nivel} {task.ubicacion.punto ? `· ${task.ubicacion.punto}` : ''}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                                      {task.causa_raiz}
                                    </span>
                                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold uppercase">
                                      {inferSubsystem(task.causa_raiz)}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                    task.insumos.length > 0
                                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                      : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700'
                                  }`}>
                                    {task.insumos.length}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <button className="text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="border-t border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/20">
                      <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                        Mostrando <strong className="text-gray-800 dark:text-white">{(currentPage - 1) * 20 + 1}-{Math.min(currentPage * 20, totalTasks)}</strong> de <strong className="text-gray-800 dark:text-white">{totalTasks.toLocaleString()}</strong>
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handlePrevPage}
                          disabled={currentPage === 1 || isPending}
                          className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 p-2 rounded-xl hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center min-w-[48px]">
                          {currentPage}/{totalPages}
                        </span>
                        <button
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages || isPending}
                          className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 p-2 rounded-xl hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detail Panel */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm dark:shadow-none sticky top-24">
                  {selectedTask ? (
                    <>
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold tracking-wider">Orden de Trabajo</span>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{selectedTask.ticket || 'Ticket S/N'}</h3>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            selectedTask.tipo === 'Incidente'
                              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                              : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                          }`}>
                            {selectedTask.tipo}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs border-y border-gray-100 dark:border-slate-800 py-4">
                          <div>
                            <span className="block text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Fecha Inicio</span>
                            <span className="font-medium text-gray-700 dark:text-slate-200 mt-0.5 block">
                              {selectedTask.fecha_inicio ? new Date(selectedTask.fecha_inicio).toLocaleDateString() : 'No indicada'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Fecha Cierre</span>
                            <span className="font-medium text-gray-700 dark:text-slate-200 mt-0.5 block">
                              {selectedTask.fecha_fin ? new Date(selectedTask.fecha_fin).toLocaleDateString() : 'En proceso'}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="block text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Personal</span>
                            <span className="font-semibold text-gray-800 dark:text-white flex items-center gap-1.5 mt-0.5">
                              <Users className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                              {selectedTask.cant_personas} Personas
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="block text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Horas</span>
                            <span className="font-semibold text-gray-800 dark:text-white flex items-center gap-1.5 mt-0.5">
                              <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                              {selectedTask.tiempo_horas} Horas
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Location */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Ubicación</span>
                        <div className="p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/50 rounded-xl space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400 dark:text-slate-400">Nivel:</span>
                            <span className="font-bold text-gray-800 dark:text-white">{selectedTask.ubicacion.nivel}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400 dark:text-slate-400">Zona:</span>
                            <span className="font-bold text-gray-800 dark:text-white">{selectedTask.ubicacion.zona}</span>
                          </div>
                          {selectedTask.ubicacion.punto && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400 dark:text-slate-400">Punto:</span>
                              <span className="font-bold text-teal-600 dark:text-teal-400">{selectedTask.ubicacion.punto}</span>
                            </div>
                          )}
                          <div className="border-t border-gray-100 dark:border-slate-700/50 pt-2 mt-2">
                            <span className="block text-[9px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Cadena Excel</span>
                            <span className="text-[10px] text-gray-500 dark:text-slate-400 block break-words mt-0.5">{selectedTask.ubicacion.texto_original}</span>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-3">
                        {selectedTask.detalle && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Detalle</span>
                            <p className="text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/40 p-3 rounded-xl border border-gray-100 dark:border-slate-700/30 leading-relaxed max-h-32 overflow-y-auto">
                              {selectedTask.detalle}
                            </p>
                          </div>
                        )}
                        {selectedTask.trabajo_realizado && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Trabajo Realizado</span>
                            <p className="text-xs text-teal-700 dark:text-teal-200/90 bg-teal-50 dark:bg-teal-950/20 p-3 rounded-xl border border-teal-100 dark:border-teal-500/10 leading-relaxed max-h-32 overflow-y-auto">
                              {selectedTask.trabajo_realizado}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Supplies */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Insumos Consumidos</span>
                        {selectedTask.insumos.length === 0 ? (
                          <div className="p-3 bg-gray-50 dark:bg-slate-800/30 border border-gray-100 dark:border-slate-800 rounded-xl text-center text-xs text-gray-400 dark:text-slate-500">
                            Sin suministros registrados.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {selectedTask.insumos.map((ins: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 transition-colors text-xs">
                                <span className="font-semibold text-gray-700 dark:text-slate-200">{ins.name}</span>
                                <span className="font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-500/15">
                                  {ins.cantidad} {ins.unidad}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-80 flex flex-col justify-center items-center text-center p-6 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                        <HelpCircle className="h-6 w-6 text-gray-400 dark:text-slate-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">Detalle de Operación</h4>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                          Selecciona una tarea de la tabla para ver su detalle completo.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
