import React, { useEffect, useState } from 'react';
import { Settings, Plus, Edit2, Trash2, Phone, Dumbbell, ShieldAlert, Check } from 'lucide-react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';
import { Plan, Configuracion } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { useToast } from '../../context/ToastContext';

export const ConfigPlanes: React.FC = () => {
  const { showToast } = useToast();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [config, setConfig] = useState<Configuracion[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Crear/Editar Plan
  const [modalPlanOpen, setModalPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [nombrePlan, setNombrePlan] = useState('');
  const [diasDuracion, setDiasDuracion] = useState(30);
  const [metaDiasSemana, setMetaDiasSemana] = useState<string>('libre'); // 'libre' o '1'..'6'
  const [precioPlan, setPrecioPlan] = useState('');
  const [loadingPlanSave, setLoadingPlanSave] = useState(false);

  // Editor WhatsApp Recepción
  const [whatsapp, setWhatsapp] = useState('');
  const [loadingConfigSave, setLoadingConfigSave] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    if (isSupabaseConfigured) {
      const [planesRes, configRes] = await Promise.all([
        supabase.from('planes').select('*').order('precio', { ascending: true }),
        supabase.from('configuracion').select('*')
      ]);

      if (planesRes.data) setPlanes(planesRes.data as Plan[]);
      if (configRes.data) {
        setConfig(configRes.data as Configuracion[]);
        const ws = configRes.data.find((c: Configuracion) => c.clave === 'whatsapp_recepcion');
        if (ws) setWhatsapp(ws.valor);
      }
    } else {
      setPlanes(MockStore.getPlanes());
      const cfg = MockStore.getConfiguracion();
      setConfig(cfg);
      const ws = cfg.find(c => c.clave === 'whatsapp_recepcion');
      if (ws) setWhatsapp(ws.valor);
    }
    setLoading(false);
  };

  const handleOpenModalNew = () => {
    setEditingPlan(null);
    setNombrePlan('');
    setDiasDuracion(30);
    setMetaDiasSemana('libre');
    setPrecioPlan('');
    setModalPlanOpen(true);
  };

  const handleOpenModalEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setNombrePlan(plan.nombre);
    setDiasDuracion(plan.dias_duracion);
    setMetaDiasSemana(plan.meta_dias_semana === null ? 'libre' : String(plan.meta_dias_semana));
    setPrecioPlan(String(plan.precio));
    setModalPlanOpen(true);
  };

  const handleGuardarPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const precioNum = parseFloat(precioPlan);
    if (!nombrePlan.trim() || isNaN(precioNum) || precioNum < 0) {
      showToast('Error de Validación', 'Nombre y precio válidos son requeridos.', 'error');
      return;
    }

    setLoadingPlanSave(true);
    const metaValue = metaDiasSemana === 'libre' ? null : parseInt(metaDiasSemana);

    try {
      if (isSupabaseConfigured) {
        if (editingPlan) {
          const { error } = await supabase
            .from('planes')
            .update({
              nombre: nombrePlan.trim(),
              dias_duracion: diasDuracion,
              meta_dias_semana: metaValue,
              precio: precioNum
            })
            .eq('id', editingPlan.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('planes').insert({
            nombre: nombrePlan.trim(),
            dias_duracion: diasDuracion,
            meta_dias_semana: metaValue,
            precio: precioNum,
            activo: true
          });
          if (error) throw error;
        }
      } else {
        const pList = MockStore.getPlanes();
        if (editingPlan) {
          const updated = pList.map(p =>
            p.id === editingPlan.id
              ? { ...p, nombre: nombrePlan.trim(), dias_duracion: diasDuracion, meta_dias_semana: metaValue, precio: precioNum }
              : p
          );
          MockStore.savePlanes(updated);
        } else {
          const newP: Plan = {
            id: `p-${Date.now()}`,
            nombre: nombrePlan.trim(),
            dias_duracion: diasDuracion,
            meta_dias_semana: metaValue,
            precio: precioNum,
            activo: true
          };
          MockStore.savePlanes([...pList, newP]);
        }
      }

      setModalPlanOpen(false);
      showToast(
        editingPlan ? 'Plan Editado' : 'Plan Creado',
        `El plan "${nombrePlan.trim()}" se guardó correctamente.`,
        'success'
      );
      await cargarDatos();
    } catch (err: any) {
      showToast('Error Guardando Plan', err.message, 'error');
    } finally {
      setLoadingPlanSave(false);
    }
  };

  const handleToggleActivo = async (plan: Plan) => {
    try {
      if (isSupabaseConfigured) {
        await supabase.from('planes').update({ activo: !plan.activo }).eq('id', plan.id);
      } else {
        const updated = MockStore.getPlanes().map(p => p.id === plan.id ? { ...p, activo: !p.activo } : p);
        MockStore.savePlanes(updated);
      }
      showToast(
        'Estado del Plan',
        `El plan "${plan.nombre}" ahora está ${!plan.activo ? 'Activo' : 'Inactivo'}.`,
        'info'
      );
      await cargarDatos();
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    }
  };

  const handleEliminarPlan = async (plan: Plan) => {
    if (!confirm(`¿Está seguro de eliminar permanentemente el plan "${plan.nombre}"?`)) return;

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('planes').delete().eq('id', plan.id);
        if (error) {
          if (error.code === '23503') {
            showToast(
              'No se puede eliminar',
              'Existen cuotas asociadas en el historial. Desactívalo en su lugar.',
              'error'
            );
            return;
          }
          throw error;
        }
      } else {
        const updated = MockStore.getPlanes().filter(p => p.id !== plan.id);
        MockStore.savePlanes(updated);
      }

      showToast('Plan Eliminado', `El plan "${plan.nombre}" ha sido eliminado.`, 'success');
      await cargarDatos();
    } catch (err: any) {
      showToast('Error Eliminando Plan', err.message, 'error');
    }
  };

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingConfigSave(true);
    setSavedSuccess(false);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('configuracion')
          .upsert({ clave: 'whatsapp_recepcion', valor: whatsapp.trim(), descripcion: 'WhatsApp de Recepción' });
        if (error) throw error;
      } else {
        const cfg = MockStore.getConfiguracion();
        const existing = cfg.find(c => c.clave === 'whatsapp_recepcion');
        if (existing) {
          existing.valor = whatsapp.trim();
        } else {
          cfg.push({ clave: 'whatsapp_recepcion', valor: whatsapp.trim(), descripcion: 'WhatsApp Recepción' });
        }
        MockStore.saveConfiguracion(cfg);
      }

      setSavedSuccess(true);
      showToast('WhatsApp Actualizado', 'Número de Recepción guardado con éxito.', 'success');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      showToast('Error Guardando Configuración', err.message, 'error');
    } finally {
      setLoadingConfigSave(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Sección Configuración Global */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
        <h3 className="text-base font-bold text-zinc-100 mb-2 flex items-center gap-2">
          <Phone className="w-5 h-5 text-red-500" /> WhatsApp de Recepción Principal
        </h3>
        <p className="text-xs text-zinc-400 mb-6">
          Número de contacto utilizado en los botones de WhatsApp de la aplicación para el cobro y renovaciones.
        </p>

        <form onSubmit={handleGuardarConfig} className="flex flex-col sm:flex-row items-end gap-4 max-w-lg">
          <Input
            label="Número con código de país (sin + ni espacios)"
            placeholder="Ej. 5491100000000"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="primary"
            loading={loadingConfigSave}
            icon={savedSuccess ? <Check className="w-4 h-4" /> : undefined}
            className="w-full sm:w-auto text-xs font-bold shrink-0"
          >
            {savedSuccess ? '¡Guardado!' : 'Guardar Número'}
          </Button>
        </form>
      </div>

      {/* Sección Gestión de Planes */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-red-500" /> Planes de Membresía del Gimnasio
            </h3>
            <p className="text-xs text-zinc-400">
              Regla de congelamiento: modificar el precio no altera cuotas activas ya cobradas.
            </p>
          </div>
          <Button
            onClick={handleOpenModalNew}
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            className="font-bold text-xs"
          >
            Nuevo Plan
          </Button>
        </div>

        {loading ? (
          <Skeleton count={3} className="h-14" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planes.map((plan) => (
              <div
                key={plan.id}
                className={`bg-zinc-950 border ${
                  plan.activo ? 'border-zinc-800' : 'border-zinc-900 opacity-60'
                } p-5 rounded-xl flex flex-col justify-between space-y-4`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-zinc-100 text-sm">{plan.nombre}</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Duración: <span className="text-zinc-200 font-semibold">{plan.dias_duracion} días</span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      Meta semanal:{' '}
                      <span className="text-zinc-200 font-semibold">
                        {plan.meta_dias_semana === null ? 'Pase Libre (sin meta)' : `${plan.meta_dias_semana} días / sem`}
                      </span>
                    </p>
                  </div>
                  <Badge variant={plan.activo ? 'success' : 'neutral'}>
                    {plan.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <span className="text-lg font-extrabold font-mono text-red-400">
                    ${plan.precio.toLocaleString('es-AR')}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActivo(plan)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 underline px-1 py-1"
                    >
                      {plan.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <Button
                      onClick={() => handleOpenModalEdit(plan)}
                      variant="secondary"
                      size="sm"
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                      className="text-xs"
                    >
                      Editar
                    </Button>
                    <button
                      onClick={() => handleEliminarPlan(plan)}
                      title="Eliminar plan"
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Plan */}
      <Modal
        isOpen={modalPlanOpen}
        onClose={() => setModalPlanOpen(false)}
        title={editingPlan ? 'Editar Plan de Membresía' : 'Crear Nuevo Plan'}
      >
        <form onSubmit={handleGuardarPlan} className="space-y-4">
          <Input
            label="Nombre del Plan"
            placeholder="Ej. Plan Estudiante 3 Días"
            value={nombrePlan}
            onChange={(e) => setNombrePlan(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duración en Días"
              type="number"
              value={diasDuracion}
              onChange={(e) => setDiasDuracion(parseInt(e.target.value) || 30)}
              required
            />
            <Input
              label="Precio ($ ARS)"
              type="number"
              placeholder="25000"
              value={precioPlan}
              onChange={(e) => setPrecioPlan(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1.5">
              Meta de Asistencia Semanal
            </label>
            <select
              value={metaDiasSemana}
              onChange={(e) => setMetaDiasSemana(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100"
            >
              <option value="libre">✨ Pase Libre (Sin meta estricta)</option>
              <option value="1">1 Día por semana</option>
              <option value="2">2 Días por semana</option>
              <option value="3">3 Días por semana</option>
              <option value="4">4 Días por semana</option>
              <option value="5">5 Días por semana</option>
              <option value="6">6 Días por semana</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              onClick={() => setModalPlanOpen(false)}
              variant="ghost"
              className="flex-1 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loadingPlanSave}
              className="flex-1 text-xs font-bold"
            >
              Guardar Plan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
