import { DiaSemana } from '../types/database';

export const TIMEZONE_ART = 'America/Argentina/Buenos_Aires';

/**
 * Obtiene la fecha actual en formato ISO (YYYY-MM-DD) ajustada estrictamente a America/Argentina/Buenos_Aires.
 */
export function getTodayART(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_ART,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // Retorna YYYY-MM-DD
}

/**
 * Formatea una fecha YYYY-MM-DD o Date objeto a formato legible argentino DD/MM/YYYY.
 */
export function formatDateART(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const d = typeof dateStr === 'string' ? new Date(dateStr + 'T00:00:00-03:00') : dateStr;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE_ART,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Calcula los días restantes de una cuota en relación a la fecha actual de Buenos Aires.
 * Retorna número entero (puede ser negativo si está vencido).
 */
export function getDaysRemaining(fechaVencimiento: string): number {
  const hoyStr = getTodayART();
  const hoy = new Date(hoyStr + 'T00:00:00-03:00').getTime();
  const vencimiento = new Date(fechaVencimiento + 'T00:00:00-03:00').getTime();
  
  const diffTime = vencimiento - hoy;
  return Math.round(diffTime / (1000 * 3600 * 24));
}

/**
 * Verifica si una suscripción está vencida (fecha_vencimiento < hoy en ART).
 */
export function isSubscriptionExpired(fechaVencimiento: string): boolean {
  return getDaysRemaining(fechaVencimiento) < 0;
}

/**
 * Regla de renovación:
 * Si la cuota actual sigue activa (fecha_vencimiento >= hoy), la nueva fecha de vencimiento
 * es `fecha_vencimiento_actual + dias_plan`.
 * Si estaba vencida, es `hoy + dias_plan`.
 */
export function calculateNewExpirationDate(currentExpiration: string | null | undefined, planDays: number): string {
  const hoyStr = getTodayART();
  let baseDate: Date;

  if (currentExpiration && !isSubscriptionExpired(currentExpiration)) {
    baseDate = new Date(currentExpiration + 'T00:00:00-03:00');
  } else {
    baseDate = new Date(hoyStr + 'T00:00:00-03:00');
  }

  baseDate.setDate(baseDate.getDate() + planDays);
  
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene el día de la semana actual en ART formateado como DiaSemana o 'Domingo'.
 */
export function getTodayDayOfWeekART(): DiaSemana | 'Domingo' {
  const hoyStr = getTodayART();
  const date = new Date(hoyStr + 'T00:00:00-03:00');
  const dayIndex = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

  const map: Array<DiaSemana | 'Domingo'> = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return map[dayIndex];
}

/**
 * Obtiene el rango de fechas (lunes a sábado) para la semana actual en ART.
 * La semana arranca el Lunes 00:00 ART.
 */
export function getCurrentWeekRangeART(): { lunes: string; sabado: string } {
  const hoyStr = getTodayART();
  const date = new Date(hoyStr + 'T00:00:00-03:00');
  const dayOfWeek = date.getDay(); // 0 = Dom, 1 = Lun...
  
  // Calcular distancia al lunes anterior
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const lunes = new Date(date);
  lunes.setDate(date.getDate() + diffToMonday);
  
  const sabado = new Date(lunes);
  sabado.setDate(lunes.getDate() + 5);

  const formatStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    lunes: formatStr(lunes),
    sabado: formatStr(sabado)
  };
}

/**
 * Retorna si la fecha provista es Domingo.
 */
export function isSundayART(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00-03:00');
  return date.getDay() === 0;
}
