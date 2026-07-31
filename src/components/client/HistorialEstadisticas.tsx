import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Award, CheckCircle2, AlertCircle, Percent } from 'lucide-react';
import { Skeleton } from '../common/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { Asistencia } from '../../types/database';
import { isSupabaseConfigured, supabase, supabaseAdmin } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { getTodayART, isSundayART } from '../../lib/dateUtils';

interface DayHeatmap {
  dayNumber: number;
  dateStr: string;
  isSunday: boolean;
  status: 'asistio' | 'falto' | 'libre' | 'futuro';
}

export const HistorialEstadisticas: React.FC = () => {
  const { user, subscription } = useAuth();
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Selector de Mes
  const hoyStr = getTodayART();
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(hoyStr.substring(0, 7)); // YYYY-MM

  useEffect(() => {
    if (user) {
      cargarAsistencias();
    }
  }, [user]);

  const cargarAsistencias = async () => {
    if (!user) return;
    setLoading(true);

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('asistencias')
        .select('*')
        .eq('usuario_id', user.id);

      if (data) setAsistencias(data as Asistencia[]);
    } else {
      const asist = MockStore.getAsistencias().filter(a => a.usuario_id === user.id);
      setAsistencias(asist);
    }
    setLoading(false);
  };

  // Construcción del calendario del mes seleccionado
  const [year, month] = selectedYearMonth.split('-').map(Number);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const daysGrid: DayHeatmap[] = [];
  let asistioCount = 0;
  let habilesCount = 0;

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dayPadded = String(d).padStart(2, '0');
    const dateStr = `${selectedYearMonth}-${dayPadded}`;
    const isSunday = isSundayART(dateStr);
    const isFuture = dateStr > hoyStr;

    const record = asistencias.find(a => a.fecha === dateStr);
    let status: 'asistio' | 'falto' | 'libre' | 'futuro' = 'libre';

    if (isFuture) {
      status = 'futuro';
    } else if (isSunday) {
      status = 'libre';
    } else {
      habilesCount++;
      if (record && record.asistio) {
        status = 'asistio';
        asistioCount++;
      } else {
        status = 'falto';
      }
    }

    daysGrid.push({
      dayNumber: d,
      dateStr,
      isSunday,
      status
    });
  }

  const porcentajeEfectividad = habilesCount > 0 ? Math.round((asistioCount / habilesCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-24">
      {/* Header Selector de Mes */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Historial de Asistencia</h3>
            <p className="text-xs text-zinc-400">Resumen y mapa de calor mensual</p>
          </div>
        </div>

        <input
          type="month"
          value={selectedYearMonth}
          onChange={(e) => setSelectedYearMonth(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-red-500"
        />
      </div>

      {/* Cards de Métricas Mensuales */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl text-center space-y-1 shadow-lg">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
          <p className="text-2xl font-black text-zinc-100 font-mono">{asistioCount}</p>
          <span className="text-[10px] uppercase font-bold text-zinc-400">Días Asistidos</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl text-center space-y-1 shadow-lg">
          <Percent className="w-6 h-6 text-red-500 mx-auto" />
          <p className="text-2xl font-black text-red-500 font-mono">{porcentajeEfectividad}%</p>
          <span className="text-[10px] uppercase font-bold text-zinc-400">Efectividad</span>
        </div>
      </div>

      {/* MAPA DE CALOR (HEATMAP CALENDAR) */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4 shadow-xl">
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
          Calendario del Mes ({selectedYearMonth})
        </h4>

        {loading ? (
          <Skeleton count={4} className="h-10" />
        ) : (
          <div className="grid grid-cols-7 gap-2 text-center">
            {/* Headers Días */}
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
              <span key={d} className="text-[10px] font-bold text-zinc-500 uppercase">{d}</span>
            ))}

            {/* Grid Días */}
            {daysGrid.map(day => {
              let bg = 'bg-zinc-950 text-zinc-600 border-zinc-900';
              if (day.status === 'asistio') bg = 'bg-emerald-950 text-emerald-400 border-emerald-800 font-bold';
              else if (day.status === 'falto') bg = 'bg-red-950/60 text-red-400 border-red-900/60';
              else if (day.status === 'libre') bg = 'bg-zinc-900/50 text-zinc-500 border-zinc-800';

              return (
                <div
                  key={day.dayNumber}
                  className={`h-10 rounded-xl border flex items-center justify-center text-xs ${bg}`}
                  title={`${day.dateStr}: ${day.status}`}
                >
                  {day.dayNumber}
                </div>
              );
            })}
          </div>
        )}

        {/* Leyenda */}
        <div className="flex items-center justify-around text-[10px] text-zinc-400 pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Asistió
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Faltó
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700"></span> Libre / Dom
          </div>
        </div>
      </div>
    </div>
  );
};
