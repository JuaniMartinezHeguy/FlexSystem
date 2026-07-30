import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  Building2, 
  PieChart as PieChartIcon, 
  ListFilter,
  Zap,
  Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Suscripcion } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { getTodayART, formatDateART } from '../../lib/dateUtils';
import { Skeleton } from '../common/Skeleton';

type Periodo = 'dia' | 'mes' | 'anio';
type TipoGrafico = 'dona' | 'tabla';

export const StatsGimnasio: React.FC = () => {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('dona');
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarStats();
  }, []);

  const cargarStats = async () => {
    setLoading(true);
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('suscripciones')
        .select('*, plan:planes(*)')
        .order('creado_en', { ascending: false });

      if (data) setSuscripciones(data as Suscripcion[]);
    } else {
      const subs = MockStore.getSuscripciones();
      const planes = MockStore.getPlanes();
      const mapped = subs.map(s => ({
        ...s,
        plan: planes.find(p => p.id === s.plan_id)
      }));
      setSuscripciones(mapped as Suscripcion[]);
    }
    setLoading(false);
  };

  const hoyStr = getTodayART(); // YYYY-MM-DD
  const [anioActual, mesActual] = hoyStr.split('-');

  // Filtrar suscripciones según período seleccionado
  const subsFiltradas = suscripciones.filter(s => {
    const fechaCobro = s.fecha_inicio || s.creado_en?.substring(0, 10) || '';
    if (!fechaCobro) return false;

    const [anio, mes] = fechaCobro.split('-');

    if (periodo === 'dia') {
      return fechaCobro === hoyStr;
    }
    if (periodo === 'mes') {
      return anio === anioActual && mes === mesActual;
    }
    if (periodo === 'anio') {
      return anio === anioActual;
    }
    return true;
  });

  // Totales por medio de pago
  const totalIngresoBruto = subsFiltradas.reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);
  const totalEfectivo = subsFiltradas.filter(s => s.medio_pago === 'efectivo').reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);
  const totalTransferencia = subsFiltradas.filter(s => s.medio_pago === 'transferencia').reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);
  const totalTarjeta = subsFiltradas.filter(s => s.medio_pago === 'tarjeta').reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);

  // Cantidad de transacciones por medio de pago
  const countEfectivo = subsFiltradas.filter(s => s.medio_pago === 'efectivo').length;
  const countTransferencia = subsFiltradas.filter(s => s.medio_pago === 'transferencia').length;
  const countTarjeta = subsFiltradas.filter(s => s.medio_pago === 'tarjeta').length;

  // Datos para Gráfico de Dona
  const dataPie = [
    { name: 'Efectivo', value: totalEfectivo, count: countEfectivo, color: '#10b981', key: 'efectivo', icon: Banknote },
    { name: 'Transferencia / MP', value: totalTransferencia, count: countTransferencia, color: '#38bdf8', key: 'transferencia', icon: Building2 },
    { name: 'Tarjeta', value: totalTarjeta, count: countTarjeta, color: '#a855f7', key: 'tarjeta', icon: CreditCard },
  ].filter(item => item.value > 0 || subsFiltradas.length === 0);

  const chartDataPie = dataPie.length > 0 ? dataPie : [
    { name: 'Efectivo', value: 1, count: 0, color: '#10b981', key: 'efectivo', icon: Banknote },
    { name: 'Transferencia / MP', value: 1, count: 0, color: '#38bdf8', key: 'transferencia', icon: Building2 },
    { name: 'Tarjeta', value: 1, count: 0, color: '#a855f7', key: 'tarjeta', icon: CreditCard },
  ];

  // Custom Tooltip Recharts Cybertech
  const CustomTooltipPie = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pct = totalIngresoBruto > 0 ? Math.round((data.value / totalIngresoBruto) * 100) : 0;
      return (
        <div className="bg-zinc-950/95 border border-zinc-700/80 backdrop-blur-md p-3.5 rounded-xl shadow-2xl space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="text-xs font-bold text-zinc-100">{data.name}</span>
          </div>
          <p className="text-sm font-extrabold font-mono text-zinc-100">
            ${data.value.toLocaleString('es-AR')}
          </p>
          <p className="text-[10px] text-zinc-400 font-medium">
            Representa el <span className="text-white font-bold">{pct}%</span> ({data.count} cobros)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Header Con Selector de Período */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500 shadow-inner">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              Ingresos del Gimnasio
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/60 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Tech Analytics
              </span>
            </h3>
            <p className="text-xs text-zinc-400">Desglose visual por método de pago e ingreso bruto acumulado</p>
          </div>
        </div>

        {/* Filtro Período */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setPeriodo('dia')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              periodo === 'dia' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Hoy (Día)
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              periodo === 'mes' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => setPeriodo('anio')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              periodo === 'anio' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Este Año
          </button>
        </div>
      </div>

      {/* Cards KPI Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Ingreso Bruto Total */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl relative overflow-hidden group hover:border-red-500/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Ingreso Bruto Total</span>
            <div className="p-2 bg-red-600/20 text-red-400 rounded-xl border border-red-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div>
              <p className="text-2xl font-extrabold text-zinc-100 font-mono tracking-tight">
                ${totalIngresoBruto.toLocaleString('es-AR')}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1 font-medium">
                <Activity className="w-3.5 h-3.5 text-red-500" />
                <span>{subsFiltradas.length} cobros en este período</span>
              </p>
            </div>
          )}
        </div>

        {/* Efectivo */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Efectivo</span>
            <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div>
              <p className="text-xl font-bold text-zinc-100 font-mono">
                ${totalEfectivo.toLocaleString('es-AR')}
              </p>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2 border border-zinc-800">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500 shadow-[0_0_8px_#10b981]" 
                  style={{ width: `${totalIngresoBruto > 0 ? (totalEfectivo / totalIngresoBruto) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-emerald-400 font-bold mt-1.5">
                {totalIngresoBruto > 0 ? Math.round((totalEfectivo / totalIngresoBruto) * 100) : 0}% del ingreso bruto
              </p>
            </div>
          )}
        </div>

        {/* Transferencia */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Transferencia / MP</span>
            <div className="p-2 bg-sky-950 text-sky-400 rounded-xl border border-sky-800">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div>
              <p className="text-xl font-bold text-zinc-100 font-mono">
                ${totalTransferencia.toLocaleString('es-AR')}
              </p>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2 border border-zinc-800">
                <div 
                  className="bg-sky-400 h-full transition-all duration-500 shadow-[0_0_8px_#38bdf8]" 
                  style={{ width: `${totalIngresoBruto > 0 ? (totalTransferencia / totalIngresoBruto) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-sky-400 font-bold mt-1.5">
                {totalIngresoBruto > 0 ? Math.round((totalTransferencia / totalIngresoBruto) * 100) : 0}% del ingreso bruto
              </p>
            </div>
          )}
        </div>

        {/* Tarjeta */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Tarjeta Débito/Crédito</span>
            <div className="p-2 bg-purple-950 text-purple-400 rounded-xl border border-purple-800">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div>
              <p className="text-xl font-bold text-zinc-100 font-mono">
                ${totalTarjeta.toLocaleString('es-AR')}
              </p>
              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2 border border-zinc-800">
                <div 
                  className="bg-purple-500 h-full transition-all duration-500 shadow-[0_0_8px_#a855f7]" 
                  style={{ width: `${totalIngresoBruto > 0 ? (totalTarjeta / totalIngresoBruto) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-purple-400 font-bold mt-1.5">
                {totalIngresoBruto > 0 ? Math.round((totalTarjeta / totalIngresoBruto) * 100) : 0}% del ingreso bruto
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL DEL GRÁFICO DONA Y TABLA */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-6">
        
        {/* Top Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h4 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-500" />
              {tipoGrafico === 'dona' ? 'Distribución de Ingresos por Método de Pago' : 'Auditoría de Transacciones Registradas'}
            </h4>
            <p className="text-xs text-zinc-400">
              {periodo === 'mes' && 'Visualización del período mensual en curso'}
              {periodo === 'dia' && 'Visualización correspondiente al día de hoy'}
              {periodo === 'anio' && 'Visualización correspondiente al año en curso'}
            </p>
          </div>

          {/* Selector de tipo de vista (Gráfico Dona vs Listado) */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0">
            <button
              onClick={() => setTipoGrafico('dona')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                tipoGrafico === 'dona'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" /> Gráfico Dona
            </button>
            <button
              onClick={() => setTipoGrafico('tabla')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                tipoGrafico === 'tabla'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" /> Listado
            </button>
          </div>
        </div>

        {/* CONTENIDO SEGÚN TIPO DE VISTA */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="py-12">
              <Skeleton count={4} className="h-12 mb-3" />
            </div>
          ) : tipoGrafico === 'dona' ? (
            /* VISTA GRÁFICO DE DONA TECH */
            <motion.div
              key="dona"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4"
            >
              {/* Gráfico Donut de Recharts */}
              <div className="lg:col-span-7 h-72 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<CustomTooltipPie />} />
                    <Pie
                      data={chartDataPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={105}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="transparent"
                    >
                      {chartDataPie.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          style={{
                            filter: totalIngresoBruto > 0 ? `drop-shadow(0px 0px 6px ${entry.color}80)` : 'none'
                          }} 
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Texto Central en la Dona */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Ingreso Bruto</span>
                  <span className="text-2xl font-black font-mono text-zinc-100">
                    ${totalIngresoBruto.toLocaleString('es-AR')}
                  </span>
                  <span className="text-[10px] text-red-500 font-semibold uppercase mt-0.5">
                    {subsFiltradas.length} cobros
                  </span>
                </div>
              </div>

              {/* Leyenda y Desglose Lateral */}
              <div className="lg:col-span-5 space-y-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Desglose del Ingreso por Método
                </h5>

                {/* Card Efectivo */}
                <div className="bg-zinc-950 border border-emerald-500/20 p-4 rounded-xl space-y-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-zinc-200">Efectivo</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ${totalEfectivo.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>{countEfectivo} cobro(s)</span>
                    <span className="font-bold text-zinc-200">
                      {totalIngresoBruto > 0 ? Math.round((totalEfectivo / totalIngresoBruto) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Card Transferencia */}
                <div className="bg-zinc-950 border border-sky-500/20 p-4 rounded-xl space-y-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-zinc-200">Transferencia / MP</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-sky-400">
                      ${totalTransferencia.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>{countTransferencia} cobro(s)</span>
                    <span className="font-bold text-zinc-200">
                      {totalIngresoBruto > 0 ? Math.round((totalTransferencia / totalIngresoBruto) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Card Tarjeta */}
                <div className="bg-zinc-950 border border-purple-500/20 p-4 rounded-xl space-y-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-zinc-200">Tarjeta Débito/Crédito</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-purple-400">
                      ${totalTarjeta.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>{countTarjeta} cobro(s)</span>
                    <span className="font-bold text-zinc-200">
                      {totalIngresoBruto > 0 ? Math.round((totalTarjeta / totalIngresoBruto) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* VISTA TABLA DETALLADA DE TRANSACCIONES */
            <motion.div
              key="tabla"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-2"
            >
              {subsFiltradas.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-8 text-center">No existen cobros registrados en este período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950 uppercase font-bold text-zinc-500 border-b border-zinc-800">
                      <tr>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Plan</th>
                        <th className="p-3">Medio de Pago</th>
                        <th className="p-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {subsFiltradas.map(s => (
                        <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="p-3 font-mono">{formatDateART(s.fecha_inicio)}</td>
                          <td className="p-3 font-semibold text-zinc-200">{s.plan?.nombre || 'General'}</td>
                          <td className="p-3 uppercase font-medium">
                            {s.medio_pago === 'efectivo' && <span className="text-emerald-400 font-bold">Efectivo</span>}
                            {s.medio_pago === 'transferencia' && <span className="text-sky-400 font-bold">Transferencia</span>}
                            {s.medio_pago === 'tarjeta' && <span className="text-purple-400 font-bold">Tarjeta</span>}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-zinc-100">${s.monto_pagado.toLocaleString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
