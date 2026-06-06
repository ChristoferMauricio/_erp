"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import {
  fetchDashboardData,
  fetchTasks
} from './actions';
import {
  Wrench,
  Database,
  TrendingUp,
  Boxes,
  Users,
  Clock,
  MapPin,
  Search,
  Server,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
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
  Cell
} from 'recharts';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'supabase'>('dashboard');
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

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    fetchDashboardData().then(data => {
      setDashboardData(data);
    });
    loadTasks(1, '', '', '');
  }, []);

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

  const COLORS = ['#2dd4bf', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f97316', '#64748b'];

  const tooltipStyle = theme === 'dark'
    ? { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#e2e8f0', fontSize: '12px' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', color: '#1f2937', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };

  const gridStroke = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const axisStroke = theme === 'dark' ? '#64748b' : '#9ca3af';

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, desc: 'Analítica general' },
    { id: 'tasks' as const, label: 'Tareas', icon: Wrench, desc: 'Registro de operaciones', badge: totalTasks },
    { id: 'supabase' as const, label: 'Infraestructura', icon: Database, desc: 'Base de datos & SQL' },
  ];

  const tabLabels: Record<string, string> = {
    dashboard: 'Dashboard Analítico',
    tasks: 'Registro de Tareas',
    supabase: 'Infraestructura & SQL',
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
                onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }}
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

          <div className="pt-4">
            {sidebarOpen && (
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-600 uppercase tracking-widest px-3 mb-3 block">
                Próximamente
              </span>
            )}
            {[
              { label: 'Inventario', icon: Boxes },
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
              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Excel Local</span>
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
                    {dashboardData ? dashboardData.totalInsumosQty.toLocaleString() : '---'}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">unidades</span>
                </div>
                <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-2 flex items-center gap-1 font-medium">
                  114 insumos normalizados <ArrowUpRight className="h-3 w-3" />
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
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 tracking-wider uppercase">Resolución</span>
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
                  Base SLA operativo <ArrowUpRight className="h-3 w-3" />
                </p>
              </div>
            </div>

            {/* ========== DASHBOARD TAB ========== */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {dashboardData ? (
                  <>
                    {/* Row 1: Trend + Subsystems */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

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

                      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Tareas por Subsistema</h3>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Por tipo de infraestructura</p>
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
                    </div>

                    {/* Row 2: Top Insumos + Hot Zones */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

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
                    </div>
                  </>
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

            {/* ========== SUPABASE TAB ========== */}
            {activeTab === 'supabase' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                <div className="lg:col-span-2 space-y-6">

                  {/* Infrastructure Status */}
                  <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 opacity-[0.03]">
                      <Server className="h-44 w-44" />
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Estado del Aprovisionamiento</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                      El ERP opera en <strong className="text-amber-600 dark:text-amber-400">Modo Demo Offline</strong> leyendo el archivo Excel local. La estructura SQL y scripts de migración están listos para producción.
                    </p>

                    <div className="pt-2 space-y-4">
                      <div className="flex gap-3 items-start">
                        <span className="h-7 w-7 rounded-full bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-4 w-4 text-teal-500 dark:text-teal-400" />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-gray-800 dark:text-white">Análisis y Limpieza del Excel</h4>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Mapeo del patrón padre-hijo, limpieza fuzzy de 114 insumos y extracción de 799 ubicaciones.</p>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start">
                        <span className="h-7 w-7 rounded-full bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-4 w-4 text-teal-500 dark:text-teal-400" />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-gray-800 dark:text-white">Script de Ingesta SQL Generado</h4>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                            Archivo SQL transaccional <code className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded text-[10px]">supabase/migration_data.sql</code> con claves UUID estables.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start">
                        <span className="h-7 w-7 rounded-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400">Aprovisionamiento Supabase Cloud</h4>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Pendiente: crear proyecto, ejecutar esquema y cargar datos migrados.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SQL Instructions */}
                  <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cómo cargar los datos en Supabase</h3>
                    <ol className="text-xs text-gray-600 dark:text-slate-300 space-y-3 list-decimal list-inside leading-relaxed">
                      <li>Inicia sesión en <strong className="text-gray-800 dark:text-white">Supabase</strong> y crea tu proyecto.</li>
                      <li>Ve al menú <strong className="text-gray-800 dark:text-white">SQL Editor</strong> en el panel izquierdo.</li>
                      <li>
                        Ejecuta el archivo <code className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded text-[10px]">supabase/migrations/0001_initial_schema.sql</code> para crear las tablas.
                      </li>
                      <li>
                        Ejecuta <code className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded text-[10px]">supabase/seed.sql</code> para cargar catálogos.
                      </li>
                      <li>
                        Ejecuta <code className="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-1.5 py-0.5 rounded text-[10px]">supabase/migration_data.sql</code> para poblar las 2,277 tareas e insumos.
                      </li>
                    </ol>
                  </div>
                </div>

                {/* Files Panel */}
                <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm dark:shadow-none">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Archivos Locales</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">SQL y scripts listos para despliegue</p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { label: 'Esquema Base', file: '0001_initial_schema.sql', path: 'supabase/migrations/', highlight: false },
                      { label: 'Catálogos', file: 'seed.sql', path: 'supabase/', highlight: false },
                      { label: 'Datos Migrados', file: 'migration_data.sql', path: 'supabase/', highlight: true },
                      { label: 'Migrador Python', file: 'ingest.py', path: 'scripts/', highlight: false },
                    ].map(item => (
                      <div key={item.file} className="p-3 bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-700/30 rounded-xl space-y-1">
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold tracking-wider block">{item.label}</span>
                        <span className={`text-xs font-semibold block truncate ${item.highlight ? 'text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-slate-200'}`}>{item.file}</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 block">{item.path}{item.file}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-teal-50 dark:bg-teal-500/5 border border-teal-200 dark:border-teal-500/10 rounded-xl flex gap-3 items-start">
                    <AlertCircle className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-gray-800 dark:text-white block">Siguiente Paso</span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400 block leading-relaxed">
                        Configura Supabase para habilitar sincronización en tiempo real y la PWA offline.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
