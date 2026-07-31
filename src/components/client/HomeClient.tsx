import React, { useEffect, useState } from 'react';
import { 
  Flame, 
  CheckCircle2, 
  XCircle, 
  Dumbbell, 
  Award
} from 'lucide-react';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { Badge } from '../common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Rutina, Ejercicio } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { 
  getTodayART, 
  getDaysRemaining, 
  formatDateART, 
  getTodayDayOfWeekART, 
  getCurrentWeekRangeART, 
  isSundayART 
} from '../../lib/dateUtils';

export const HomeClient: React.FC = () => {
  const { user, subscription } = useAuth();
  const [loading, setLoading] = useState(true);

  // Asistencia del día de hoy
  const [asistenciaHoy, setAsistenciaHoy] = useState<boolean | null>(null);
  const [asistenciasSemana, setAsistenciasSemana] = useState<number>(0);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);

  // Rutina del día de hoy
  const [rutinaHoy, setRutinaHoy] = useState<Rutina | null>(null);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);

  const hoyStr = getTodayART();
  const diaSemanaHoy = getTodayDayOfWeekART();
  const esDomingo = isSundayART(hoyStr);
  const diasRestantes = subscription ? getDaysRemaining(subscription.fecha_vencimiento) : 0;
  const metaPlan = subscription?.plan?.meta_dias_semana; // null = libre

  useEffect(() => {
    if (user) {
      cargarHomeData();
    }
  }, [user]);

  const cargarHomeData = async () => {
    if (!user) return;
    setLoading(true);

    const { lunes, sabado } = getCurrentWeekRangeART();

    if (isSupabaseConfigured) {
      // 1. Asistencia de hoy y semana
      const [asistHoyRes, asistSemanaRes, rutinaRes] = await Promise.all([
        supabase.from('asistencias').select('*').eq('usuario_id', user.id).eq('fecha', hoyStr).maybeSingle(),
        supabase.from('asistencias').select('*').eq('usuario_id', user.id).gte('fecha', lunes).lte('fecha', sabado).eq('asistio', true),
        diaSemanaHoy !== 'Domingo'
          ? supabase.from('rutinas').select('*, ejercicios(*)').eq('usuario_id', user.id).eq('dia_semana', diaSemanaHoy).maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      if (asistHoyRes.data) {
        setAsistenciaHoy(asistHoyRes.data.asistio);
      } else {
        setAsistenciaHoy(null);
      }

      setAsistenciasSemana(asistSemanaRes.data ? asistSemanaRes.data.length : 0);

      if (rutinaRes.data) {
        const r = rutinaRes.data as Rutina;
        setRutinaHoy(r);
        const ejs = (r.ejercicios || []).sort((a, b) => a.orden - b.orden);
        setEjercicios(ejs);
      }
    } else {
      // Modo Mock
      const asist = MockStore.getAsistencias().filter(a => a.usuario_id === user.id);
      const hoyAsist = asist.find(a => a.fecha === hoyStr);
      setAsistenciaHoy(hoyAsist ? hoyAsist.asistio : null);

      const semanaAsist = asist.filter(a => a.fecha >= lunes && a.fecha <= sabado && a.asistio);
      setAsistenciasSemana(semanaAsist.length);

      if (diaSemanaHoy !== 'Domingo') {
        const rutinas = MockStore.getRutinas(user.id);
        const r = rutinas.find(r => r.dia_semana === diaSemanaHoy);
        if (r) {
          setRutinaHoy(r);
          const ejs = MockStore.getEjercicios(r.id).sort((a, b) => a.orden - b.orden);
          setEjercicios(ejs);
        }
      }
    }
    setLoading(false);
  };

  // Marcar Asistencia (Sí / No)
  const handleMarcarAsistencia = async (asistioVal: boolean) => {
    if (!user) return;
    setLoadingAsistencia(true);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('asistencias').upsert({
          usuario_id: user.id,
          fecha: hoyStr,
          asistio: asistioVal
        });
        if (error) throw error;
      } else {
        const asist = MockStore.getAsistencias();
        const existingIdx = asist.findIndex(a => a.usuario_id === user.id && a.fecha === hoyStr);
        if (existingIdx >= 0) {
          asist[existingIdx].asistio = asistioVal;
        } else {
          asist.push({
            id: `a-${Date.now()}`,
            usuario_id: user.id,
            fecha: hoyStr,
            asistio: asistioVal,
            creado_en: new Date().toISOString()
          });
        }
        MockStore.saveAsistencias(asist);
      }

      setAsistenciaHoy(asistioVal);
      await cargarHomeData();
    } catch (err: any) {
      alert('Error registrando asistencia: ' + err.message);
    } finally {
      setLoadingAsistencia(false);
    }
  };

  const metaCumplida = metaPlan !== null && metaPlan !== undefined && asistenciasSemana >= metaPlan;

  return (
    <div className="space-y-6 pb-24">
      {/* Targeta Resumen Cuota */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/30 border border-zinc-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Membresía Activa</span>
          <h2 className="text-xl font-black text-zinc-100">{subscription?.plan?.nombre || 'Pase General'}</h2>
          <p className="text-xs text-zinc-400">
            Vence: <span className="font-mono text-zinc-200">{formatDateART(subscription?.fecha_vencimiento)}</span>
          </p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-black font-mono text-red-500">{diasRestantes}</div>
          <span className="text-[10px] font-bold uppercase text-zinc-400">Días Restantes</span>
        </div>
      </div>

      {/* BANNER ASISTENCIA DEL DÍA */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-500 animate-pulse" />
            <h3 className="text-sm font-bold text-zinc-100">Asistencia de Hoy ({diaSemanaHoy})</h3>
          </div>
          {metaPlan !== null && metaPlan !== undefined && (
            <Badge variant={metaCumplida ? 'success' : 'info'}>
              Meta: {asistenciasSemana}/{metaPlan} días
            </Badge>
          )}
        </div>

        {esDomingo ? (
          <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl text-center text-xs text-zinc-400">
            ☀️ Hoy Domingo es día libre de descanso. Los domingos no restan efectividad a tu meta.
          </div>
        ) : metaCumplida ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-center space-y-1">
            <Award className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-emerald-400 text-sm">¡Meta Semanal Cumplida! ({asistenciasSemana}/{metaPlan})</h4>
            <p className="text-[11px] text-zinc-400">¡Excelente constancia! Nos vemos el próximo lunes para el reseteo.</p>
          </div>
        ) : asistenciaHoy === true ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> ¡Asistencia de hoy registrada!
            </span>
            <button
              onClick={() => handleMarcarAsistencia(false)}
              className="text-[10px] text-zinc-400 underline hover:text-zinc-200"
            >
              Cambiar a No
            </button>
          </div>
        ) : asistenciaHoy === false ? (
          <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-2xl flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" /> Registrado como no asistido hoy.
            </span>
            <button
              onClick={() => handleMarcarAsistencia(true)}
              className="text-[10px] text-red-400 underline font-bold"
            >
              Cambiar a Sí
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-300 text-center font-medium">¿Fuiste a entrenar hoy al gimnasio?</p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleMarcarAsistencia(true)}
                variant="primary"
                loading={loadingAsistencia}
                icon={<CheckCircle2 className="w-4 h-4" />}
                className="flex-1 font-bold text-xs shadow-red-600/20"
              >
                Sí, Fui a Entrenar
              </Button>
              <Button
                onClick={() => handleMarcarAsistencia(false)}
                variant="secondary"
                loading={loadingAsistencia}
                icon={<XCircle className="w-4 h-4" />}
                className="flex-1 text-xs"
              >
                No Fui
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* RUTINA DEL DÍA ACTUAL */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-red-500" /> Rutina de Hoy ({diaSemanaHoy})
          </h3>
        </div>

        {loading ? (
          <Skeleton count={3} className="h-16" />
        ) : esDomingo ? (
          <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-3xl text-xs text-zinc-400">
            Día de descanso programado.
          </div>
        ) : !rutinaHoy || ejercicios.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-3xl text-xs text-zinc-400 space-y-2">
            <p>No tienes ejercicios cargados para el día {diaSemanaHoy}.</p>
            <p className="text-[11px] text-zinc-500">Puedes cargar tu rutina en la pestaña "Mi Rutina".</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl flex items-center justify-between">
              <span className="font-extrabold text-sm text-red-400">{rutinaHoy.titulo_grupo}</span>
              <Badge variant="neutral">{ejercicios.length} ejercicios</Badge>
            </div>

            {ejercicios.map((ej, index) => (
              <div
                key={ej.id}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-md hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 text-red-500 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-zinc-100 text-sm">{ej.nombre}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      <span className="text-zinc-200 font-semibold">{ej.series} series</span> ×{' '}
                      <span className="text-zinc-200 font-semibold">{ej.repeticiones} reps</span>
                    </p>
                  </div>
                </div>

                <Badge variant="neutral" className="text-[11px] font-semibold text-zinc-300">
                  {ej.series}×{ej.repeticiones}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
