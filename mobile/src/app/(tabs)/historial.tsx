import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AttendanceColors, AttendanceFonts } from '@/constants/attendance-theme';
import { useAuth } from '@/hooks/use-auth';
import { formatHoras, hoyISO } from '@/lib/asistencia';
import { supabase } from '@/lib/supabase';

type Status = 'completo' | 'tardanza' | 'en_curso' | 'falta' | 'pendiente' | 'sin_marcar';

const STATUS_META: Record<Status, { label: string; color: string }> = {
  completo: { label: 'Completo', color: AttendanceColors.success },
  tardanza: { label: 'Tardanza', color: AttendanceColors.accentAmber },
  en_curso: { label: 'En curso', color: AttendanceColors.accentTurquoise },
  falta: { label: 'Falta', color: AttendanceColors.alert },
  pendiente: { label: 'Pendiente', color: AttendanceColors.textMuted },
  sin_marcar: { label: 'No marcaste', color: AttendanceColors.alert },
};

// Cuántos días calendario hacia atrás se revisan para armar el historial (algunos se descartan,
// ver diasVentana).
const DIAS_VENTANA_HISTORIAL = 14;

type DiaHistorial = {
  fecha: string;
  entrada: string | null;
  salida: string | null;
  total: string;
  status: Status;
  motivoSalida: string | null;
};

function statusFor(row: { fecha: string; estado: string; puntualidad: string | null; hora_salida: string | null }): Status {
  if (row.estado === 'falta') return 'falta';
  if (row.estado !== 'asistio') return 'pendiente';
  if (!row.hora_salida) return row.fecha === hoyISO() ? 'en_curso' : 'pendiente';
  return row.puntualidad === 'tarde' ? 'tardanza' : 'completo';
}

// Últimos N días calendario (más reciente primero), terminando hoy.
function diasCalendario(hoy: string, cantidad: number) {
  const dias: string[] = [];
  const cursor = new Date(`${hoy}T00:00:00`);
  for (let i = 0; i < cantidad; i++) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dias;
}

function esDomingo(fecha: string) {
  return new Date(`${fecha}T12:00:00`).getDay() === 0;
}

function formatDateLabel(fecha: string) {
  if (fecha === hoyISO()) return 'HOY';
  const raw = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return raw.toUpperCase();
}

export default function HistorialScreen() {
  const { worker } = useAuth();
  const [dias, setDias] = useState<DiaHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const cargarHistorial = useCallback(async () => {
    if (!worker) return;
    setLoading(true);
    const ventana = diasCalendario(hoyISO(), DIAS_VENTANA_HISTORIAL);
    const { data, error: queryError } = await supabase
      .from('registro_diario_asistencia')
      .select('fecha, estado, puntualidad, hora_entrada, hora_salida, nota_salida')
      .eq('empleado_id', worker.id)
      .gte('fecha', ventana[ventana.length - 1])
      .lte('fecha', ventana[0]);

    setError(!!queryError);
    const porFecha = new Map((data ?? []).map((r) => [r.fecha, r]));

    setDias(
      ventana
        // Los domingos solo se muestran si de verdad hay un registro ese día (a veces sí toca trabajar).
        // Hoy se omite si todavía no hay nada marcado — el día aún no terminó, sería prematuro avisar.
        .filter((fecha) => (!esDomingo(fecha) || porFecha.has(fecha)) && (fecha !== hoyISO() || porFecha.has(fecha)))
        .map((fecha) => {
          const r = porFecha.get(fecha);
          if (!r) {
            return { fecha, entrada: null, salida: null, total: '—', status: 'sin_marcar' as Status, motivoSalida: null };
          }
          return {
            fecha,
            entrada: r.hora_entrada,
            salida: r.hora_salida,
            total: r.hora_entrada ? formatHoras(r.hora_entrada, r.hora_salida ?? r.hora_entrada) : '—',
            status: statusFor(r),
            motivoSalida: r.nota_salida,
          };
        }),
    );
    setLoading(false);
  }, [worker]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>Historial</Text>

        {!loading && error && (
          <View>
            <Text style={styles.emptyText}>No se pudo cargar tu historial. Intenta de nuevo más tarde.</Text>
            <Pressable onPress={cargarHistorial} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {!loading && !error && dias.length === 0 && <Text style={styles.emptyText}>Aún no tienes asistencia registrada.</Text>}

        {dias.map((day) => {
          const meta = STATUS_META[day.status];
          return (
            <View key={day.fecha} style={styles.group}>
              <Text style={styles.dateLabel}>{formatDateLabel(day.fecha)}</Text>
              <View style={styles.card}>
                <View style={styles.columns}>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>ENTRADA</Text>
                    <Text style={styles.columnValue}>{day.entrada ?? '—'}</Text>
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>SALIDA</Text>
                    <Text style={styles.columnValue}>{day.salida ?? '—'}</Text>
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>TOTAL</Text>
                    <Text style={styles.columnValue}>{day.total}</Text>
                  </View>
                </View>
                <View style={[styles.badge, { backgroundColor: `${meta.color}26` }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
              {day.motivoSalida && <Text style={styles.motivoText}>Salida tardía: {day.motivoSalida}</Text>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AttendanceColors.screenBackground,
  },
  scrollContent: {
    padding: 18,
    paddingTop: 24,
    paddingBottom: 110,
  },
  header: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeExtraBold,
    fontSize: 24,
    marginBottom: 20,
  },
  emptyText: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 14,
  },
  retryButtonText: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.plexSemiBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  group: {
    marginBottom: 16,
  },
  dateLabel: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 12.5,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 10.5,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  columnValue: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 14.5,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: AttendanceFonts.plexSemiBold,
    fontSize: 11.5,
  },
  motivoText: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 11.5,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
