import React, { useState, useEffect } from 'react';
import { UserPlus, Search, CreditCard, CheckCircle2, Copy, Eye, AlertCircle, Dumbbell } from 'lucide-react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Plan, Usuario, Suscripcion, MedioPago } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { generateInitialPassword, dniToEmail } from '../../lib/authHelpers';
import { getTodayART, calculateNewExpirationDate, formatDateART, isSubscriptionExpired } from '../../lib/dateUtils';

interface RegistroCobroRapidoProps {
  onNavigateToAlumnos: () => void;
}

export const RegistroCobroRapido: React.FC<RegistroCobroRapidoProps> = ({ onNavigateToAlumnos }) => {
  // Estado Formulario Nuevo Alumno
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [planId, setPlanId] = useState('');
  const [medioPago, setMedioPago] = useState<MedioPago>('efectivo');
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loadingAlta, setLoadingAlta] = useState(false);
  const [errorAlta, setErrorAlta] = useState('');

  // Modal Clave Generada
  const [modalClave, setModalClave] = useState<{ open: boolean; nombre: string; dni: string; pass: string }>({
    open: false,
    nombre: '',
    dni: '',
    pass: ''
  });
  const [copied, setCopied] = useState(false);

  // Estado Buscador Cobro Existente
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ usuario: Usuario; sub?: Suscripcion } | null>(null);
  const [searching, setSearching] = useState(false);
  const [renovandoPlanId, setRenovandoPlanId] = useState('');
  const [renovandoMedio, setRenovandoMedio] = useState<MedioPago>('efectivo');
  const [loadingRenovar, setLoadingRenovar] = useState(false);
  const [mensajeExitoRenovacion, setMensajeExitoRenovacion] = useState('');

  useEffect(() => {
    cargarPlanes();
  }, []);

  const cargarPlanes = async () => {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('planes').select('*').eq('activo', true);
      if (data) {
        setPlanes(data);
        if (data.length > 0) {
          setPlanId(data[0].id);
          setRenovandoPlanId(data[0].id);
        }
      }
    } else {
      const p = MockStore.getPlanes().filter(x => x.activo);
      setPlanes(p);
      if (p.length > 0) {
        setPlanId(p[0].id);
        setRenovandoPlanId(p[0].id);
      }
    }
  };

  // Alta de Alumno Nuevo
  const handleAltaAlumno = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlta('');

    const cleanDNI = dni.trim().replace(/\D/g, '');
    if (!cleanDNI || cleanDNI.length < 7) {
      setErrorAlta('Ingrese un DNI válido de al menos 7 dígitos.');
      return;
    }
    if (!nombre.trim() || !apellido.trim()) {
      setErrorAlta('Nombre y apellido son obligatorios.');
      return;
    }
    if (!planId) {
      setErrorAlta('Seleccione un plan inicial.');
      return;
    }

    setLoadingAlta(true);
    const initialPass = generateInitialPassword(cleanDNI);
    const hoy = getTodayART();
    const planSeleccionado = planes.find(p => p.id === planId);
    const duracion = planSeleccionado ? planSeleccionado.dias_duracion : 30;
    const precio = planSeleccionado ? planSeleccionado.precio : 0;
    const nuevaFechaVenc = calculateNewExpirationDate(null, duracion);

    try {
      if (isSupabaseConfigured) {
        // 1. Crear usuario en Auth de Supabase con email sintético
        const email = dniToEmail(cleanDNI);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: initialPass,
          options: {
            data: { nombre, apellido, dni: cleanDNI, rol: 'cliente' }
          }
        });

        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error('No se pudo crear el usuario en Auth.');

        const userId = authData.user.id;

        // 2. Insertar fila en public.usuarios
        const { error: userError } = await supabase.from('usuarios').insert({
          id: userId,
          dni: cleanDNI,
          nombre,
          apellido,
          telefono: telefono.trim() || null,
          rol: 'cliente'
        });

        if (userError) throw userError;

        // 3. Registrar primera suscripción
        const { error: subError } = await supabase.from('suscripciones').insert({
          usuario_id: userId,
          plan_id: planId,
          monto_pagado: precio,
          medio_pago: medioPago,
          fecha_inicio: hoy,
          fecha_vencimiento: nuevaFechaVenc,
          estado: 'activa'
        });

        if (subError) throw subError;
      } else {
        // Modo Mock
        const usuarios = MockStore.getUsuarios();
        if (usuarios.some(u => u.dni === cleanDNI)) {
          throw new Error('Ya existe un alumno registrado con este DNI.');
        }

        const newUserId = `usr-${Date.now()}`;
        const newUsuario: Usuario = {
          id: newUserId,
          dni: cleanDNI,
          nombre,
          apellido,
          telefono: telefono.trim() || null,
          rol: 'cliente',
          creado_en: new Date().toISOString()
        };

        const newSub: Suscripcion = {
          id: `sub-${Date.now()}`,
          usuario_id: newUserId,
          plan_id: planId,
          monto_pagado: precio,
          medio_pago: medioPago,
          fecha_inicio: hoy,
          fecha_vencimiento: nuevaFechaVenc,
          estado: 'activa',
          creado_en: new Date().toISOString()
        };

        MockStore.saveUsuarios([...usuarios, newUsuario]);
        MockStore.saveSuscripciones([...MockStore.getSuscripciones(), newSub]);
      }

      // Éxito -> Mostrar modal con la clave inicial
      setModalClave({
        open: true,
        nombre: `${nombre} ${apellido}`,
        dni: cleanDNI,
        pass: initialPass
      });

      // Limpiar formulario
      setDni('');
      setNombre('');
      setApellido('');
      setTelefono('');
    } catch (err: any) {
      setErrorAlta(err.message || 'Error al procesar el alta del alumno.');
    } finally {
      setLoadingAlta(false);
    }
  };

  // Buscar alumno existente para cobro
  const handleBuscarAlumno = async (queryStr: string) => {
    const q = queryStr.trim().toLowerCase();
    setSearchQuery(queryStr);
    if (!q) {
      setSearchResult(null);
      return;
    }

    setSearching(true);
    if (isSupabaseConfigured) {
      const { data: users } = await supabase
        .from('usuarios')
        .select('*')
        .or(`dni.ilike.%${q}%,nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
        .limit(1);

      if (users && users.length > 0) {
        const u = users[0] as Usuario;
        const { data: subs } = await supabase
          .from('suscripciones')
          .select('*, plan:planes(*)')
          .eq('usuario_id', u.id)
          .order('creado_en', { ascending: false })
          .limit(1);

        setSearchResult({
          usuario: u,
          sub: subs && subs.length > 0 ? (subs[0] as Suscripcion) : undefined
        });
      } else {
        setSearchResult(null);
      }
    } else {
      const usuarios = MockStore.getUsuarios();
      const found = usuarios.find(
        u => u.dni.includes(q) || u.nombre.toLowerCase().includes(q) || u.apellido.toLowerCase().includes(q)
      );

      if (found) {
        const subs = MockStore.getSuscripciones();
        const sub = subs
          .filter(s => s.usuario_id === found.id)
          .sort((a, b) => new Date(b.creado_en || 0).getTime() - new Date(a.creado_en || 0).getTime())[0];
        setSearchResult({ usuario: found, sub });
      } else {
        setSearchResult(null);
      }
    }
    setSearching(false);
  };

  // Renovar Cuota Alumno Existente
  const handleRenovarCuota = async () => {
    if (!searchResult) return;
    setLoadingRenovar(true);
    setMensajeExitoRenovacion('');

    const hoy = getTodayART();
    const planSeleccionado = planes.find(p => p.id === renovandoPlanId);
    const duracion = planSeleccionado ? planSeleccionado.dias_duracion : 30;
    const precio = planSeleccionado ? planSeleccionado.precio : 0;

    const fechaActualVenc = searchResult.sub?.fecha_vencimiento;
    const nuevaFechaVenc = calculateNewExpirationDate(fechaActualVenc, duracion);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('suscripciones').insert({
          usuario_id: searchResult.usuario.id,
          plan_id: renovandoPlanId,
          monto_pagado: precio,
          medio_pago: renovandoMedio,
          fecha_inicio: hoy,
          fecha_vencimiento: nuevaFechaVenc,
          estado: 'activa'
        });
        if (error) throw error;
      } else {
        const newSub: Suscripcion = {
          id: `sub-${Date.now()}`,
          usuario_id: searchResult.usuario.id,
          plan_id: renovandoPlanId,
          monto_pagado: precio,
          medio_pago: renovandoMedio,
          fecha_inicio: hoy,
          fecha_vencimiento: nuevaFechaVenc,
          estado: 'activa',
          creado_en: new Date().toISOString()
        };

        MockStore.saveSuscripciones([...MockStore.getSuscripciones(), newSub]);
      }

      setMensajeExitoRenovacion(`¡Pago registrado! Nueva fecha de vencimiento: ${formatDateART(nuevaFechaVenc)}`);
      // Refrescar resultado
      handleBuscarAlumno(searchQuery);
    } catch (err: any) {
      alert('Error renovando cuota: ' + err.message);
    } finally {
      setLoadingRenovar(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Grilla Superior 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: ALTA DE NUEVO ALUMNO */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
            <div className="p-2.5 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Alta de Nuevo Alumno</h3>
              <p className="text-xs text-zinc-400">Registra datos, plan inicial y cobro en un solo paso</p>
            </div>
          </div>

          <form onSubmit={handleAltaAlumno} className="space-y-4">
            {errorAlta && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorAlta}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="DNI / Documento"
                placeholder="Ej. 40123456"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                required
              />
              <Input
                label="Teléfono (WhatsApp)"
                placeholder="Ej. 54911..."
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                placeholder="Ej. Juan"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
              <Input
                label="Apellido"
                placeholder="Ej. Pérez"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Plan Inicial
                </label>
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                >
                  {planes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — ${p.precio.toLocaleString('es-AR')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Medio de Pago
                </label>
                <select
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value as MedioPago)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">🏦 Transferencia / MercadoPago</option>
                  <option value="tarjeta">💳 Tarjeta Débito/Crédito</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loadingAlta}
                icon={<CheckCircle2 className="w-5 h-5" />}
                className="w-full font-bold"
              >
                Registrar Alumno y Cobrar Cuota
              </Button>
            </div>
          </form>
        </div>

        {/* COLUMNA DERECHA: COBRO RÁPIDO A ALUMNO EXISTENTE */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
              <div className="p-2.5 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">Cobro Rápido / Renovación</h3>
                <p className="text-xs text-zinc-400">Busca por DNI o Nombre para renovar cuota</p>
              </div>
            </div>

            {/* Buscador */}
            <div className="mb-6">
              <Input
                placeholder="Buscar por DNI o Nombre..."
                icon={<Search className="w-4 h-4" />}
                value={searchQuery}
                onChange={(e) => handleBuscarAlumno(e.target.value)}
              />
            </div>

            {/* Resultado de Búsqueda */}
            {searching ? (
              <div className="p-6 text-center text-xs text-zinc-400">Buscando alumno...</div>
            ) : searchResult ? (
              <div className="space-y-4 bg-zinc-950/60 border border-zinc-800 p-4 rounded-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-zinc-100">
                      {searchResult.usuario.nombre} {searchResult.usuario.apellido}
                    </h4>
                    <p className="text-xs text-zinc-400">DNI: {searchResult.usuario.dni}</p>
                  </div>
                  {searchResult.sub ? (
                    isSubscriptionExpired(searchResult.sub.fecha_vencimiento) ? (
                      <Badge variant="danger">Vencida</Badge>
                    ) : (
                      <Badge variant="success">Al Día</Badge>
                    )
                  ) : (
                    <Badge variant="warning">Sin Cuota</Badge>
                  )}
                </div>

                {searchResult.sub && (
                  <div className="text-xs space-y-1 text-zinc-300 pt-2 border-t border-zinc-800">
                    <p>Vencimiento actual: <span className="font-semibold text-zinc-100">{formatDateART(searchResult.sub.fecha_vencimiento)}</span></p>
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                      Plan a Renovar
                    </label>
                    <select
                      value={renovandoPlanId}
                      onChange={(e) => setRenovandoPlanId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                    >
                      {planes.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} (${p.precio.toLocaleString('es-AR')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1">
                      Medio de Pago
                    </label>
                    <select
                      value={renovandoMedio}
                      onChange={(e) => setRenovandoMedio(e.target.value as MedioPago)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>

                  <Button
                    onClick={handleRenovarCuota}
                    variant="primary"
                    size="sm"
                    loading={loadingRenovar}
                    className="w-full font-bold"
                  >
                    Confirmar Cobro y Renovar
                  </Button>

                  {mensajeExitoRenovacion && (
                    <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 p-2 rounded-lg text-center font-medium">
                      {mensajeExitoRenovacion}
                    </p>
                  )}
                </div>
              </div>
            ) : searchQuery.trim() ? (
              <div className="p-6 text-center text-xs text-zinc-400">No se encontraron alumnos con ese criterio.</div>
            ) : (
              <div className="p-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-800 rounded-xl">
                Escribe un DNI o Nombre arriba para seleccionar un socio.
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-zinc-800/80 mt-6">
            <button
              onClick={onNavigateToAlumnos}
              className="w-full text-xs font-semibold text-zinc-400 hover:text-red-400 flex items-center justify-center gap-1 transition-colors"
            >
              Ver listado completo de alumnos →
            </button>
          </div>
        </div>
      </div>

      {/* MODAL CLAVE INICIAL (SE MOSTRARÁ UNA ÚNICA VEZ) */}
      <Modal
        isOpen={modalClave.open}
        onClose={() => setModalClave({ open: false, nombre: '', dni: '', pass: '' })}
        title="🔑 Alta Exitosa — Contraseña Inicial"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 bg-red-600/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Dumbbell className="w-6 h-6" />
          </div>

          <h4 className="text-base font-bold text-zinc-100">{modalClave.nombre}</h4>
          <p className="text-xs text-zinc-400">
            Comunica esta credencial inicial al socio para que pueda ingresar desde su celular o PWA.
          </p>

          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-left space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500">DNI (Usuario):</span>
              <span className="font-mono text-zinc-200 font-bold">{modalClave.dni}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500">Contraseña Inicial:</span>
              <span className="font-mono text-red-400 font-bold text-sm bg-red-950/60 px-2 py-0.5 rounded border border-red-800/40">
                {modalClave.pass}
              </span>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <Button
              onClick={() => copyToClipboard(`Socio: ${modalClave.nombre}\nDNI: ${modalClave.dni}\nClave Inicial: ${modalClave.pass}`)}
              variant="secondary"
              size="md"
              icon={<Copy className="w-4 h-4" />}
              className="flex-1 text-xs"
            >
              {copied ? '¡Copiado!' : 'Copiar Datos'}
            </Button>
            <Button
              onClick={() => setModalClave({ open: false, nombre: '', dni: '', pass: '' })}
              variant="primary"
              size="md"
              className="flex-1 text-xs font-bold"
            >
              Entendido
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
