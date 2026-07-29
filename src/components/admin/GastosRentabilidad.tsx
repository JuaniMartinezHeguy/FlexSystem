import React, { useEffect, useState } from 'react';
import { DollarSign, Plus, Trash2, PieChart, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';
import { Gasto, CategoriaGasto, Suscripcion } from '../../types/database';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { getTodayART, formatDateART } from '../../lib/dateUtils';

export const GastosRentabilidad: React.FC = () => {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario nuevo gasto
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('estructura');
  const [monto, setMonto] = useState('');
  const [esFijo, setEsFijo] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    if (isSupabaseConfigured) {
      const [gastosRes, subsRes] = await Promise.all([
        supabase.from('gastos').select('*').order('fecha', { ascending: false }),
        supabase.from('suscripciones').select('*')
      ]);
      if (gastosRes.data) setGastos(gastosRes.data as Gasto[]);
      if (subsRes.data) setSuscripciones(subsRes.data as Suscripcion[]);
    } else {
      setGastos(MockStore.getGastos());
      setSuscripciones(MockStore.getSuscripciones());
    }
    setLoading(false);
  };

  const handleCrearGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    const numMonto = parseFloat(monto);
    if (!concepto.trim() || isNaN(numMonto) || numMonto <= 0) {
      alert('Ingrese un concepto y monto válidos.');
      return;
    }

    setLoadingCreate(true);
    const hoy = getTodayART();

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('gastos').insert({
          concepto: concepto.trim(),
          categoria,
          monto: numMonto,
          es_fijo: esFijo,
          fecha: hoy
        });
        if (error) throw error;
      } else {
        const newGasto: Gasto = {
          id: `g-${Date.now()}`,
          concepto: concepto.trim(),
          categoria,
          monto: numMonto,
          es_fijo: esFijo,
          fecha: hoy,
          creado_en: new Date().toISOString()
        };
        MockStore.saveGastos([newGasto, ...MockStore.getGastos()]);
      }

      setConcepto('');
      setMonto('');
      setEsFijo(false);
      await cargarDatos();
    } catch (err: any) {
      alert('Error creando gasto: ' + err.message);
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleEliminarGasto = async (id: string) => {
    if (!confirm('¿Desea eliminar este gasto?')) return;
    if (isSupabaseConfigured) {
      await supabase.from('gastos').delete().eq('id', id);
    } else {
      MockStore.saveGastos(MockStore.getGastos().filter(g => g.id !== id));
    }
    await cargarDatos();
  };

  // Cálculos de Ganancia Neta y Totales
  const totalIngresoBruto = suscripciones.reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);
  const totalGastos = gastos.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
  const gananciaNeta = totalIngresoBruto - totalGastos;

  return (
    <div className="space-y-8">
      {/* Resumen Rentabilidad Neta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Ingreso Bruto */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-zinc-400">Ingresos Totales</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 font-mono">
            +${totalIngresoBruto.toLocaleString('es-AR')}
          </p>
        </div>

        {/* Gastos Totales */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-zinc-400">Gastos Totales</span>
            <TrendingDown className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-2xl font-extrabold text-red-400 font-mono">
            -${totalGastos.toLocaleString('es-AR')}
          </p>
        </div>

        {/* Ganancia Neta */}
        <div className="bg-zinc-900 border border-red-500/30 p-6 rounded-2xl shadow-xl bg-gradient-to-br from-zinc-900 to-red-950/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-red-400">Ganancia Neta</span>
            <DollarSign className="w-5 h-5 text-red-500" />
          </div>
          <p className={`text-2xl font-black font-mono ${gananciaNeta >= 0 ? 'text-zinc-100' : 'text-red-500'}`}>
            ${gananciaNeta.toLocaleString('es-AR')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulario de Carga de Gasto */}
        <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-red-500" /> Cargar Nuevo Gasto
          </h3>

          <form onSubmit={handleCrearGasto} className="space-y-4">
            <Input
              label="Concepto / Descripción"
              placeholder="Ej. Compra de discos de pesas"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1.5">
                  Categoría
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100"
                >
                  <option value="estructura">Estructura / Alquiler</option>
                  <option value="personal">Personal / Sueldos</option>
                  <option value="insumos">Insumos / Equipamiento</option>
                  <option value="servicios">Servicios (Luz/Gas/Net)</option>
                  <option value="eventual">Eventual / Imprevisto</option>
                </select>
              </div>

              <Input
                label="Monto ($)"
                type="number"
                placeholder="45000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="esFijo"
                checked={esFijo}
                onChange={(e) => setEsFijo(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="esFijo" className="text-xs text-zinc-300">
                Es un gasto fijo mensual recurrente
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loadingCreate}
              className="w-full font-bold text-xs"
            >
              Registrar Gasto
            </Button>
          </form>
        </div>

        {/* Listado de Gastos Registrados */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-red-500" /> Registro de Gastos
          </h3>

          {loading ? (
            <Skeleton count={3} className="h-10 mb-2" />
          ) : gastos.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-8 text-center">No hay gastos registrados aún.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {gastos.map((g) => (
                <div
                  key={g.id}
                  className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between hover:border-zinc-700 transition-colors text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-100">{g.concepto}</span>
                      {g.es_fijo && <Badge variant="info">Fijo</Badge>}
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Categoría: <span className="uppercase text-zinc-300 font-semibold">{g.categoria}</span> | {formatDateART(g.fecha)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-red-400 text-sm">
                      -${g.monto.toLocaleString('es-AR')}
                    </span>
                    <button
                      onClick={() => handleEliminarGasto(g.id)}
                      title="Eliminar gasto"
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
