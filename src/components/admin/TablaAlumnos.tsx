import React, { useEffect, useState } from 'react';
import { Users, Search, MessageCircle, CreditCard, Eye, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';
import { DetalleAlumnoModal } from './DetalleAlumnoModal';
import { Modal } from '../common/Modal';
import { Usuario, Suscripcion, Plan, MedioPago } from '../../types/database';
import { isSupabaseConfigured, supabase, supabaseAdmin } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { getTodayART, getDaysRemaining, isSubscriptionExpired, formatDateART, calculateNewExpirationDate } from '../../lib/dateUtils';
import { useToast } from '../../context/ToastContext';

type FilterTab = 'todos' | 'al_dia' | 'vencidos';

interface AlumnoConStatus extends Usuario {
  ultimaSub?: Suscripcion;
  diasRestantes: number;
  estaVencido: boolean;
}

export const TablaAlumnos: React.FC = () => {
  const { showToast } = useToast();
  const [alumnos, setAlumnos] = useState<AlumnoConStatus[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [whatsappRecepcion, setWhatsappRecepcion] = useState('5491100000000');

  // Modal Detalle
  const [selectedAlumno, setSelectedAlumno] = useState<Usuario | null>(null);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);

  // Modal Cobro Rápido Directo
  const [modalCobroAlumno, setModalCobroAlumno] = useState<AlumnoConStatus | null>(null);
  const [cobroPlanId, setCobroPlanId] = useState('');
  const [cobroMedio, setCobroMedio] = useState<MedioPago>('efectivo');
  const [loadingCobro, setLoadingCobro] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    if (isSupabaseConfigured) {
      const [usersRes, subsRes, planesRes, configRes] = await Promise.all([
        supabaseAdmin.from('usuarios').select('*').eq('rol', 'cliente').order('nombre'),
        supabaseAdmin.from('suscripciones').select('*, plan:planes(*)').order('creado_en', { ascending: false }),
        supabaseAdmin.from('planes').select('*').eq('activo', true),
        supabaseAdmin.from('configuracion').select('*').eq('clave', 'whatsapp_recepcion').maybeSingle()
      ]);

      if (configRes.data) {
        setWhatsappRecepcion(configRes.data.valor);
      }

      if (planesRes.data) {
        setPlanes(planesRes.data);
        if (planesRes.data.length > 0) setCobroPlanId(planesRes.data[0].id);
      }

      if (usersRes.data) {
        const users = usersRes.data as Usuario[];
        const subs = (subsRes.data || []) as Suscripcion[];

        const mapped: AlumnoConStatus[] = users.map(u => {
          const userSub = subs.find(s => s.usuario_id === u.id);
          const diasRestantes = userSub ? getDaysRemaining(userSub.fecha_vencimiento) : -999;
          const estaVencido = userSub ? isSubscriptionExpired(userSub.fecha_vencimiento) : true;

          return {
            ...u,
            ultimaSub: userSub,
            diasRestantes,
            estaVencido
          };
        });

        setAlumnos(mapped);
      }
    } else {
      const users = MockStore.getUsuarios().filter(u => u.rol === 'cliente');
      const subs = MockStore.getSuscripciones();
      const pList = MockStore.getPlanes().filter(p => p.activo);
      setPlanes(pList);
      if (pList.length > 0) setCobroPlanId(pList[0].id);

      const cfg = MockStore.getConfiguracion();
      const ws = cfg.find(c => c.clave === 'whatsapp_recepcion');
      if (ws) setWhatsappRecepcion(ws.valor);

      const mapped: AlumnoConStatus[] = users.map(u => {
        const userSubs = subs
          .filter(s => s.usuario_id === u.id)
          .sort((a, b) => new Date(b.creado_en || 0).getTime() - new Date(a.creado_en || 0).getTime());
        const userSub = userSubs[0];
        const diasRestantes = userSub ? getDaysRemaining(userSub.fecha_vencimiento) : -999;
        const estaVencido = userSub ? isSubscriptionExpired(userSub.fecha_vencimiento) : true;

        return {
          ...u,
          ultimaSub: userSub,
          diasRestantes,
          estaVencido
        };
      });

      setAlumnos(mapped);
    }
    setLoading(false);
  };

  // Filtrar alumnos por pestaña y buscador
  const alumnosFiltrados = alumnos.filter(a => {
    const queryMatch =
      a.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.apellido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.dni.includes(searchQuery);

    if (!queryMatch) return false;

    if (activeTab === 'al_dia') return !a.estaVencido;
    if (activeTab === 'vencidos') return a.estaVencido;

    return true;
  });

  const handleOpenWhatsApp = (alumno: AlumnoConStatus) => {
    const targetPhone = alumno.telefono ? alumno.telefono.replace(/\D/g, '') : whatsappRecepcion.replace(/\D/g, '');
    const mensaje = encodeURIComponent(
      `Hola ${alumno.nombre}, te contactamos de Flex Gym respecto a tu cuota.`
    );
    window.open(`https://wa.me/${targetPhone}?text=${mensaje}`, '_blank');
  };

  const handleConfirmarCobroDirecto = async () => {
    if (!modalCobroAlumno) return;
    setLoadingCobro(true);

    const hoy = getTodayART();
    const plan = planes.find(p => p.id === cobroPlanId);
    const duracion = plan ? plan.dias_duracion : 30;
    const precio = plan ? plan.precio : 0;
    const nuevaFechaVenc = calculateNewExpirationDate(modalCobroAlumno.ultimaSub?.fecha_vencimiento, duracion);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabaseAdmin.from('suscripciones').insert({
          usuario_id: modalCobroAlumno.id,
          plan_id: cobroPlanId,
          monto_pagado: precio,
          medio_pago: cobroMedio,
          fecha_inicio: hoy,
          fecha_vencimiento: nuevaFechaVenc,
          estado: 'activa'
        });
        if (error) throw error;
      } else {
        const newSub: Suscripcion = {
          id: `sub-${Date.now()}`,
          usuario_id: modalCobroAlumno.id,
          plan_id: cobroPlanId,
          monto_pagado: precio,
          medio_pago: cobroMedio,
          fecha_inicio: hoy,
          fecha_vencimiento: nuevaFechaVenc,
          estado: 'activa',
          creado_en: new Date().toISOString()
        };
        MockStore.saveSuscripciones([...MockStore.getSuscripciones(), newSub]);
      }

      showToast(
        'Pago Registrado',
        `Cuota de ${modalCobroAlumno.nombre} extendida hasta ${formatDateART(nuevaFechaVenc)}.`,
        'success'
      );
      setModalCobroAlumno(null);
      await cargarDatos();
    } catch (err: any) {
      showToast('Error Procesando Cobro', err.message, 'error');
    } finally {
      setLoadingCobro(false);
    }
  };

  const cantTodos = alumnos.length;
  const cantAlDia = alumnos.filter(a => !a.estaVencido).length;
  const cantVencidos = alumnos.filter(a => a.estaVencido).length;

  return (
    <div className="space-y-6">
      {/* Top Bar: Buscador y Filtros */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'todos' ? 'bg-red-600 text-white shadow-md shadow-red-600/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos ({cantTodos})
          </button>
          <button
            onClick={() => setActiveTab('al_dia')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'al_dia' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Al Día ({cantAlDia})
          </button>
          <button
            onClick={() => setActiveTab('vencidos')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'vencidos' ? 'bg-red-950 text-red-400 border border-red-800/80 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Vencidos ({cantVencidos})
          </button>
        </div>

        <div className="w-full md:w-72">
          <Input
            placeholder="Buscar por DNI o Nombre..."
            icon={<Search className="w-4 h-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla de Alumnos */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-6">
            <Skeleton count={5} className="h-12 mb-3" />
          </div>
        ) : alumnosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            No se encontraron alumnos con el filtro seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 uppercase font-bold text-[11px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="p-4">Alumno / DNI</th>
                  <th className="p-4">Plan Actual</th>
                  <th className="p-4">Vencimiento</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {alumnosFiltrados.map((alumno) => (
                  <tr key={alumno.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-zinc-100 text-sm">
                        {alumno.nombre} {alumno.apellido}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">DNI: {alumno.dni}</div>
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-zinc-200">
                        {alumno.ultimaSub?.plan?.nombre || 'Sin Plan'}
                      </span>
                    </td>

                    <td className="p-4 font-mono">
                      {alumno.ultimaSub ? (
                        <div
                          className={`font-semibold ${
                            alumno.estaVencido
                              ? 'text-red-400 font-bold'
                              : alumno.diasRestantes <= 5
                              ? 'text-amber-400 font-bold'
                              : 'text-emerald-400'
                          }`}
                        >
                          {alumno.estaVencido
                            ? `Vencido hace ${Math.abs(alumno.diasRestantes)} ${Math.abs(alumno.diasRestantes) === 1 ? 'día' : 'días'}`
                            : `Quedan ${alumno.diasRestantes} ${alumno.diasRestantes === 1 ? 'día' : 'días'}`}
                        </div>
                      ) : (
                        <span className="text-zinc-500 italic">Sin cuota activa</span>
                      )}
                    </td>

                    <td className="p-4">
                      {alumno.estaVencido ? (
                        <Badge variant="danger">Vencida</Badge>
                      ) : alumno.diasRestantes <= 5 ? (
                        <Badge variant="warning">Por Vencer</Badge>
                      ) : (
                        <Badge variant="success">Al Día</Badge>
                      )}
                    </td>

                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => setModalCobroAlumno(alumno)}
                        title="Cobrar / Renovar Cuota"
                        className="p-2 text-red-400 hover:bg-red-950/60 rounded-xl transition-colors border border-red-800/40 inline-flex items-center gap-1 font-semibold text-[11px]"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span className="hidden sm:inline">Cobrar</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAlumno(alumno);
                          setModalDetalleOpen(true);
                        }}
                        title="Ver detalle de rutinas y asistencias"
                        className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">Detalle</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalle Alumno (Rutina + Asistencias) */}
      <DetalleAlumnoModal
        alumno={selectedAlumno}
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        onAlumnoEliminado={cargarDatos}
      />

      {/* Modal Cobro Rápido Directo desde la Tabla */}
      <Modal
        isOpen={!!modalCobroAlumno}
        onClose={() => setModalCobroAlumno(null)}
        title={`Cobrar Cuota — ${modalCobroAlumno?.nombre} ${modalCobroAlumno?.apellido}`}
      >
        <div className="space-y-4">
          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1 text-xs">
            <p className="text-zinc-400">DNI: <span className="font-mono text-zinc-200 font-bold">{modalCobroAlumno?.dni}</span></p>
            <p className="text-zinc-400">
              Vencimiento previo:{' '}
              <span className="font-mono text-zinc-200 font-bold">
                {modalCobroAlumno?.ultimaSub ? formatDateART(modalCobroAlumno.ultimaSub.fecha_vencimiento) : 'Ninguno'}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1.5">
              Plan a Cobrar / Renovar
            </label>
            <select
              value={cobroPlanId}
              onChange={(e) => setCobroPlanId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100"
            >
              {planes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — ${p.precio.toLocaleString('es-AR')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1.5">
              Medio de Pago
            </label>
            <select
              value={cobroMedio}
              onChange={(e) => setCobroMedio(e.target.value as MedioPago)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              onClick={() => setModalCobroAlumno(null)}
              variant="ghost"
              className="flex-1 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarCobroDirecto}
              variant="primary"
              loading={loadingCobro}
              className="flex-1 text-xs font-bold"
            >
              Confirmar Pago
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
