"use client";

import React, { useState, useEffect, useTransition } from 'react';
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
  Filter, 
  Server, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle,
  FileText,
  HelpCircle,
  Activity,
  Layers,
  ArrowUpRight
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'supabase'>('dashboard');
  const [mounted, setMounted] = useState(false);
  
  // States for Dashboard Data
  const [dashboardData, setDashboardData] = useState<any>(null);
  
  // States for Paginated Tasks
  const [tasks, setTasks] = useState<any[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  
  // Selected task for Detail Panel
  const [selectedTask, setSelectedTask] = useState<any>(null);
  
  // Transition state
  const [isPending, startTransition] = useTransition();

  // Load Initial Dashboard data
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

  // Color Palette for Pie Charts (Teal, Blue, Violet, Amber, Emerald, Orange)
  const COLORS = ['#2dd4bf', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f97316', '#64748b'];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 text-teal-400 animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Iniciando Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-[#E2E8F0] font-sans selection:bg-teal-500/30">
      
      {/* 1. Header Fijo */}
      <header className="border-b border-slate-800/80 bg-[#0B132B]/75 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-teal-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-teal-500/10">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              ERP Minero
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                v1.0
              </span>
            </h1>
            <p className="text-xs text-slate-400">Control de Operaciones y Mantenimiento Subterráneo</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex flex-col text-right hidden sm:block">
            <span className="text-xs font-semibold text-slate-400">Unidad de Operación</span>
            <span className="text-sm font-medium text-white">UM Corona - Yauricocha</span>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-inner">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-xs font-medium text-amber-400">Modo Excel Local</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        
        {/* 2. Tarjetas de Métricas Principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
            <div className="absolute right-0 bottom-0 opacity-5 group-hover:scale-110 transition-transform duration-300">
              <Wrench className="h-28 w-28 text-white" />
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Total Tareas (10m)</span>
              <span className="bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/15">
                <FileText className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {dashboardData ? dashboardData.totalTasks.toLocaleString() : '---'}
              </span>
              <span className="text-xs text-slate-400">tareas cerradas</span>
            </div>
            <p className="text-xs text-indigo-400 mt-2 flex items-center gap-1 font-medium">
              UM Corona · Yauricocha <ArrowUpRight className="h-3 w-3" />
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
            <div className="absolute right-0 bottom-0 opacity-5 group-hover:scale-110 transition-transform duration-300">
              <Boxes className="h-28 w-28 text-white" />
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Suministros Consumidos</span>
              <span className="bg-teal-500/10 text-teal-400 p-1.5 rounded-lg border border-teal-500/15">
                <Boxes className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {dashboardData ? dashboardData.totalInsumosQty.toLocaleString() : '---'}
              </span>
              <span className="text-xs text-slate-400">unidades/m</span>
            </div>
            <p className="text-xs text-teal-400 mt-2 flex items-center gap-1 font-medium">
              114 insumos normalizados <ArrowUpRight className="h-3 w-3" />
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
            <div className="absolute right-0 bottom-0 opacity-5 group-hover:scale-110 transition-transform duration-300">
              <Users className="h-28 w-28 text-white" />
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Personal por Tarea</span>
              <span className="bg-amber-500/10 text-amber-400 p-1.5 rounded-lg border border-amber-500/15">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {dashboardData ? dashboardData.avgPerson : '---'}
              </span>
              <span className="text-xs text-slate-400">técnicos prom.</span>
            </div>
            <p className="text-xs text-amber-400 mt-2 flex items-center gap-1 font-medium">
              Asignación óptima de cuadrilla <ArrowUpRight className="h-3 w-3" />
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
            <div className="absolute right-0 bottom-0 opacity-5 group-hover:scale-110 transition-transform duration-300">
              <Clock className="h-28 w-28 text-white" />
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Tiempo de Resolución</span>
              <span className="bg-rose-500/10 text-rose-400 p-1.5 rounded-lg border border-rose-500/15">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {dashboardData ? dashboardData.avgHours : '---'}
              </span>
              <span className="text-xs text-slate-400">horas prom.</span>
            </div>
            <p className="text-xs text-rose-400 mt-2 flex items-center gap-1 font-medium">
              Base para ANS/SLA operativo <ArrowUpRight className="h-3 w-3" />
            </p>
          </div>

        </div>

        {/* 3. Selector de Pestañas / Tabs Nav */}
        <div className="flex border-b border-slate-800 gap-6">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`pb-4 text-sm font-semibold relative transition-colors ${activeTab === 'dashboard' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {activeTab === 'dashboard' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400 rounded-full" />}
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Dashboard Analítico
            </span>
          </button>
          
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`pb-4 text-sm font-semibold relative transition-colors ${activeTab === 'tasks' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {activeTab === 'tasks' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400 rounded-full" />}
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Registro de Tareas ({totalTasks.toLocaleString()})
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('supabase')}
            className={`pb-4 text-sm font-semibold relative transition-colors ${activeTab === 'supabase' ? 'text-teal-400' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {activeTab === 'supabase' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400 rounded-full" />}
            <span className="flex items-center gap-2">
              <Database className="h-4 w-4" /> Infraestructura & SQL
            </span>
          </button>
        </div>

        {/* 4. Tab Contents */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {dashboardData ? (
              <>
                {/* Fila 1: Tendencia y Distribuciones */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Tendencia Temporal */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-white">Tendencia Mensual de Tareas</h3>
                      <p className="text-xs text-slate-400">Distribución temporal entre Incidentes y Requerimientos</p>
                    </div>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardData.monthlyTrend}>
                          <defs>
                            <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Area type="monotone" name="Incidentes" dataKey="incidentes" stroke="#f43f5e" fillOpacity={1} fill="url(#colorInc)" strokeWidth={2} />
                          <Area type="monotone" name="Requerimientos" dataKey="requerimientos" stroke="#3b82f6" fillOpacity={1} fill="url(#colorReq)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Distribución por Subsistemas */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">Tareas por Subsistema</h3>
                      <p className="text-xs text-slate-400">Volumen acumulado por tipo de infraestructura de comunicación</p>
                    </div>
                    <div className="h-56 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardData.subsistemas}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {dashboardData.subsistemas.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {dashboardData.subsistemas.slice(0, 6).map((sub: any, idx: number) => (
                        <div key={sub.name} className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
                          <span className="block font-semibold text-white">{sub.value}</span>
                          <span className="text-[10px] font-medium text-slate-400 flex items-center justify-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                            {sub.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Fila 2: Consumos y Ubicaciones Calientes */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Top Insumos Consumidos */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-white">Top 8 Insumos Consumidos</h3>
                      <p className="text-xs text-slate-400">Suministros físicos con mayor demanda acumulada en la unidad</p>
                    </div>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboardData.topInsumos} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                          <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={130} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                          <Bar dataKey="value" name="Consumo Total" fill="#2dd4bf" radius={[0, 4, 4, 0]}>
                            {dashboardData.topInsumos.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.name.includes('Cintillos') ? '#8b5cf6' : '#2dd4bf'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Zonas Calientes (Ubicaciones) */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-white">Zonas Calientes (Fallas)</h3>
                      <p className="text-xs text-slate-400">Niveles y labores subterráneas con mayor índice de intervenciones</p>
                    </div>
                    <div className="space-y-3">
                      {dashboardData.topLocations.map((loc: any, index: number) => (
                        <div key={loc.name} className="flex justify-between items-center p-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700/60 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold bg-slate-800 text-slate-400 h-6 w-6 rounded-lg flex items-center justify-center border border-slate-700/30">
                              #{index + 1}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-white">{loc.name}</span>
                              <span className="text-[10px] text-slate-400">UM Corona</span>
                            </div>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {loc.value} fallas
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </>
            ) : (
              <div className="h-96 flex items-center justify-center bg-[#0F172A] border border-slate-800 rounded-2xl">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="h-8 w-8 text-teal-400 animate-spin" />
                  <p className="text-slate-400 text-sm">Procesando conjunto de datos...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            
            {/* Buscador y Tabla de Tareas */}
            <div className="xl:col-span-2 space-y-4">
              
              {/* Filtros e Inputs */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
                
                <div className="relative w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Buscar por ticket, detalle o ubicación..."
                    value={search}
                    onChange={handleSearchChange}
                    className="w-full bg-[#090D16] border border-slate-800 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 rounded-xl py-2 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 transition-colors"
                  />
                </div>

                <div className="flex gap-2 w-full md:w-auto shrink-0">
                  
                  {/* Filtro Tipo */}
                  <select 
                    value={typeFilter} 
                    onChange={(e) => handleTypeFilter(e.target.value)}
                    className="bg-[#090D16] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer hover:border-slate-700 transition-colors"
                  >
                    <option value="">Todos los Tipos</option>
                    <option value="Incidente">Incidentes</option>
                    <option value="Requerimiento">Requerimientos</option>
                  </select>

                  {/* Filtro Origen */}
                  <select 
                    value={originFilter} 
                    onChange={(e) => handleOriginFilter(e.target.value)}
                    className="bg-[#090D16] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer hover:border-slate-700 transition-colors"
                  >
                    <option value="">Todos los Orígenes</option>
                    <option value="IM">Interior Mina</option>
                    <option value="SUP">Superficie</option>
                  </select>

                </div>

              </div>

              {/* Listado de Tareas */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#0B132B]/50 sticky top-0 backdrop-blur-sm z-10">
                        <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticket</th>
                        <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo/Origen</th>
                        <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ubicación</th>
                        <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Causa Raíz</th>
                        <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Insumos</th>
                        <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {isPending ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-slate-400 text-sm">
                            <div className="flex flex-col items-center gap-2">
                              <Activity className="h-6 w-6 text-teal-400 animate-spin" />
                              Cargando registros...
                            </div>
                          </td>
                        </tr>
                      ) : tasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-slate-400 text-sm">
                            No se encontraron tareas coincidentes.
                          </td>
                        </tr>
                      ) : (
                        tasks.map((task) => (
                          <tr 
                            key={task.id} 
                            onClick={() => setSelectedTask(task)}
                            className={`hover:bg-slate-800/30 cursor-pointer transition-colors ${selectedTask?.id === task.id ? 'bg-teal-500/5' : ''}`}
                          >
                            <td className="p-4 font-mono text-xs font-semibold text-white">
                              {task.ticket || 'S/N'}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-max border ${
                                  task.tipo === 'Incidente' 
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                }`}>
                                  {task.tipo}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                                  <Layers className="h-3 w-3" />
                                  {task.origen === 'IM' ? 'Interior Mina' : 'Superficie'}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col max-w-[200px]">
                                <span className="text-xs font-semibold text-white truncate">
                                  {task.ubicacion.zona}
                                </span>
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-slate-500" />
                                  {task.ubicacion.nivel} {task.ubicacion.punto ? `· ${task.ubicacion.punto}` : ''}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-200">
                                  {task.causa_raiz}
                                </span>
                                <span className="text-[10px] text-teal-400 font-semibold uppercase">
                                  {inferSubsystem(task.causa_raiz)}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                task.insumos.length > 0 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-slate-800 text-slate-500 border border-slate-700/20'
                              }`}>
                                {task.insumos.length}
                              </span>
                            </td>
                            <td className="p-4">
                              <button className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors">
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="border-t border-slate-800 px-6 py-4 flex justify-between items-center bg-[#0B132B]/20">
                  <span className="text-xs text-slate-400 font-medium">
                    Mostrando <strong className="text-white">{(currentPage - 1) * 20 + 1}-{Math.min(currentPage * 20, totalTasks)}</strong> de <strong className="text-white">{totalTasks.toLocaleString()}</strong> tareas
                  </span>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={handlePrevPage}
                      disabled={currentPage === 1 || isPending}
                      className="border border-slate-800 bg-slate-900 text-slate-400 p-2 rounded-xl hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="border border-slate-800 bg-[#090D16] text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center min-w-[32px]">
                      {currentPage} / {totalPages}
                    </span>
                    <button 
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages || isPending}
                      className="border border-slate-800 bg-slate-900 text-slate-400 p-2 rounded-xl hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Panel de Detalles */}
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl sticky top-24">
              
              {selectedTask ? (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Orden de Trabajo</span>
                        <h3 className="text-lg font-bold text-white tracking-tight">{selectedTask.ticket || 'Ticket S/N'}</h3>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        selectedTask.tipo === 'Incidente' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {selectedTask.tipo}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs border-y border-slate-800/80 py-4">
                      <div>
                        <span className="block text-[10px] text-slate-500 font-semibold uppercase">Fecha Inicio</span>
                        <span className="font-medium text-slate-200">
                          {selectedTask.fecha_inicio ? new Date(selectedTask.fecha_inicio).toLocaleDateString() : 'No indicada'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 font-semibold uppercase">Fecha Cierre</span>
                        <span className="font-medium text-slate-200">
                          {selectedTask.fecha_fin ? new Date(selectedTask.fecha_fin).toLocaleDateString() : 'En proceso / Excel Cierre'}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="block text-[10px] text-slate-500 font-semibold uppercase">Personal Asignado</span>
                        <span className="font-semibold text-white flex items-center gap-1.5 mt-0.5">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {selectedTask.cant_personas} Personas
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="block text-[10px] text-slate-500 font-semibold uppercase">Horas Ejecución</span>
                        <span className="font-semibold text-white flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {selectedTask.tiempo_horas} Horas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ubicación */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Ubicación Relacional</span>
                    <div className="p-3 bg-[#090D16] border border-slate-800 rounded-xl space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Nivel:</span>
                        <span className="font-bold text-white">{selectedTask.ubicacion.nivel}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Zona/Labor:</span>
                        <span className="font-bold text-white">{selectedTask.ubicacion.zona}</span>
                      </div>
                      {selectedTask.ubicacion.punto && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Punto de Red:</span>
                          <span className="font-bold text-teal-400">{selectedTask.ubicacion.punto}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-800 pt-2 mt-2">
                        <span className="block text-[9px] text-slate-500 font-semibold">CADENA ORIGINAL EXCEL</span>
                        <span className="text-[10px] text-slate-400 block break-words mt-0.5">{selectedTask.ubicacion.texto_original}</span>
                      </div>
                    </div>
                  </div>

                  {/* Detalles de la Tarea */}
                  <div className="space-y-3">
                    {selectedTask.detalle && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Detalle del Requerimiento</span>
                        <p className="text-xs text-slate-300 bg-[#090D16] p-3 rounded-xl border border-slate-800/60 leading-relaxed max-h-32 overflow-y-auto">
                          {selectedTask.detalle}
                        </p>
                      </div>
                    )}
                    
                    {selectedTask.trabajo_realizado && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Trabajo Realizado</span>
                        <p className="text-xs text-teal-200/90 bg-teal-950/10 p-3 rounded-xl border border-teal-500/10 leading-relaxed max-h-32 overflow-y-auto">
                          {selectedTask.trabajo_realizado}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Insumos */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Insumos y Materiales Consumidos</span>
                    {selectedTask.insumos.length === 0 ? (
                      <div className="p-3 bg-slate-800/20 border border-slate-800/80 rounded-xl text-center text-xs text-slate-500">
                        Ningún suministro físico registrado. Solo mano de obra.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {selectedTask.insumos.map((ins: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-slate-700/60 transition-colors text-xs">
                            <span className="font-semibold text-slate-200">{ins.name}</span>
                            <span className="font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/10">
                              {ins.cantidad} {ins.unidad}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-96 flex flex-col justify-center items-center text-center p-6 border border-dashed border-slate-800 rounded-xl gap-3">
                  <HelpCircle className="h-10 w-10 text-slate-600" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Detalle de Operación</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Selecciona una tarea de la tabla de la izquierda para ver su detalle completo, consumos y ubicación jerárquica.</p>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

        {activeTab === 'supabase' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Estado e instrucciones */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card Estatus Infra */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 opacity-5">
                  <Server className="h-44 w-44 text-white" />
                </div>
                
                <h3 className="text-base font-bold text-white">Estado del Aprovisionamiento de Base de Datos</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dado que has confirmado que aún no has creado las cuentas de base de datos, el ERP está operando en **Modo Demo Offline** leyendo el archivo Excel local directo de la carpeta del proyecto. Sin embargo, toda la estructura SQL y los scripts de migración ya están listos para tu base de datos de producción.
                </p>

                {/* Línea de tiempo de pasos */}
                <div className="pt-4 space-y-4">
                  
                  <div className="flex gap-3 items-start">
                    <span className="h-6 w-6 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Análisis y Limpieza del Excel (Completado)</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Mapeo del patrón padre-hijo, limpieza fuzzy de 114 insumos y extracción de 799 ubicaciones jerárquicas.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <span className="h-6 w-6 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Generación del Script de Ingesta Inmediato (Completado)</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Creación del archivo SQL transaccional <code className="text-teal-400 bg-slate-900 px-1 rounded">supabase/migration_data.sql</code> que cargará todas las tareas con claves UUID estables y consistentes.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <span className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-400">Aprovisionamiento en Supabase Cloud (Pendiente de tu aprobación)</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Crear el proyecto en Supabase, ejecutar el esquema inicial y cargar los datos migrados.</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Card Instrucciones SQL */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white">Cómo cargar los datos en tu nuevo Supabase</h3>
                <ol className="text-xs text-slate-300 space-y-3 list-decimal list-inside">
                  <li>
                    Inicia sesión en **Supabase** y crea tu proyecto como se describe en la <span className="text-teal-400 font-semibold">Guía de Configuración</span>.
                  </li>
                  <li>
                    Ve al menú **SQL Editor** en el panel izquierdo de Supabase.
                  </li>
                  <li>
                    Crea una consulta nueva, copia el contenido de nuestro archivo local <code className="text-teal-400 bg-slate-900 px-1 rounded">supabase/migrations/0001_initial_schema.sql</code> y ejecútalo para crear las tablas.
                  </li>
                  <li>
                    Crea otra consulta, copia el contenido de nuestro archivo <code className="text-teal-400 bg-slate-900 px-1 rounded">supabase/seed.sql</code> y ejecútalo para cargar los catálogos y unidades.
                  </li>
                  <li>
                    Finalmente, abre el archivo local <code className="text-teal-400 bg-slate-900 px-1 rounded">supabase/migration_data.sql</code>, copia su código completo, pégalo en una consulta de Supabase y ejecútalo. Esto poblará tu base de datos con las 2,277 tareas y sus insumos.
                  </li>
                </ol>
              </div>

            </div>

            {/* Panel lateral con las rutas de los archivos */}
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              <div>
                <h3 className="text-base font-bold text-white">Archivos Locales Listos</h3>
                <p className="text-xs text-slate-400 mt-1">Los siguientes archivos en la carpeta de tu proyecto contienen el código SQL y scripts necesarios:</p>
              </div>

              <div className="space-y-3">
                
                <div className="p-3 bg-[#090D16] border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Esquema Base</span>
                  <span className="text-xs font-semibold text-slate-200 block truncate">0001_initial_schema.sql</span>
                  <span className="text-[10px] text-slate-400 block break-all">supabase/migrations/0001_initial_schema.sql</span>
                </div>

                <div className="p-3 bg-[#090D16] border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Catálogos Semilla</span>
                  <span className="text-xs font-semibold text-slate-200 block truncate">seed.sql</span>
                  <span className="text-[10px] text-slate-400 block break-all">supabase/seed.sql</span>
                </div>

                <div className="p-3 bg-[#090D16] border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Script de Datos Migrados</span>
                  <span className="text-xs font-semibold text-teal-400 block truncate">migration_data.sql</span>
                  <span className="text-[10px] text-slate-400 block break-all">supabase/migration_data.sql</span>
                </div>

                <div className="p-3 bg-[#090D16] border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Código del Migrador en Python</span>
                  <span className="text-xs font-semibold text-slate-200 block truncate">ingest.py</span>
                  <span className="text-[10px] text-slate-400 block break-all">scripts/ingest.py</span>
                </div>

              </div>

              <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-xl flex gap-3 items-start">
                <AlertCircle className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-white block">Siguientes Pasos del Desarrollo</span>
                  <span className="text-[11px] text-slate-400 block leading-relaxed">
                    Una vez que configures Supabase, podremos conectar el cliente directamente para quitar el modo "Excel Local" y habilitar la sincronización en tiempo real y la PWA offline.
                  </span>
                </div>
              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
