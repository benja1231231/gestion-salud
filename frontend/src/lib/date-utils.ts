// Utilidades de fecha/hora con zona horaria de Argentina (UTC-3)
export const TIMEZONE_ARGENTINA = 'America/Argentina/Buenos_Aires';

/**
 * Devuelve la fecha/hora actual interpretada en zona horaria Argentina.
 */
export function nowInArgentina(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE_ARGENTINA }));
}

/**
 * Construye una fecha UTC a partir de una fecha y hora en Argentina.
 * Ej: dateFromArgentinaString('2026-06-15', '10:00') => 2026-06-15T13:00:00Z
 */
export function dateFromArgentinaString(dateStr: string, timeStr?: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour = 0, minute = 0] = timeStr ? timeStr.split(':').map(Number) : [];
  // Argentina es UTC-3 (sin horario de verano actualmente)
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
}

/**
 * Formatea una fecha a string de fecha en Argentina.
 */
export function formatArgentinaDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-AR', { timeZone: TIMEZONE_ARGENTINA });
}

/**
 * Formatea una fecha a string de hora en Argentina.
 */
export function formatArgentinaTime(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-AR', {
    timeZone: TIMEZONE_ARGENTINA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
  });
}

/**
 * Formatea una fecha a string de fecha y hora en Argentina.
 */
export function formatArgentinaDateTime(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('es-AR', {
    timeZone: TIMEZONE_ARGENTINA,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
  });
}

/**
 * Devuelve la fecha actual en Argentina como string ISO (YYYY-MM-DD).
 */
export function toISODateArgentina(date?: Date): string {
  const d = date ? new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE_ARGENTINA })) : nowInArgentina();
  return d.toISOString().split('T')[0];
}

/**
 * Compara si dos fechas corresponden al mismo día en Argentina.
 */
export function isSameDayArgentina(a: Date | string, b: Date | string): boolean {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return da.toLocaleDateString('en-CA', { timeZone: TIMEZONE_ARGENTINA }) ===
         db.toLocaleDateString('en-CA', { timeZone: TIMEZONE_ARGENTINA });
}

/**
 * Formatea una fecha DATE de Postgres (string 'YYYY-MM-DD') sin aplicar timezone.
 * Útil para campos como fecha_nacimiento donde solo importa el día exacto.
 */
export function formatDateOnly(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Formatea un timestamp como fecha (día/mes/año) en zona horaria Argentina.
 * Útil para evoluciones/turnos donde se seleccionó un día y no una hora exacta.
 */
export function formatArgentinaDay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE_ARGENTINA,
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

/**
 * Devuelve el año-mes actual en Argentina (YYYY-MM).
 */
export function getYearMonthArgentina(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE_ARGENTINA, year: 'numeric', month: '2-digit' });
}
