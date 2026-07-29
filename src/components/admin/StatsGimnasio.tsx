import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, CreditCard, Banknote, Building2, Calendar } from 'lucide-react';
import { Suscripcion } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { getTodayART, formatDateART } from '../../lib/dateUtils';
import { Skeleton } from '../common/Skeleton';

type Periodo = 'dia' | 'mes' | 'anio';

export const StatsGimnasio: React.FC = () => {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
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

  // Filtrar suscripciones del período seleccionado
  const subsFiltradas = suscripciones.filter(s => {
    const fechaCobro = s.fecha_inicio || s.creado_en?.substring(0, 10) || '';
    if (!fechaCobro) return false;

    const [anio, mes, dia] = fechaCobro.split('-');

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

  // Totales
  const totalIngresoBruto = subsFiltradas.reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);
  const totalEfectivo = subsFiltradas.filter(s => s.medio_pago === 'efectivo').reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);
  const totalTransferencia = subsFiltradas.filter(s => s.medio_pago === 'transferencia').reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);
  const totalTarjeta = subsFiltradas.filter(s => s.medio_pago === 'tarjeta').reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);

  return (
    <div className="space-y-8">
      {/* Selector de Período */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">Ingresos del Gimnasio</h3>
            <p className="text-xs text-zinc-400">Resumen financiero por medio de pago</p>
          </div>
        </div>

        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setPeriodo('dia')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              periodo === 'dia' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Hoy (Día)
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              periodo === 'mes' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Este Mes
          </button>
          <button
            onClick={() => setPeriodo('anio')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              periodo === 'anio' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Este Año
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Ingreso Bruto Total */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
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
              <p className="text-2xl font-extrabold text-zinc-100 font-mono">
                ${totalIngresoBruto.toLocaleString('es-AR')}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">{subsFiltradas.length} cobros registrados</p>
            </div>
          )}
        </div>

        {/* Efectivo */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
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
              <p className="text-[11px] text-emerald-400 mt-1">
                {totalIngresoBruto > 0 ? Math.round((totalEfectivo / totalIngresoBruto) * 100) : 0}% del total
              </p>
            </div>
          )}
        </div>

        {/* Transferencia */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
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
              <p className="text-[11px] text-sky-400 mt-1">
                {totalIngresoBruto > 0 ? Math.round((totalTransferencia / totalIngresoBruto) * 100) : 0}% del total
              </p>
            </div>
          )}
        </div>

        {/* Tarjeta */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
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
              <p className="text-[11px] text-purple-400 mt-1">
                {totalIngresoBruto > 0 ? Math.round((totalTarjeta / totalIngresoBruto) * 100) : 0}% del total
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabla Desglose Detallado del Período */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <h4 className="text-sm font-bold text-zinc-100 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-red-500" /> Transacciones Registradas en el Período
        </h4>

        {loading ? (
          <Skeleton count={3} className="h-10 mb-2" />
        ) : subsFiltradas.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-6 text-center">No existen cobros registrados en este período.</p>
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
                  <tr key={s.id} className="hover:bg-zinc-800/30">
                    <td className="p-3 font-mono">{formatDateART(s.fecha_inicio)}</td>
                    <td className="p-3 font-semibold text-zinc-200">{s.plan?.nombre || 'General'}</td>
                    <td className="p-3 uppercase font-medium">{s.medio_pago}</td>
                    <td className="p-3 text-right font-mono font-bold text-zinc-100">${s.monto_pagado.toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
