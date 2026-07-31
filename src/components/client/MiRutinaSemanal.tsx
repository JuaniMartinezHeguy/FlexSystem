import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Dumbbell, Save, Pencil } from 'lucide-react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Skeleton } from '../common/Skeleton';
import { useAuth } from '../../context/AuthContext';
import { DiaSemana, Rutina, Ejercicio } from '../../types/database';
import { isSupabaseConfigured, supabaseAdmin } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { useToast } from '../../context/ToastContext';

const DIAS: DiaSemana[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const MiRutinaSemanal: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [activeDia, setActiveDia] = useState<DiaSemana>('Lunes');
  const [rutina, setRutina] = useState<Rutina | null>(null);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Grupo Muscular / Titulo
  const [tituloGrupo, setTituloGrupo] = useState('');
  const [loadingTitulo, setLoadingTitulo] = useState(false);

  // Modal Crear / Editar Ejercicio
  const [modalEjOpen, setModalEjOpen] = useState(false);
  const [editingEj, setEditingEj] = useState<Ejercicio | null>(null);
  const [nombreEj, setNombreEj] = useState('');
  const [seriesEj, setSeriesEj] = useState('3');
  const [repsEj, setRepsEj] = useState('10-12');
  const [loadingEjSave, setLoadingEjSave] = useState(false);

  useEffect(() => {
    if (user) {
      cargarRutinaDia(activeDia);
    }
  }, [user, activeDia]);

  const cargarRutinaDia = async (dia: DiaSemana) => {
    if (!user) return;
    setLoading(true);

    if (isSupabaseConfigured) {
      const { data: rData } = await supabaseAdmin
        .from('rutinas')
        .select('*, ejercicios(*)')
        .eq('usuario_id', user.id)
        .eq('dia_semana', dia)
        .maybeSingle();

      if (rData) {
        setRutina(rData as Rutina);
        setTituloGrupo(rData.titulo_grupo);
        const ejs = (rData.ejercicios || []).sort((a: Ejercicio, b: Ejercicio) => a.orden - b.orden);
        setEjercicios(ejs);
      } else {
        setRutina(null);
        setTituloGrupo('');
        setEjercicios([]);
      }
    } else {
      const rutinas = MockStore.getRutinas(user.id);
      const r = rutinas.find(x => x.dia_semana === dia);
      if (r) {
        setRutina(r);
        setTituloGrupo(r.titulo_grupo);
        const ejs = MockStore.getEjercicios(r.id).sort((a, b) => a.orden - b.orden);
        setEjercicios(ejs);
      } else {
        setRutina(null);
        setTituloGrupo('');
        setEjercicios([]);
      }
    }
    setLoading(false);
  };

  const handleGuardarTitulo = async () => {
    if (!user || !tituloGrupo.trim()) return;
    setLoadingTitulo(true);

    try {
      if (isSupabaseConfigured) {
        if (rutina) {
          await supabaseAdmin.from('rutinas').update({ titulo_grupo: tituloGrupo.trim() }).eq('id', rutina.id);
        } else {
          const { data } = await supabaseAdmin.from('rutinas').insert({
            usuario_id: user.id,
            dia_semana: activeDia,
            titulo_grupo: tituloGrupo.trim()
          }).select().single();

          if (data) setRutina(data as Rutina);
        }
      } else {
        const rutinas = MockStore.getRutinas(user.id);
        const existing = rutinas.find(r => r.dia_semana === activeDia);
        if (existing) {
          existing.titulo_grupo = tituloGrupo.trim();
          MockStore.saveRutinas(rutinas);
        } else {
          const newR: Rutina = {
            id: `r-${Date.now()}`,
            usuario_id: user.id,
            dia_semana: activeDia,
            titulo_grupo: tituloGrupo.trim()
          };
          MockStore.saveRutinas([...rutinas, newR]);
          setRutina(newR);
        }
      }
      showToast('Grupo Muscular Guardado', `Enfoque para el ${activeDia}: "${tituloGrupo.trim()}"`, 'success');
      await cargarRutinaDia(activeDia);
    } catch (err: any) {
      showToast('Error Guardando Grupo', err.message, 'error');
    } finally {
      setLoadingTitulo(false);
    }
  };

  const handleAbrirCrear = () => {
    setEditingEj(null);
    setNombreEj('');
    setSeriesEj('3');
    setRepsEj('10-12');
    setModalEjOpen(true);
  };

  const handleAbrirEditar = (ej: Ejercicio) => {
    setEditingEj(ej);
    setNombreEj(ej.nombre);
    setSeriesEj(String(ej.series));
    setRepsEj(ej.repeticiones);
    setModalEjOpen(true);
  };

  const handleAgregarEjercicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreEj.trim()) return;
    const seriesNum = parseInt(seriesEj) || 3;

    setLoadingEjSave(true);
    let targetRutinaId: string | undefined = rutina?.id;

    try {
      if (editingEj) {
        // Edición de ejercicio existente
        if (isSupabaseConfigured) {
          const { error } = await supabaseAdmin.from('ejercicios').update({
            nombre: nombreEj.trim(),
            series: seriesNum,
            repeticiones: repsEj.trim()
          }).eq('id', editingEj.id);
          if (error) throw error;
        } else {
          if (targetRutinaId) {
            const allE = MockStore.getEjercicios(targetRutinaId);
            const idx = allE.findIndex(x => x.id === editingEj.id);
            if (idx >= 0) {
              allE[idx].nombre = nombreEj.trim();
              allE[idx].series = seriesNum;
              allE[idx].repeticiones = repsEj.trim();
              MockStore.saveEjercicios(allE);
            }
          }
        }
        showToast('Ejercicio Actualizado', `"${nombreEj.trim()}" (${seriesNum}x${repsEj.trim()})`, 'success');
      } else {
        // Creación de ejercicio nuevo
        if (!targetRutinaId) {
          const groupTitle = tituloGrupo.trim() || `Entrenamiento ${activeDia}`;
          if (isSupabaseConfigured) {
            const { data, error } = await supabaseAdmin.from('rutinas').insert({
              usuario_id: user!.id,
              dia_semana: activeDia,
              titulo_grupo: groupTitle
            }).select().single();
            if (error) throw error;
            targetRutinaId = data.id;
            setRutina(data as Rutina);
          } else {
            const newR: Rutina = {
              id: `r-${Date.now()}`,
              usuario_id: user!.id,
              dia_semana: activeDia,
              titulo_grupo: groupTitle
            };
            const allR = MockStore.getRutinas(user!.id);
            MockStore.saveRutinas([...allR, newR]);
            targetRutinaId = newR.id;
            setRutina(newR);
          }
        }

        if (!targetRutinaId) {
          throw new Error('No se pudo inicializar la rutina.');
        }

        const ordenNext = ejercicios.length + 1;

        if (isSupabaseConfigured) {
          const { error } = await supabaseAdmin.from('ejercicios').insert({
            rutina_id: targetRutinaId,
            nombre: nombreEj.trim(),
            series: seriesNum,
            repeticiones: repsEj.trim(),
            orden: ordenNext
          });
          if (error) throw error;
        } else {
          const newEj: Ejercicio = {
            id: `e-${Date.now()}`,
            rutina_id: targetRutinaId,
            nombre: nombreEj.trim(),
            series: seriesNum,
            repeticiones: repsEj.trim(),
            orden: ordenNext
          };
          const allE = MockStore.getEjercicios(targetRutinaId);
          MockStore.saveEjercicios([...allE, newEj]);
        }

        showToast('Ejercicio Añadido', `"${nombreEj.trim()}" (${seriesNum}x${repsEj.trim()})`, 'success');
      }

      setModalEjOpen(false);
      setEditingEj(null);
      setNombreEj('');
      setSeriesEj('3');
      setRepsEj('10-12');
      await cargarRutinaDia(activeDia);
    } catch (err: any) {
      showToast('Error Guardando Ejercicio', err.message, 'error');
    } finally {
      setLoadingEjSave(false);
    }
  };

  const handleEliminarEjercicio = async (id: string) => {
    if (!confirm('¿Eliminar ejercicio?')) return;
    try {
      if (isSupabaseConfigured) {
        await supabaseAdmin.from('ejercicios').delete().eq('id', id);
      } else {
        if (rutina) {
          const ejs = MockStore.getEjercicios(rutina.id).filter(e => e.id !== id);
          MockStore.saveEjercicios(ejs);
        }
      }
      showToast('Ejercicio Eliminado', 'El ejercicio fue retirado de tu rutina.', 'info');
      await cargarRutinaDia(activeDia);
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Selector de Días Lunes a Sábado */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {DIAS.map((dia) => {
          const isSelected = activeDia === dia;
          return (
            <button
              key={dia}
              onClick={() => setActiveDia(dia)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold shrink-0 transition-all ${
                isSelected
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {dia}
            </button>
          );
        })}
      </div>

      {/* Titulo Grupo Muscular del Día */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-3">
        <label className="block text-xs font-bold uppercase text-zinc-400">
          Grupo Muscular / Enfoque ({activeDia})
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="Ej. Pecho + Biceps"
            value={tituloGrupo}
            onChange={(e) => setTituloGrupo(e.target.value)}
          />
          <Button
            onClick={handleGuardarTitulo}
            variant="secondary"
            loading={loadingTitulo}
            icon={<Save className="w-4 h-4 text-red-500" />}
            className="shrink-0 text-xs font-bold"
          >
            Guardar
          </Button>
        </div>
      </div>

      {/* Lista de Ejercicios del Día */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-red-500" /> Ejercicios ({ejercicios.length})
          </h3>
          <Button
            onClick={handleAbrirCrear}
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            className="font-bold text-xs shadow-red-600/20"
          >
            Agregar Ejercicio
          </Button>
        </div>

        {loading ? (
          <Skeleton count={3} className="h-16" />
        ) : ejercicios.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900/60 border border-dashed border-zinc-800 rounded-3xl text-xs text-zinc-400">
            No has añadido ejercicios para el {activeDia}. Presiona "Agregar Ejercicio" para armar tu plan.
          </div>
        ) : (
          <div className="space-y-3">
            {ejercicios.map((ej, index) => (
              <div
                key={ej.id}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-zinc-950 border border-zinc-800 text-red-500 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-zinc-100 text-sm">{ej.nombre}</h4>
                    <p className="text-xs text-zinc-400">
                      <span className="text-zinc-200 font-semibold">{ej.series} series</span> ×{' '}
                      <span className="text-zinc-200 font-semibold">{ej.repeticiones} reps</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleAbrirEditar(ej)}
                    title="Editar ejercicio"
                    className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEliminarEjercicio(ej.id)}
                    title="Eliminar ejercicio"
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Ejercicio */}
      <Modal
        isOpen={modalEjOpen}
        onClose={() => {
          setModalEjOpen(false);
          setEditingEj(null);
        }}
        title={editingEj ? `Editar Ejercicio (${activeDia})` : `Nuevo Ejercicio (${activeDia})`}
      >
        <form onSubmit={handleAgregarEjercicio} className="space-y-4">
          <Input
            label="Nombre del Ejercicio"
            placeholder="Ej. Press Plano o Sentadillas"
            value={nombreEj}
            onChange={(e) => setNombreEj(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Series"
              type="number"
              value={seriesEj}
              onChange={(e) => setSeriesEj(e.target.value)}
              placeholder="3"
              required
            />
            <Input
              label="Repeticiones"
              placeholder="Ej. 10-12 o Al fallo"
              value={repsEj}
              onChange={(e) => setRepsEj(e.target.value)}
              required
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              onClick={() => {
                setModalEjOpen(false);
                setEditingEj(null);
              }}
              variant="ghost"
              className="flex-1 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loadingEjSave}
              className="flex-1 text-xs font-bold"
            >
              {editingEj ? 'Guardar Cambios' : 'Añadir Ejercicio'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
