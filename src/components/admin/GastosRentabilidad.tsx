import React, { useEffect, useState } from 'react';
import { DollarSign, Plus, Trash2, PieChart, TrendingUp, TrendingDown, Layers, Calendar, Zap } from 'lucide-react';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';
import { Gasto, CategoriaGasto, Suscripcion } from '../../types/database';
import { isSupabaseConfigured, supabase, supabaseAdmin } from '../../lib/supabase';
import { MockStore } from '../../lib/mockStore';
import { getTodayART, formatDateART } from '../../lib/dateUtils';
import { useToast } from '../../context/ToastContext';

type ModoFiltro = 'mes' | 'anio';

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

const ANIOS_DISPONIBLES = Array.from({ length: 10 }, (_, i) => 2026 + i);

export const GastosRentabilidad: React.FC = () => {
  const { showToast } = useToast();
  const hoyStr = getTodayART(); // YYYY-MM-DD
  const [anioActualStr, mesActualStr] = hoyStr.split('-');

  // Estado del Filtro de Período (Mes / Año a partir de 2026)
  const [modoFiltro, setModoFiltro] = useState<ModoFiltro>('mes');
  const [selectedMes, setSelectedMes] = useState<string>(mesActualStr);
  const [selectedAnio, setSelectedAnio] = useState<number>(Math.max(2026, parseInt(anioActualStr) || 2026));

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
        supabaseAdmin.from('gastos').select('*').order('fecha', { ascending: false }),
        supabaseAdmin.from('suscripciones').select('*')
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
      showToast('Error de Validación', 'Ingrese un concepto y monto válidos.', 'error');
      return;
    }

    setLoadingCreate(true);
    const hoy = getTodayART();

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabaseAdmin.from('gastos').insert({
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

      showToast('Gasto Registrado', `"${concepto.trim()}" por $${numMonto.toLocaleString('es-AR')}`, 'success');
      setConcepto('');
      setMonto('');
      setEsFijo(false);
      await cargarDatos();
    } catch (err: any) {
      showToast('Error Cargando Gasto', err.message, 'error');
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleEliminarGasto = async (id: string) => {
    if (!confirm('¿Desea eliminar este gasto?')) return;
    try {
      if (isSupabaseConfigured) {
        await supabaseAdmin.from('gastos').delete().eq('id', id);
      } else {
        MockStore.saveGastos(MockStore.getGastos().filter(g => g.id !== id));
      }
      showToast('Gasto Eliminado', 'El registro de gasto fue removido con éxito.', 'success');
      await cargarDatos();
    } catch (err: any) {
      showToast('Error Eliminando Gasto', err.message, 'error');
    }
  };

  // Filtrar suscripciones según Mes y/o Año seleccionados
  const subsFiltradas = suscripciones.filter(s => {
    const fechaCobro = s.fecha_inicio || s.creado_en?.substring(0, 10) || '';
    if (!fechaCobro) return false;

    const [anioStr, mesStr] = fechaCobro.split('-');

    if (modoFiltro === 'mes') {
      return anioStr === String(selectedAnio) && mesStr === selectedMes;
    }
    if (modoFiltro === 'anio') {
      return anioStr === String(selectedAnio);
    }
    return true;
  });

  // Filtrar gastos según Mes y/o Año seleccionados
  const gastosFiltrados = gastos.filter(g => {
    const fechaGasto = g.fecha || g.creado_en?.substring(0, 10) || '';
    if (!fechaGasto) return false;

    const [anioStr, mesStr] = fechaGasto.split('-');

    if (modoFiltro === 'mes') {
      return anioStr === String(selectedAnio) && mesStr === selectedMes;
    }
    if (modoFiltro === 'anio') {
      return anioStr === String(selectedAnio);
    }
    return true;
  });

  // Cálculos de Ganancia Neta y Totales para el Período Seleccionado
  const totalIngresoBruto = subsFiltradas.reduce((acc, curr) => acc + (Number(curr.monto_pagado) || 0), 0);
  const totalGastos = gastosFiltrados.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
  const gananciaNeta = totalIngresoBruto - totalGastos;

  // Etiqueta del período seleccionado
  const nombreMesSeleccionado = MESES.find(m => m.value === selectedMes)?.label || '';
  const etiquetaPeriodo = modoFiltro === 'mes'
    ? `${nombreMesSeleccionado} ${selectedAnio}`
    : `Año Completo ${selectedAnio}`;

  return (
    <div className="space-y-8">
      {/* Header Con Selector de Mes y Año */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600/10 border border-red-500/20 rounded-xl text-red-500 shadow-inner">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              Gastos & Rentabilidad
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/60 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Balance Financiero
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Período evaluado: <span className="text-zinc-200 font-bold">{etiquetaPeriodo}</span>
            </p>
          </div>
        </div>

        {/* Selector Dinámico de Mes y Año (a partir de 2026) */}
        <div className="flex flex-wrap items-center gap-2.5 bg-zinc-950 p-2 rounded-xl border border-zinc-800 self-start lg:self-auto">
          {/* Switch Modo: Mes / Año */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setModoFiltro('mes')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                modoFiltro === 'mes'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Por Mes
            </button>
            <button
              onClick={() => setModoFiltro('anio')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                modoFiltro === 'anio'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Por Año
            </button>
          </div>

          {/* Desplegable Mes (Sólo si modo === 'mes') */}
          {modoFiltro === 'mes' && (
            <select
              value={selectedMes}
              onChange={(e) => setSelectedMes(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-100 focus:outline-none focus:border-red-500"
            >
              {MESES.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          )}

          {/* Desplegable Año (A partir de 2026) */}
          <select
            value={selectedAnio}
            onChange={(e) => setSelectedAnio(parseInt(e.target.value) || 2026)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-100 font-mono focus:outline-none focus:border-red-500"
          >
            {ANIOS_DISPONIBLES.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resumen Rentabilidad Neta del Período */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Ingreso Bruto */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-zinc-400">Ingresos ({etiquetaPeriodo})</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div>
              <p className="text-2xl font-extrabold text-emerald-400 font-mono">
                +${totalIngresoBruto.toLocaleString('es-AR')}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">{subsFiltradas.length} cobros registrados</p>
            </div>
          )}
        </div>

        {/* Gastos Totales */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-zinc-400">Gastos ({etiquetaPeriodo})</span>
            <TrendingDown className="w-5 h-5 text-red-400" />
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div>
              <p className="text-2xl font-extrabold text-red-400 font-mono">
                -${totalGastos.toLocaleString('es-AR')}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">{gastosFiltrados.length} gastos en este período</p>
            </div>
          )}
        </div>

        {/* Ganancia Neta */}
        <div className="bg-zinc-900 border border-red-500/30 p-6 rounded-2xl shadow-xl bg-gradient-to-br from-zinc-900 to-red-950/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-red-400">Ganancia Neta</span>
            <DollarSign className="w-5 h-5 text-red-500" />
          </div>
          {loading ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <div>
              <p className={`text-2xl font-black font-mono ${gananciaNeta >= 0 ? 'text-zinc-100' : 'text-red-500'}`}>
                ${gananciaNeta.toLocaleString('es-AR')}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1 font-medium">
                {gananciaNeta >= 0 ? 'Balance Positivo' : 'Déficit en este período'}
              </p>
            </div>
          )}
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

        {/* Listado de Gastos Registrados en el Período */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
          <h3 className="text-base font-bold text-zinc-100 mb-1 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-red-500" /> Registro de Gastos ({etiquetaPeriodo})
          </h3>
          <p className="text-xs text-zinc-400 mb-4">
            Mostrando únicamente los gastos registrados en <span className="text-zinc-200 font-bold">{etiquetaPeriodo}</span>
          </p>

          {loading ? (
            <Skeleton count={3} className="h-10 mb-2" />
          ) : gastosFiltrados.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-8 text-center">
              No hay gastos registrados en {etiquetaPeriodo}.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {gastosFiltrados.map((g) => (
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
