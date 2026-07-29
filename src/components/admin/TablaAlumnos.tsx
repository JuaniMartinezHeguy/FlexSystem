import React, { useEffect, useState } from 'react';
import { Users, Search, MessageCircle, CreditCard, Eye, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';
import { DetalleAlumnoModal } from './DetalleAlumnoModal';
import { Modal } from '../common/Modal';
import { Usuario, Suscripcion, Plan, MedioPago } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { getTodayART, getDaysRemaining, isSubscriptionExpired, formatDateART, calculateNewExpirationDate } from '../../lib/dateUtils';

type FilterTab = 'todos' | 'al_dia' | 'vencidos';

interface AlumnoConStatus extends Usuario {
  ultimaSub?: Suscripcion;
  diasRestantes: number;
  estaVencido: boolean;
}

export const TablaAlumnos: React.FC = () => {
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
        supabase.from('usuarios').select('*').eq('rol', 'cliente').order('nombre'),
        supabase.from('suscripciones').select('*, plan:planes(*)').order('creado_en', { ascending: false }),
        supabase.from('planes').select('*').eq('activo', true),
        supabase.from('configuracion').select('*').eq('clave', 'whatsapp_recepcion').maybeSingle()
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
      const p = MockStore.getPlanes().filter(x => x.activo);
      const config = MockStore.getConfiguracion();
      const wsConfig = config.find(c => c.clave === 'whatsapp_recepcion');
      if (wsConfig) setWhatsappRecepcion(wsConfig.valor);

      setPlanes(p);
      if (p.length > 0) setCobroPlanId(p[0].id);

      const mapped: AlumnoConStatus[] = users.map(u => {
        const userSub = subs
          .filter(s => s.usuario_id === u.id)
          .sort((a, b) => new Date(b.creado_en || 0).getTime() - new Date(a.creado_en || 0).getTime())[0];
        
        if (userSub) {
          const plan = p.find(x => x.id === userSub.plan_id);
          userSub.plan = plan;
        }

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

  // Filtrado
  const alumnosFiltrados = alumnos.filter(a => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      a.nombre.toLowerCase().includes(q) ||
      a.apellido.toLowerCase().includes(q) ||
      a.dni.includes(q);

    if (!matchesSearch) return false;

    if (activeTab === 'al_dia') return !a.estaVencido;
    if (activeTab === 'vencidos') return a.estaVencido;
    return true;
  });

  const handleOpenWhatsApp = (alumno: AlumnoConStatus) => {
    const targetPhone = alumno.telefono ? alumno.telefono.replace(/\D/g, '') : whatsappRecepcion.replace(/\D/g, '');
    const mensaje = encodeURIComponent(
      `Hola ${alumno.nombre}, te contactamos de IronHouse Gym respecto a tu cuota.`
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
        const { error } = await supabase.from('suscripciones').insert({
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

      setModalCobroAlumno(null);
      await cargarDatos();
    } catch (err: any) {
      alert('Error en cobro: ' + err.message);
    } finally {
      setLoadingCobro(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles de Cabecera: Buscador y Tabs */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0">
          <button
            onClick={() => setActiveTab('todos')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'todos' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos ({alumnos.length})
          </button>
          <button
            onClick={() => setActiveTab('al_dia')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'al_dia' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Cuotas al Día ({alumnos.filter(a => !a.estaVencido).length})
          </button>
          <button
            onClick={() => setActiveTab('vencidos')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'vencidos' ? 'bg-red-950/80 text-red-400 border border-red-800/80' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Cuotas Vencidas ({alumnos.filter(a => a.estaVencido).length})
          </button>
        </div>

        {/* Buscador */}
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/80 text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-4 px-6">Alumno / DNI</th>
                <th className="py-4 px-6">Plan Vigente</th>
                <th className="py-4 px-6">Vencimiento</th>
                <th className="py-4 px-6">Días Restantes</th>
                <th className="py-4 px-6">Estado</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6">
                    <Skeleton count={4} className="h-12 mb-2" />
                  </td>
                </tr>
              ) : alumnosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 text-xs italic">
                    No se encontraron socios que coincidan con la búsqueda o filtro activo.
                  </td>
                </tr>
              ) : (
                alumnosFiltrados.map((alumno) => (
                  <tr key={alumno.id} className="hover:bg-zinc-800/30 transition-colors">
                    {/* Alumno Info */}
                    <td className="py-4 px-6">
                      <button
                        onClick={() => {
                          setSelectedAlumno(alumno);
                          setModalDetalleOpen(true);
                        }}
                        className="text-left group"
                      >
                        <p className="font-bold text-zinc-100 group-hover:text-red-400 transition-colors">
                          {alumno.nombre} {alumno.apellido}
                        </p>
                        <p className="text-xs text-zinc-400 font-mono">DNI: {alumno.dni}</p>
                      </button>
                    </td>

                    {/* Plan */}
                    <td className="py-4 px-6 text-xs text-zinc-300 font-medium">
                      {alumno.ultimaSub?.plan?.nombre || 'Sin Plan Activo'}
                    </td>

                    {/* Vencimiento */}
                    <td className="py-4 px-6 text-xs font-mono text-zinc-300">
                      {alumno.ultimaSub ? formatDateART(alumno.ultimaSub.fecha_vencimiento) : '-'}
                    </td>

                    {/* Días Restantes */}
                    <td className="py-4 px-6 font-semibold text-xs">
                      {alumno.ultimaSub ? (
                        alumno.diasRestantes < 0 ? (
                          <span className="text-red-400 font-bold">{Math.abs(alumno.diasRestantes)} días vencido</span>
                        ) : (
                          <span className="text-emerald-400 font-bold">{alumno.diasRestantes} días</span>
                        )
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>

                    {/* Estado Badge */}
                    <td className="py-4 px-6">
                      {alumno.estaVencido ? (
                        <Badge variant="danger">Vencida</Badge>
                      ) : (
                        <Badge variant="success">Al Día</Badge>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* WhatsApp */}
                        <button
                          onClick={() => handleOpenWhatsApp(alumno)}
                          title="Enviar WhatsApp"
                          className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-950/40 rounded-xl transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        {/* Ficha / Detalle */}
                        <button
                          onClick={() => {
                            setSelectedAlumno(alumno);
                            setModalDetalleOpen(true);
                          }}
                          title="Ver Historial"
                          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Cobro Rápido */}
                        <Button
                          onClick={() => setModalCobroAlumno(alumno)}
                          variant="secondary"
                          size="sm"
                          icon={<CreditCard className="w-3.5 h-3.5 text-red-500" />}
                          className="text-xs font-bold"
                        >
                          Cobrar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ficha Detalle Alumno */}
      <DetalleAlumnoModal
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        alumno={selectedAlumno}
      />

      {/* Modal Cobro Rápido Directo */}
      {modalCobroAlumno && (
        <Modal
          isOpen={!!modalCobroAlumno}
          onClose={() => setModalCobroAlumno(null)}
          title={`Renovar Cuota: ${modalCobroAlumno.nombre} ${modalCobroAlumno.apellido}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-400">
              DNI: <span className="font-mono text-zinc-200">{modalCobroAlumno.dni}</span>
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Plan a Cobrar
              </label>
              <select
                value={cobroPlanId}
                onChange={(e) => setCobroPlanId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100"
              >
                {planes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (${p.precio.toLocaleString('es-AR')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Medio de Pago
              </label>
              <select
                value={cobroMedio}
                onChange={(e) => setCobroMedio(e.target.value as MedioPago)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100"
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia / MercadoPago</option>
                <option value="tarjeta">💳 Tarjeta</option>
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
                Registrar Pago
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
