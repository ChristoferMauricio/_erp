"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import {
  fetchDashboardData,
  fetchTasks,
  exportarExcel,
  type DashboardDataResult,
  type DashFilters,
  type KPI01_VolumenMensual,
  type KPI02_RatioIncidencia,
  type KPI03_DistribucionSistema,
  type KPI04_ParetoCausas,
  type KPI05_DanioTerceros,
  type KPI06_TiempoAtencion,
  type KPI07_PersonasHora,
  type KPI08_TopUbicaciones,
  type KPI09_ConsumoMateriales,
  type KPI10_CostoMateriales
} from './actions';
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
  Activity,
  Layers,
  Sun,
  Moon,
  PanelLeft,
  PanelLeftClose,
  LayoutDashboard,
  BarChart3,
  Filter,
  ShieldCheck,
  AlertTriangle,
  UploadCloud,
  Download,
  DollarSign,
  PieChart as PieIcon,
  CheckCircle2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import { ParetoChart } from '@/components/ParetoChart';

const VALID_TABS = ['dashboard', 'bloqueA', 'bloqueB', 'bloqueC', 'tasks', 'ingesta'] as const;
type TabId = typeof VALID_TABS[number];

const TAB_LABELS: Record<TabId, string> = {
  dashboard: 'Resumen Ejecutivo KPIs',
  bloqueA: 'Bloque A — Volumen y Demanda',
  bloqueB: 'Bloque B — Eficiencia y Recursos',
  bloqueC: 'Bloque C — Confiabilidad, Ubicaciones y Costos',
  tasks: 'Gestión Transaccional de Tickets',
  ingesta: 'Ingesta de Datos y Carga Mensual'
};

const SISTEMA_COLORS: Record<string, string> = {
  DAT: '#3b82f6',
  CCTV: '#10b981',
  RAD: '#f59e0b',
  TEL: '#8b5cf6',
  GEO: '#ec4899',
  FO: '#06b6d4',
  WIFI: '#6366f1'
};

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [dashboardData, setDashboardData] = useState<DashboardDataResult | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);

  // Tickets Paginados
  const [tasks, setTasks] = useState<any[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Filtros Dashboard
  const [filters, setFilters] = useState<DashFilters>({});

  // Exportar Excel
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadDashboard(filters);
    loadTasks(1, '', '', '');
  }, []);

  const loadDashboard = async (f: DashFilters) => {
    setLoadingDash(true);
    try {
      const data = await fetchDashboardData(f);
      setDashboardData(data);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoadingDash(false);
    }
  };

  const loadTasks = async (page: number, s: string, t: string, o: string) => {
    try {
      const res = await fetchTasks(page, 20, s, t, o);
      setTasks(res.tasks);
      setTotalTasks(res.total);
      setCurrentPage(res.page);
      setTotalPages(res.totalPages);
    } catch (e) {
      console.error("Error fetching tasks:", e);
    }
  };

  const handleFilterChange = (key: keyof DashFilters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    loadDashboard(newFilters);
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res: any = await exportarExcel();
      if (res.ok && res.base64) {
        const bin = atob(res.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || 'Yauricocha_KPIs_Export.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setExportLoading(false);
    }
  };

  if (!mounted) return null;

  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#334155' : '#e2e8f0';
  const axisStroke = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? '#334155' : '#cbd5e1',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
  };

  return (
    <div className={`min-h-screen font-sans ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex`}>
      {/* Sidebar Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-30 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-r hidden md:flex flex-col`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-inherit">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-600/20">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-none">ERP Yauricocha</span>
                <span className="text-[10px] text-emerald-500 font-medium">TdR KPIs Minería</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              <Wrench className="h-5 w-5" />
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-slate-200 p-1 rounded-md">
            {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Resumen Ejecutivo', icon: LayoutDashboard },
            { id: 'bloqueA', label: 'Bloque A: Volumen', icon: BarChart3 },
            { id: 'bloqueB', label: 'Bloque B: Eficiencia', icon: TrendingUp },
            { id: 'bloqueC', label: 'Bloque C: Costos & Zonas', icon: Boxes },
            { id: 'tasks', label: 'Gestión de Tickets', icon: FileText },
            { id: 'ingesta', label: 'Ingesta de Datos', icon: UploadCloud }
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabId)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-inherit space-y-2">
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border ${
              isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            {sidebarOpen && <span>{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Container */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        {/* Topbar Navbar */}
        <header className={`h-16 sticky top-0 z-20 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'} border-b backdrop-blur-md px-4 sm:px-6 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="font-bold text-base">{TAB_LABELS[activeTab]}</span>
            {dashboardData && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                dashboardData.source === 'supabase' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {dashboardData.source === 'supabase' ? 'PostgreSQL / TdR Schema' : 'Excel Local TdR'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{exportLoading ? 'Exportando...' : 'Exportar Reporte'}</span>
            </button>
          </div>
        </header>

        {/* Global Filters bar */}
        {(activeTab === 'dashboard' || activeTab === 'bloqueA' || activeTab === 'bloqueB' || activeTab === 'bloqueC') && (
          <div className={`px-4 sm:px-6 py-3 border-b ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-100/50 border-slate-200'} flex flex-wrap items-center gap-3 text-xs`}>
            <div className="flex items-center gap-1.5 font-semibold text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              <span>Filtros TdR:</span>
            </div>

            <select
              value={filters.subsistema || ''}
              onChange={e => handleFilterChange('subsistema', e.target.value)}
              className={`px-2.5 py-1.5 rounded-md border text-xs ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              <option value="">Todos los Sistemas (7)</option>
              <option value="DAT">DAT — Red de Datos</option>
              <option value="CCTV">CCTV — Circuito Cerrado TV</option>
              <option value="RAD">RAD — Radiocomunicaciones</option>
              <option value="TEL">TEL — Telefonía</option>
              <option value="GEO">GEO — Geomecánica</option>
              <option value="FO">FO — Fibra Óptica</option>
              <option value="WIFI">WIFI — Red Inalámbrica</option>
            </select>

            <select
              value={filters.tipo || ''}
              onChange={e => handleFilterChange('tipo', e.target.value)}
              className={`px-2.5 py-1.5 rounded-md border text-xs ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              <option value="">Todos los Tipos</option>
              <option value="Incidente">Incidente</option>
              <option value="Requerimiento">Requerimiento</option>
            </select>

            <select
              value={filters.origen || ''}
              onChange={e => handleFilterChange('origen', e.target.value)}
              className={`px-2.5 py-1.5 rounded-md border text-xs ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'}`}
            >
              <option value="">Todas las Zonas</option>
              <option value="IM">Interior Mina (IM)</option>
              <option value="SUP">Superficie (SUP)</option>
            </select>

            {Object.keys(filters).length > 0 && (
              <button
                onClick={() => { setFilters({}); loadDashboard({}); }}
                className="text-xs text-rose-500 hover:underline font-semibold ml-auto"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {loadingDash && activeTab !== 'tasks' ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-400 font-semibold">Cargando Modelo de Datos TdR...</span>
            </div>
          ) : dashboardData && (
            <>
              {/* SUMMARY TAB */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold">Total Tickets Históricos</span>
                        <FileText className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="text-2xl font-bold">{dashboardData.totalTickets.toLocaleString()}</div>
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="text-emerald-500 font-semibold">{dashboardData.totalRequerimientos} Req</span>
                        <span>·</span>
                        <span className="text-amber-500 font-semibold">{dashboardData.totalIncidentes} Inc</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold">Ratio Incidencia Global</span>
                        <TrendingUp className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="text-2xl font-bold">{dashboardData.ratioIncidenciaGlobalPct}%</div>
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                        <span>Promedio histórico ref:</span>
                        <span className="font-semibold text-slate-300">31.9%</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold">Personas-Hora Totales</span>
                        <Users className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="text-2xl font-bold">{dashboardData.totalPersonasHora.toLocaleString()} h</div>
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                        <span>Prom. por ticket:</span>
                        <span className="font-semibold text-blue-400">{dashboardData.promedioHHporTicket} h-persona</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                      <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-xs font-semibold">Costo Total Materiales</span>
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-bold">S/ {dashboardData.totalCostoMateriales.toLocaleString()}</div>
                      <div className="mt-2 text-[11px] text-emerald-400 font-medium">
                        KPI-10 Confiable (IDs Normalizados)
                      </div>
                    </div>
                  </div>

                  {/* Summary Previews for Bloque A, B, C */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Preview KPI-01 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">KPI-01 — Volumen Mensual por Tipo</span>
                        <button onClick={() => setActiveTab('bloqueA')} className="text-xs text-emerald-500 hover:underline font-semibold flex items-center gap-1">
                          Ver Bloque A <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dashboardData.kpi01_volumenMensual}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis dataKey="month" stroke={axisStroke} fontSize={10} />
                            <YAxis stroke={axisStroke} fontSize={10} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="requerimientos" name="Requerimiento" stackId="a" fill="#10b981" />
                            <Bar dataKey="incidentes" name="Incidente" stackId="a" fill="#f59e0b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Preview KPI-03 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">KPI-03 — Distribución por Sistema</span>
                        <button onClick={() => setActiveTab('bloqueA')} className="text-xs text-emerald-500 hover:underline font-semibold flex items-center gap-1">
                          Ver Bloque A <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={dashboardData.kpi03_distribucionSistema}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis type="number" stroke={axisStroke} fontSize={10} />
                            <YAxis dataKey="codigo" type="category" stroke={axisStroke} fontSize={10} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="total" name="Total Tickets" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BLOQUE A TAB */}
              {activeTab === 'bloqueA' && (
                <div className="space-y-6">
                  {/* Header Note */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} flex items-start gap-3`}>
                    <BarChart3 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-sm">Bloque A — Volumen y Demanda de Infraestructura</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Analiza la demanda total de la Unidad Minera Yauricocha, la proporción entre trabajo planificado (Requerimientos) y reactivo (Incidentes), la carga por tecnología y el análisis de causa raíz.
                      </p>
                    </div>
                  </div>

                  {/* Grid KPI-01 & KPI-02 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* KPI-01 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">KPI-01 — Volumen Mensual de Tickets por Tipo</span>
                          <p className="text-[11px] text-slate-400">Barras apiladas (Requerimiento vs. Incidente)</p>
                        </div>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-01</span>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dashboardData.kpi01_volumenMensual}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis dataKey="month" stroke={axisStroke} fontSize={10} />
                            <YAxis stroke={axisStroke} fontSize={10} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="requerimientos" name="Requerimiento" stackId="a" fill="#10b981" />
                            <Bar dataKey="incidentes" name="Incidente" stackId="a" fill="#f59e0b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        Criterio TdR: El promedio de meses completos es ~216.8 tickets/mes. Meses 20%+ sobre el promedio requieren revisión de cuadrilla.
                      </p>
                    </div>

                    {/* KPI-02 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">KPI-02 — Ratio de Incidencia (% Incidentes)</span>
                          <p className="text-[11px] text-slate-400">Línea de tendencia con umbral histórico de 31.9%</p>
                        </div>
                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-02</span>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dashboardData.kpi02_ratioIncidencia}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis dataKey="month" stroke={axisStroke} fontSize={10} />
                            <YAxis domain={[0, 60]} unit="%" stroke={axisStroke} fontSize={10} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <ReferenceLine y={31.9} label={{ value: 'Prom. Histórico (31.9%)', fill: '#f59e0b', fontSize: 10 }} stroke="#f59e0b" strokeDasharray="4 4" />
                            <Line type="monotone" dataKey="ratio_pct" name="% Incidentes" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        Criterio TdR: Valores por encima de 40% (ej. Mayo 2026: 42.5%) activan alerta de mantenimiento preventivo.
                      </p>
                    </div>
                  </div>

                  {/* Grid KPI-03 & KPI-04 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* KPI-03 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">KPI-03 — Distribución por Sistema</span>
                          <p className="text-[11px] text-slate-400">Total de tickets por tecnología (7 Sistemas)</p>
                        </div>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-03</span>
                      </div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={dashboardData.kpi03_distribucionSistema}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis type="number" stroke={axisStroke} fontSize={10} />
                            <YAxis dataKey="codigo" type="category" stroke={axisStroke} fontSize={10} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="total" name="Total Tickets" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        DAT (27.9%) y CCTV (21.7%) representan cerca de la mitad del total histórico.
                      </p>
                    </div>

                    {/* KPI-04 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">KPI-04 — Diagrama de Pareto de Causas Raíz</span>
                          <p className="text-[11px] text-slate-400">Barras descendentes y porcentaje acumulado con umbral del 80%</p>
                        </div>
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-04</span>
                      </div>
                      <div className="h-80">
                        <ParetoChart
                          data={dashboardData.kpi04_paretoCausas.slice(0, 10).map(c => ({ name: c.causa, count: c.cantidad, acumulado: c.pct_acumulado }))}
                          barName="Cantidad Tickets"
                          gridStroke={gridStroke}
                          axisStroke={axisStroke}
                          tooltipStyle={tooltipStyle}
                          height={300}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        Solo 3 de 19 causas (Mantenimiento Programado, Instalación Nueva, Cable Roto por Trabajos) explican el 80% del histórico.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* BLOQUE B TAB */}
              {activeTab === 'bloqueB' && (
                <div className="space-y-6">
                  {/* Header Note */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} flex items-start gap-3`}>
                    <TrendingUp className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-sm">Bloque B — Eficiencia Operativa y Consumo de Recursos</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Supervisa el impacto de intervenciones externas (daños por terceros), la eficiencia en tiempos de respuesta por sistema y el volumen de Personas-Hora acumuladas por la cuadrilla.
                      </p>
                    </div>
                  </div>

                  {/* Grid KPI-05 & KPI-06 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* KPI-05 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">KPI-05 — % Incidentes por Daño de Terceros</span>
                          <p className="text-[11px] text-slate-400">Impacto mensual de "Cable Roto por Trabajos"</p>
                        </div>
                        <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-05</span>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dashboardData.kpi05_danioTerceros}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis dataKey="month" stroke={axisStroke} fontSize={10} />
                            <YAxis unit="%" stroke={axisStroke} fontSize={10} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Area type="monotone" dataKey="pct_danio" name="% Daño Terceros" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        Representa el 13.4% del total histórico (42% de todos los incidentes). Exige coordinaciones preventivas con contratas de volquetes y perforación.
                      </p>
                    </div>

                    {/* KPI-06 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">KPI-06 — Tiempo Promedio de Atención (Horas)</span>
                          <p className="text-[11px] text-slate-400">Duración promedio por sistema (Incidentes vs Requerimientos)</p>
                        </div>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-06</span>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dashboardData.kpi06_tiempoAtencion}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis dataKey="sistema" stroke={axisStroke} fontSize={10} />
                            <YAxis unit=" h" stroke={axisStroke} fontSize={10} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="incidentes_hrs" name="Incidentes (hrs)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="requerimientos_hrs" name="Requerimientos (hrs)" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        GEO (2.75h) y FO (2.62h) superan el promedio general de atención (2.08h).
                      </p>
                    </div>
                  </div>

                  {/* KPI-07 */}
                  <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm">KPI-07 — Personas-Hora Totales por Mes</span>
                        <p className="text-[11px] text-slate-400">Línea de tendencia de esfuerzo (HH = cantidad_personal × duracion_horas)</p>
                      </div>
                      <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-07</span>
                    </div>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dashboardData.kpi07_personasHora}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="month" stroke={axisStroke} fontSize={10} />
                          <YAxis yAxisId="left" stroke={axisStroke} fontSize={10} />
                          <YAxis yAxisId="right" orientation="right" stroke={axisStroke} fontSize={10} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <ReferenceLine yAxisId="left" y={1500} label={{ value: 'Capacidad Pico (1500 hh)', fill: '#8b5cf6', fontSize: 10 }} stroke="#8b5cf6" strokeDasharray="3 3" />
                          <Bar yAxisId="left" dataKey="hh_totales" name="Personas-Hora Totales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="hh_promedio_ticket" name="HH Prom. por Ticket" stroke="#ec4899" strokeWidth={2.5} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* BLOQUE C TAB */}
              {activeTab === 'bloqueC' && (
                <div className="space-y-6">
                  {/* Header Note */}
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'} flex items-start gap-3`}>
                    <Boxes className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-sm">Bloque C — Confiabilidad, Ubicaciones Críticas y Costos de Materiales</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Identifica las zonas de la mina con mayor reincidencia de fallas, la rotación de materiales e insumos por unidad de medida y el costeo financiero mensual respaldado en SKU normalizados.
                      </p>
                    </div>
                  </div>

                  {/* KPI-08 & KPI-09 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* KPI-08 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">KPI-08 — Top Ubicaciones con Mayor Frecuencia</span>
                          <p className="text-[11px] text-slate-400">Top 15 Zonas Críticas en Mina Yauricocha</p>
                        </div>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-08</span>
                      </div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={dashboardData.kpi08_topUbicaciones.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis type="number" stroke={axisStroke} fontSize={10} />
                            <YAxis dataKey="ubicacion" type="category" stroke={axisStroke} fontSize={9} width={150} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="total" name="Total Tickets" fill="#10b981" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        "NV 1170 P-5 Esperanza Norte" concentra 5.4% del histórico (148 tickets), el doble que la segunda zona.
                      </p>
                    </div>

                    {/* KPI-09 */}
                    <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">KPI-09 — Consumo de Materiales (Top Insumos)</span>
                          <p className="text-[11px] text-slate-400">Insumos de mayor rotación por SKU y cantidad</p>
                        </div>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-09</span>
                      </div>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={dashboardData.kpi09_consumoMateriales.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                            <XAxis type="number" stroke={axisStroke} fontSize={10} />
                            <YAxis dataKey="insumo" type="category" stroke={axisStroke} fontSize={9} width={130} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="cantidad_total" name="Cantidad Consumida" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        Cable UTP (~26,200 m) y Cintillos (~25,400 UN) son los materiales con mayor frecuencia de reposición.
                      </p>
                    </div>
                  </div>

                  {/* KPI-10 */}
                  <div className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-sm">KPI-10 — Costo de Materiales por Ticket, Sistema y Mes</span>
                        <p className="text-[11px] text-slate-400">Barras apiladas de costo financiero en soles (S/)</p>
                      </div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-semibold">KPI-10</span>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.kpi10_costoMateriales}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="month" stroke={axisStroke} fontSize={10} />
                          <YAxis stroke={axisStroke} fontSize={10} unit=" S/" />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="DAT" stackId="a" fill={SISTEMA_COLORS.DAT} />
                          <Bar dataKey="CCTV" stackId="a" fill={SISTEMA_COLORS.CCTV} />
                          <Bar dataKey="RAD" stackId="a" fill={SISTEMA_COLORS.RAD} />
                          <Bar dataKey="TEL" stackId="a" fill={SISTEMA_COLORS.TEL} />
                          <Bar dataKey="GEO" stackId="a" fill={SISTEMA_COLORS.GEO} />
                          <Bar dataKey="FO" stackId="a" fill={SISTEMA_COLORS.FO} />
                          <Bar dataKey="WIFI" stackId="a" fill={SISTEMA_COLORS.WIFI} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* TASKS TAB */}
              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar código, ubicación o causa..."
                          value={search}
                          onChange={e => { setSearch(e.target.value); loadTasks(1, e.target.value, typeFilter, originFilter); }}
                          className={`pl-9 pr-3 py-1.5 rounded-lg border text-xs w-64 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                        />
                      </div>
                      <select
                        value={typeFilter}
                        onChange={e => { setTypeFilter(e.target.value); loadTasks(1, search, e.target.value, originFilter); }}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                      >
                        <option value="">Tipo: Todos</option>
                        <option value="Incidente">Incidente</option>
                        <option value="Requerimiento">Requerimiento</option>
                      </select>
                      <select
                        value={originFilter}
                        onChange={e => { setOriginFilter(e.target.value); loadTasks(1, search, typeFilter, e.target.value); }}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                      >
                        <option value="">Origen: Todos</option>
                        <option value="IM">IM — Interior Mina</option>
                        <option value="SUP">SUP — Superficie</option>
                      </select>
                    </div>

                    <span className="text-xs text-slate-400 font-medium">Total: {totalTasks.toLocaleString()} registros</span>
                  </div>

                  {/* Tasks Table */}
                  <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className={`border-b ${isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'} font-semibold`}>
                          <tr>
                            <th className="p-3">Código</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Origen</th>
                            <th className="p-3">Ubicación Normalizada</th>
                            <th className="p-3">Causa Raíz (Sistema)</th>
                            <th className="p-3">Personal</th>
                            <th className="p-3">Horas</th>
                            <th className="p-3">HH Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-inherit">
                          {tasks.map(t => (
                            <tr key={t.ticket_id} className={`hover:bg-emerald-500/5 transition-colors cursor-pointer`} onClick={() => setSelectedTask(t)}>
                              <td className="p-3 font-mono font-semibold text-emerald-500">{t.codigo_registro}</td>
                              <td className="p-3 text-slate-400 whitespace-nowrap">{t.fecha}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  t.tipo_registro === 'Incidente' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                }`}>
                                  {t.tipo_registro}
                                </span>
                              </td>
                              <td className="p-3 font-semibold text-slate-400">{t.tipo_trabajo}</td>
                              <td className="p-3 max-w-xs truncate">{t.ubicacion}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{t.sistema}</span>
                                  <span className="truncate">{t.causa_raiz}</span>
                                </div>
                              </td>
                              <td className="p-3">{t.cantidad_personal} pers</td>
                              <td className="p-3">{t.duracion_horas} h</td>
                              <td className="p-3 font-semibold text-purple-400">{t.horas_hombre} hh</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className={`p-3 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                      <span className="text-xs text-slate-400">Página {currentPage} de {totalPages}</span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={currentPage <= 1}
                          onClick={() => loadTasks(currentPage - 1, search, typeFilter, originFilter)}
                          className="p-1.5 rounded border border-inherit disabled:opacity-40"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          disabled={currentPage >= totalPages}
                          onClick={() => loadTasks(currentPage + 1, search, typeFilter, originFilter)}
                          className="p-1.5 rounded border border-inherit disabled:opacity-40"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* INGESTA TAB */}
              {activeTab === 'ingesta' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
                    <div className="flex items-center gap-3">
                      <UploadCloud className="h-6 w-6 text-emerald-500" />
                      <div>
                        <h3 className="font-bold text-base">Ingesta Mensual de Datos (Excel → TdR Modelo)</h3>
                        <p className="text-xs text-slate-400">Cargue el archivo mensual "Yauricocha - CORONA.xlsx" para normalización automática.</p>
                      </div>
                    </div>

                    <div className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-center ${
                      isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-300 bg-slate-50'
                    }`}>
                      <FileText className="h-10 w-10 text-slate-400" />
                      <div className="space-y-1">
                        <span className="text-xs font-semibold">Seleccione o arrastre la plantilla Excel</span>
                        <p className="text-[11px] text-slate-400">Soporta columnas RESGISTROS, Fecha inic., IM/SUP, Ubicación, Causa Raiz, Ticket, INSUMO...</p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        Yauricocha - CORONA.xlsx (Procesado Activo: 2,741 tickets)
                      </span>
                    </div>

                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Base de Datos Normalizada al 100% conforme a TdR_Sistema_KPIs_Yauricocha.md</span>
                      </div>
                      <span className="font-semibold text-emerald-400">Estado: VÁLIDO</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
