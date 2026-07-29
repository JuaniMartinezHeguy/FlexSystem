export type RolUsuario = 'admin' | 'cliente';
export type MedioPago = 'efectivo' | 'transferencia' | 'tarjeta';
export type EstadoSuscripcion = 'activa' | 'vencida';
export type CategoriaGasto = 'estructura' | 'personal' | 'insumos' | 'servicios' | 'eventual';
export type DiaSemana = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado';

export interface Usuario {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  rol: RolUsuario;
  creado_en?: string;
  actualizado_en?: string;
}

export interface Plan {
  id: string;
  nombre: string;
  dias_duracion: number;
  meta_dias_semana: number | null; // null = pase libre
  precio: number;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface Suscripcion {
  id: string;
  usuario_id: string;
  plan_id: string;
  monto_pagado: number;
  medio_pago: MedioPago;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_vencimiento: string; // YYYY-MM-DD
  estado: EstadoSuscripcion;
  creado_en?: string;
  // Joins opcionales
  usuario?: Usuario;
  plan?: Plan;
}

export interface Asistencia {
  id: string;
  usuario_id: string;
  fecha: string; // YYYY-MM-DD
  asistio: boolean;
  creado_en?: string;
}

export interface Rutina {
  id: string;
  usuario_id: string;
  dia_semana: DiaSemana;
  titulo_grupo: string;
  creado_en?: string;
  actualizado_en?: string;
  ejercicios?: Ejercicio[];
}

export interface Ejercicio {
  id: string;
  rutina_id: string;
  nombre: string;
  series: number;
  repeticiones: string;
  peso_kg: number;
  orden: number;
  creado_en?: string;
}

export interface Gasto {
  id: string;
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  es_fijo: boolean;
  fecha: string; // YYYY-MM-DD
  creado_en?: string;
}

export interface Configuracion {
  clave: string;
  valor: string;
  descripcion?: string;
  actualizado_en?: string;
}
