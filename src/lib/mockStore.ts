import { Usuario, Plan, Suscripcion, Asistencia, Rutina, Ejercicio, Gasto, Configuracion } from '../types/database';
import { getTodayART, calculateNewExpirationDate } from './dateUtils';

// Almacén reactivo local en localStorage para modo demostración/fallback
const STORAGE_KEYS = {
  USUARIOS: 'flex_mock_usuarios',
  PLANES: 'flex_mock_planes',
  SUSCRIPCIONES: 'flex_mock_suscripciones',
  ASISTENCIAS: 'flex_mock_asistencias',
  RUTINAS: 'flex_mock_rutinas',
  EJERCICIOS: 'flex_mock_ejercicios',
  GASTOS: 'flex_mock_gastos',
  CONFIGURACION: 'flex_mock_configuracion',
};

const hoy = getTodayART();

// DATOS INICIALES SEMILLA
const INITIAL_PLANES: Plan[] = [
  { id: 'p-1', nombre: 'Pase Libre Mensual', dias_duracion: 30, meta_dias_semana: null, precio: 25000, activo: true },
  { id: 'p-2', nombre: 'Plan 3 Días / Semana', dias_duracion: 30, meta_dias_semana: 3, precio: 18000, activo: true },
  { id: 'p-3', nombre: 'Plan 4 Días / Semana', dias_duracion: 30, meta_dias_semana: 4, precio: 21000, activo: true },
  { id: 'p-4', nombre: 'Plan 5 Días / Semana', dias_duracion: 30, meta_dias_semana: 5, precio: 23000, activo: true },
];

const INITIAL_USUARIOS: Usuario[] = [
  { id: 'usr-admin', dni: '11111111', nombre: 'Recepción', apellido: 'Flex', telefono: '1122334455', rol: 'admin' },
  { id: 'usr-1', dni: '40123456', nombre: 'Juan', apellido: 'Pérez', telefono: '5491145678901', rol: 'cliente' },
  { id: 'usr-2', dni: '41234567', nombre: 'María', apellido: 'Gómez', telefono: '5491145678902', rol: 'cliente' },
  { id: 'usr-3', dni: '38999888', nombre: 'Carlos', apellido: 'Rossi', telefono: '5491145678903', rol: 'cliente' },
];

const INITIAL_SUSCRIPCIONES: Suscripcion[] = [
  {
    id: 'sub-1',
    usuario_id: 'usr-1',
    plan_id: 'p-1',
    monto_pagado: 25000,
    medio_pago: 'efectivo',
    fecha_inicio: hoy,
    fecha_vencimiento: calculateNewExpirationDate(hoy, 30),
    estado: 'activa',
    creado_en: new Date().toISOString()
  },
  {
    id: 'sub-2',
    usuario_id: 'usr-2',
    plan_id: 'p-2',
    monto_pagado: 18000,
    medio_pago: 'transferencia',
    fecha_inicio: hoy,
    fecha_vencimiento: calculateNewExpirationDate(hoy, 30),
    estado: 'activa',
    creado_en: new Date().toISOString()
  },
  {
    id: 'sub-3',
    usuario_id: 'usr-3',
    plan_id: 'p-3',
    monto_pagado: 21000,
    medio_pago: 'tarjeta',
    fecha_inicio: '2026-06-01',
    fecha_vencimiento: '2026-07-01', // Vencido
    estado: 'vencida',
    creado_en: new Date('2026-06-01').toISOString()
  }
];

const INITIAL_CONFIG: Configuracion[] = [
  { clave: 'whatsapp_recepcion', valor: '5491100000000', descripcion: 'WhatsApp de Recepción' },
  { clave: 'nombre_gimnasio', valor: 'Flex Gym', descripcion: 'Nombre del Gimnasio' }
];

const INITIAL_GASTOS: Gasto[] = [
  { id: 'g-1', concepto: 'Alquiler del Local', categoria: 'estructura', monto: 350000, es_fijo: true, fecha: hoy },
  { id: 'g-2', concepto: 'Servicio de Luz y Gas', categoria: 'servicios', monto: 65000, es_fijo: true, fecha: hoy },
  { id: 'g-3', concepto: 'Mantenimiento de Máquinas', categoria: 'insumos', monto: 42000, es_fijo: false, fecha: hoy },
  { id: 'g-4', concepto: 'Sueldos Profesores', categoria: 'personal', monto: 450000, es_fijo: true, fecha: hoy }
];

const INITIAL_RUTINAS: Rutina[] = [
  { id: 'r-1', usuario_id: 'usr-1', dia_semana: 'Lunes', titulo_grupo: 'Pecho + Tríceps' },
  { id: 'r-2', usuario_id: 'usr-1', dia_semana: 'Martes', titulo_grupo: 'Espalda + Biceps' },
  { id: 'r-3', usuario_id: 'usr-1', dia_semana: 'Miércoles', titulo_grupo: 'Piernas Completo' },
  { id: 'r-4', usuario_id: 'usr-1', dia_semana: 'Jueves', titulo_grupo: 'Hombros + Abdomen' },
  { id: 'r-5', usuario_id: 'usr-1', dia_semana: 'Viernes', titulo_grupo: 'Full Body / Hipertrofia' },
  { id: 'r-6', usuario_id: 'usr-1', dia_semana: 'Sábado', titulo_grupo: 'Cardio + Zona Core' }
];

const INITIAL_EJERCICIOS: Ejercicio[] = [
  { id: 'e-1', rutina_id: 'r-1', nombre: 'Press Banco Plano con Barra', series: 4, repeticiones: '10-12', peso_kg: 70, orden: 1 },
  { id: 'e-2', rutina_id: 'r-1', nombre: 'Press Inclinado con Mancuernas', series: 4, repeticiones: '12', peso_kg: 24, orden: 2 },
  { id: 'e-3', rutina_id: 'r-1', nombre: 'Aperturas en Polea Alta', series: 3, repeticiones: '15', peso_kg: 15, orden: 3 },
  { id: 'e-4', rutina_id: 'r-1', nombre: 'Extensión de Tríceps Polea Alta', series: 4, repeticiones: '12-15', peso_kg: 35, orden: 4 },
  { id: 'e-5', rutina_id: 'r-1', nombre: 'Fondos en Parallelas', series: 3, repeticiones: 'Fallo', peso_kg: 0, orden: 5 },
];

function getStoredItem<T>(key: string, initial: T): T {
  try {
    let data = localStorage.getItem(key);
    if (!data) {
      const oldKey = key.replace('flex_', 'ironhouse_');
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        data = oldData;
        localStorage.setItem(key, oldData);
      }
    }
    return data ? JSON.parse(data) : initial;
  } catch {
    return initial;
  }
}

function setStoredItem<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error guardando mock store', e);
  }
}

export class MockStore {
  static getUsuarios(): Usuario[] {
    return getStoredItem(STORAGE_KEYS.USUARIOS, INITIAL_USUARIOS);
  }

  static saveUsuarios(usuarios: Usuario[]): void {
    setStoredItem(STORAGE_KEYS.USUARIOS, usuarios);
  }

  static getPlanes(): Plan[] {
    return getStoredItem(STORAGE_KEYS.PLANES, INITIAL_PLANES);
  }

  static savePlanes(planes: Plan[]): void {
    setStoredItem(STORAGE_KEYS.PLANES, planes);
  }

  static getSuscripciones(): Suscripcion[] {
    return getStoredItem(STORAGE_KEYS.SUSCRIPCIONES, INITIAL_SUSCRIPCIONES);
  }

  static saveSuscripciones(subs: Suscripcion[]): void {
    setStoredItem(STORAGE_KEYS.SUSCRIPCIONES, subs);
  }

  static getAsistencias(): Asistencia[] {
    return getStoredItem(STORAGE_KEYS.ASISTENCIAS, []);
  }

  static saveAsistencias(asist: Asistencia[]): void {
    setStoredItem(STORAGE_KEYS.ASISTENCIAS, asist);
  }

  static getGastos(): Gasto[] {
    return getStoredItem(STORAGE_KEYS.GASTOS, INITIAL_GASTOS);
  }

  static saveGastos(gastos: Gasto[]): void {
    setStoredItem(STORAGE_KEYS.GASTOS, gastos);
  }

  static getConfiguracion(): Configuracion[] {
    return getStoredItem(STORAGE_KEYS.CONFIGURACION, INITIAL_CONFIG);
  }

  static saveConfiguracion(config: Configuracion[]): void {
    setStoredItem(STORAGE_KEYS.CONFIGURACION, config);
  }

  static getRutinas(usuarioId: string): Rutina[] {
    const rutinas = getStoredItem<Rutina[]>(STORAGE_KEYS.RUTINAS, INITIAL_RUTINAS);
    return rutinas.filter(r => r.usuario_id === usuarioId);
  }

  static saveRutinas(rutinas: Rutina[]): void {
    setStoredItem(STORAGE_KEYS.RUTINAS, rutinas);
  }

  static getEjercicios(rutinaId: string): Ejercicio[] {
    const ejercicios = getStoredItem<Ejercicio[]>(STORAGE_KEYS.EJERCICIOS, INITIAL_EJERCICIOS);
    return ejercicios.filter(e => e.rutina_id === rutinaId);
  }

  static saveEjercicios(ejercicios: Ejercicio[]): void {
    setStoredItem(STORAGE_KEYS.EJERCICIOS, ejercicios);
  }

  static deleteUsuario(usuarioId: string): void {
    const usuarios = this.getUsuarios().filter(u => u.id !== usuarioId);
    this.saveUsuarios(usuarios);

    const subs = this.getSuscripciones().filter(s => s.usuario_id !== usuarioId);
    this.saveSuscripciones(subs);

    const asist = this.getAsistencias().filter(a => a.usuario_id !== usuarioId);
    this.saveAsistencias(asist);

    const allRutinas = getStoredItem<Rutina[]>(STORAGE_KEYS.RUTINAS, INITIAL_RUTINAS);
    const userRutinaIds = allRutinas.filter(r => r.usuario_id === usuarioId).map(r => r.id);
    const remainingRutinas = allRutinas.filter(r => r.usuario_id !== usuarioId);
    this.saveRutinas(remainingRutinas);

    const allEjercicios = getStoredItem<Ejercicio[]>(STORAGE_KEYS.EJERCICIOS, INITIAL_EJERCICIOS);
    const remainingEjercicios = allEjercicios.filter(e => !userRutinaIds.includes(e.rutina_id));
    this.saveEjercicios(remainingEjercicios);
  }
}
