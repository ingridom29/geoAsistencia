export const HORA_ENTRADA_ESPERADA = '07:30';
export const TOLERANCIA_TARDANZA_MIN = 10;
export const HORA_EXTRA_DESDE_SEMANA = '17:00';
// Los sábados la jornada termina a la 1pm, con 30 min de gracia hasta la 1:30pm.
export const HORA_EXTRA_DESDE_SABADO = '13:30';

export function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

// Umbral de "salida tardía" (pide motivo) para el día de hoy: distinto los sábados.
export function horaExtraDesdeHoy() {
  return new Date().getDay() === 6 ? HORA_EXTRA_DESDE_SABADO : HORA_EXTRA_DESDE_SEMANA;
}

export function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function minutosDesdeMedianoche(hora: string) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minutosTarde(horaEntrada: string) {
  return Math.max(0, minutosDesdeMedianoche(horaEntrada) - minutosDesdeMedianoche(HORA_ENTRADA_ESPERADA));
}

export function formatHoras(horaEntrada: string, horaSalidaOrNow: string) {
  const minutos = Math.max(0, minutosDesdeMedianoche(horaSalidaOrNow) - minutosDesdeMedianoche(horaEntrada));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function horaAMs(hora: string, referenciaMs: number) {
  const [h, m] = hora.slice(0, 5).split(':').map(Number);
  const d = new Date(referenciaMs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// Elapsed time to the second, for a live-ticking "still checked in" display.
// `fin` is either the current timestamp (still working) or the hora_salida string (already checked out).
export function formatHorasEnVivo(horaEntrada: string, fin: number | string) {
  const finMs = typeof fin === 'number' ? fin : horaAMs(fin, Date.now());
  const inicioMs = horaAMs(horaEntrada, finMs);
  const totalSegundos = Math.max(0, Math.floor((finMs - inicioMs) / 1000));
  const hh = Math.floor(totalSegundos / 3600);
  const mm = Math.floor((totalSegundos % 3600) / 60);
  const ss = totalSegundos % 60;
  return `${hh}h ${String(mm).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`;
}
