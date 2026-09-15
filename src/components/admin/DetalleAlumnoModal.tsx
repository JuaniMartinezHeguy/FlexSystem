import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { Usuario, Suscripcion, Asistencia } from '../../types/database';
import { isSupabaseConfigured, supabaseAdmin } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { formatDateART, getDaysRemaining, isSubscriptionExpired } from '../../lib/dateUtils';
import { useToast } from '../../context/ToastContext';
import { Calendar, CreditCard, User, Phone, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface DetalleAlumnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  alumno: Usuario | null;
  onAlumnoEliminado?: () => void;
}

export const DetalleAlumnoModal: React.FC<DetalleAlumnoModalProps> = ({
  isOpen,
  onClose,
  alumno,
  onAlumnoEliminado
}) => {
  const { showToast } = useToast();
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && alumno) {
      setConfirmDelete(false);
      cargarDetalles();
    }
  }, [isOpen, alumno]);

  const cargarDetalles = async () => {
    if (!alumno) return;
    setLoading(true);

    if (isSupabaseConfigured) {
      const [subsRes, asistRes] = await Promise.all([
        supabaseAdmin.from('suscripciones').select('*, plan:planes(*)').eq('usuario_id', alumno.id).order('creado_en', { ascending: false }),
        supabaseAdmin.from('asistencias').select('*').eq('usuario_id', alumno.id).order('fecha', { ascending: false }).limit(30)
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

  const handleEliminarAlumno = async () => {
    if (!alumno) return;
    setDeleting(true);
    try {
      if (isSupabaseConfigured) {
        // 1. Borrar de base de datos relacional (cascada de FK elimina suscripciones, rutinas, asistencias)
        const { error: dbError } = await supabaseAdmin
          .from('usuarios')
          .delete()
          .eq('id', alumno.id);

        if (dbError) throw dbError;

        // 2. Intentar borrar de Supabase Auth si hay Service Role Key
        try {
          if (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
            const adminAuthClient = createClient(
              import.meta.env.VITE_SUPABASE_URL,
              import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
              { auth: { persistSession: false, autoRefreshToken: false } }
            );
            await adminAuthClient.auth.admin.deleteUser(alumno.id);
          }
        } catch (authErr) {
          console.warn('Nota: No se pudo eliminar de auth.users o no hay permisos suficientes:', authErr);
        }
      } else {
        MockStore.deleteUsuario(alumno.id);
      }

      showToast(`Alumno ${alumno.nombre} ${alumno.apellido} eliminado con éxito.`, 'success');
      setConfirmDelete(false);
      onClose();
      if (onAlumnoEliminado) {
        onAlumnoEliminado();
      }
    } catch (err: any) {
      console.error('Error al eliminar alumno:', err);
      showToast(err.message || 'No se pudo eliminar al alumno.', 'error');
    } finally {
      setDeleting(false);
    }
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

        {/* Zona de Eliminación */}
        <div className="pt-4 border-t border-zinc-800/80">
          {!confirmDelete ? (
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-zinc-500">
                Acción administrativa
              </span>
              <Button
                onClick={() => setConfirmDelete(true)}
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-4 h-4 text-red-400" />}
                className="text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/30 text-xs font-semibold"
              >
                Eliminar Alumno
              </Button>
            </div>
          ) : (
            <div className="bg-red-950/30 border border-red-800/60 p-3.5 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-red-200">¿Eliminar definitivamente a {alumno.nombre} {alumno.apellido}?</p>
                  <p className="text-zinc-400 mt-0.5 leading-relaxed">
                    Se borrará el socio, su usuario y todo su historial de pagos, rutinas y asistencias. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  onClick={() => setConfirmDelete(false)}
                  variant="ghost"
                  size="sm"
                  disabled={deleting}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleEliminarAlumno}
                  variant="danger"
                  size="sm"
                  loading={deleting}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  className="text-xs font-bold bg-red-600 hover:bg-red-500 text-white"
                >
                  Sí, Eliminar Alumno
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
