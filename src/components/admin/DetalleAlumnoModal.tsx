import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';
import { Usuario, Suscripcion, Asistencia } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { formatDateART, getDaysRemaining, isSubscriptionExpired } from '../../lib/dateUtils';
import { Calendar, CreditCard, User, Phone, CheckCircle, Clock } from 'lucide-react';

interface DetalleAlumnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  alumno: Usuario | null;
}

export const DetalleAlumnoModal: React.FC<DetalleAlumnoModalProps> = ({
  isOpen,
  onClose,
  alumno
}) => {
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && alumno) {
      cargarDetalles();
    }
  }, [isOpen, alumno]);

  const cargarDetalles = async () => {
    if (!alumno) return;
    setLoading(true);

    if (isSupabaseConfigured) {
      const [subsRes, asistRes] = await Promise.all([
        supabase.from('suscripciones').select('*, plan:planes(*)').eq('usuario_id', alumno.id).order('creado_en', { ascending: false }),
        supabase.from('asistencias').select('*').eq('usuario_id', alumno.id).order('fecha', { ascending: false }).limit(30)
      ]);

      if (subsRes.data) setSuscripciones(subsRes.data as Suscripcion[]);
      if (asistRes.data) setAsistencias(asistRes.data as Asistencia[]);
    } else {
      const subs = MockStore.getSuscripciones().filter(s => s.usuario_id === alumno.id);
      const planes = MockStore.getPlanes();
      const subsWithPlan = subs.map(s => ({
        ...s,
        plan: planes.find(p => p.id === s.plan_id)
      }));
      setSuscripciones(subsWithPlan as Suscripcion[]);

      const asist = MockStore.getAsistencias().filter(a => a.usuario_id === alumno.id);
      setAsistencias(asist);
    }
    setLoading(false);
  };

  if (!alumno) return null;

  const ultimaSub = suscripciones[0];
  const estaVencida = ultimaSub ? isSubscriptionExpired(ultimaSub.fecha_vencimiento) : true;
  const diasRestantes = ultimaSub ? getDaysRemaining(ultimaSub.fecha_vencimiento) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Detalle del Socio: ${alumno.nombre} ${alumno.apellido}`} maxWidth="lg">
      <div className="space-y-6">
        {/* Ficha Resumen Socio */}
        <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-red-500" />
              <span className="font-bold text-sm text-zinc-100">{alumno.nombre} {alumno.apellido}</span>
            </div>
            <p className="text-xs text-zinc-400">DNI: <span className="font-mono text-zinc-300">{alumno.dni}</span></p>
            {alumno.telefono && (
              <p className="text-xs text-zinc-400 flex items-center gap-1">
                <Phone className="w-3 h-3 text-zinc-500" /> {alumno.telefono}
              </p>
            )}
          </div>

          <div className="text-right space-y-1">
            {ultimaSub ? (
              estaVencida ? (
                <Badge variant="danger">Cuota Vencida</Badge>
              ) : (
                <Badge variant="success">{diasRestantes} días restantes</Badge>
              )
            ) : (
              <Badge variant="warning">Sin Suscripción</Badge>
            )}
            {ultimaSub && (
              <p className="text-[11px] text-zinc-400">
                Plan: <span className="font-semibold text-zinc-200">{ultimaSub.plan?.nombre || 'General'}</span>
              </p>
            )}
          </div>
        </div>

        {/* Tabs / Secciones de Historial */}
        <div className="space-y-4">
          {/* Historial de Pagos */}
          <div>
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-red-500" /> Historial de Pagos & Suscripciones
            </h4>
            {loading ? (
              <Skeleton count={2} className="h-10 mb-2" />
            ) : suscripciones.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No hay registros de pago.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {suscripciones.map(s => (
                  <div key={s.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-zinc-200">{s.plan?.nombre || 'Suscripción'}</span>
                      <p className="text-[11px] text-zinc-500">
                        {formatDateART(s.fecha_inicio)} al {formatDateART(s.fecha_vencimiento)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-zinc-100">${s.monto_pagado.toLocaleString('es-AR')}</span>
                      <p className="text-[10px] text-zinc-400 uppercase">{s.medio_pago}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historial de Asistencias */}
          <div>
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-red-500" /> Últimas Asistencias
            </h4>
            {loading ? (
              <Skeleton count={2} className="h-10" />
            ) : asistencias.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No registra asistencias aún.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
                {asistencias.map(a => (
                  <div key={a.id} className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-zinc-200">{formatDateART(a.fecha)}</p>
                      <span className="text-[10px] text-emerald-400">Presente</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
