import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmbientGlow } from '@/components/ambient-glow';
import { AttendanceColors, AttendanceFonts } from '@/constants/attendance-theme';
import { fetchObrasActivas, type Obra } from '@/constants/obras';
import { useAuth } from '@/hooks/use-auth';
import {
  formatHorasEnVivo,
  horaActual,
  horaExtraDesdeHoy,
  hoyISO,
  minutosDesdeMedianoche,
  minutosTarde,
  TOLERANCIA_TARDANZA_MIN,
} from '@/lib/asistencia';
import { getDeviceId } from '@/lib/device';
import { distanciaMetros } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

// La ubicación es obligatoria para marcar llegada: sin permiso o sin GPS, no se deja continuar.
type ResultadoUbicacion = { ok: true; lat: number; lng: number } | { ok: false; motivo: 'permiso' | 'gps' };

async function obtenerUbicacion(): Promise<ResultadoUbicacion> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, motivo: 'permiso' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { ok: false, motivo: 'gps' };
  }
}

const MIN_MINUTOS_ANTES_DE_SALIDA = 60;

type Registro = {
  obra_id: string | null;
  estado: string;
  puntualidad: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  nota: string | null;
};

function getSaludo() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getFechaHoy() {
  const raw = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function HomeScreen() {
  const { worker } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [obraPickerOpen, setObraPickerOpen] = useState(false);
  const [confirmSalidaOpen, setConfirmSalidaOpen] = useState(false);
  const [motivoSalida, setMotivoSalida] = useState('');
  // Confirmación que se queda en pantalla hasta que la cierran ellos mismos (a diferencia del
  // toast, que desaparece solo) — para que quede claro que sí se registró la entrada/salida.
  const [confirmacionExito, setConfirmacionExito] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  const breathe = useRef(new Animated.Value(0)).current;
  const checkPop = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(breathe, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  useEffect(() => {
    if (!worker) return;
    (async () => {
      const [obrasActivas, { data: registroHoy }] = await Promise.all([
        fetchObrasActivas(),
        supabase
          .from('registro_diario_asistencia')
          .select('obra_id, estado, puntualidad, hora_entrada, hora_salida, nota')
          .eq('empleado_id', worker.id)
          .eq('fecha', hoyISO())
          .maybeSingle(),
      ]);
      setObras(obrasActivas);
      if (registroHoy) {
        setRegistro(registroHoy);
        setSelectedObraId(registroHoy.obra_id);
      }
      setLoading(false);
    })();
  }, [worker]);

  if (!worker) return null;

  function showToast(message: string) {
    setToast(message);
    toastAnim.setValue(0);
    Animated.timing(toastAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setToast(null));
    }, 2800);
  }

  async function marcarLlegada() {
    if (working) return;
    if (!selectedObraId) {
      showToast('Primero elige a qué obra vas hoy');
      return;
    }
    setWorking(true);

    const [ubicacion, deviceId] = await Promise.all([obtenerUbicacion(), getDeviceId()]);
    if (!ubicacion.ok) {
      setWorking(false);
      showToast(
        ubicacion.motivo === 'permiso'
          ? 'Activa el permiso de ubicación para poder marcar tu llegada'
          : 'No se pudo obtener tu ubicación. Revisa tu GPS e intenta de nuevo',
      );
      return;
    }

    const entrada = horaActual();
    const tarde = minutosTarde(entrada);
    const puntualidad = tarde > TOLERANCIA_TARDANZA_MIN ? 'tarde' : 'a_tiempo';
    const nota = tarde > TOLERANCIA_TARDANZA_MIN ? `Llegó ${tarde} min tarde` : null;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const obraSeleccionada = obras.find((o) => o.id === selectedObraId);
    let fueraDeRango = false;
    if (obraSeleccionada?.latitud != null && obraSeleccionada?.longitud != null) {
      const distancia = distanciaMetros(ubicacion.lat, ubicacion.lng, obraSeleccionada.latitud, obraSeleccionada.longitud);
      fueraDeRango = distancia > obraSeleccionada.radioMetros;
    }

    const { error } = await supabase.from('registro_diario_asistencia').upsert(
      {
        empleado_id: worker.id,
        fecha: hoyISO(),
        obra_id: selectedObraId,
        estado: 'asistio',
        puntualidad,
        hora_entrada: entrada,
        nota,
        registrado_por: user?.id ?? null,
        lat_entrada: ubicacion.lat,
        lng_entrada: ubicacion.lng,
        fuera_de_rango: fueraDeRango,
        device_id: deviceId,
      },
      { onConflict: 'empleado_id,fecha' },
    );

    setWorking(false);
    if (error) {
      showToast('No se pudo registrar. Intenta de nuevo.');
      return;
    }

    setRegistro({ obra_id: selectedObraId, estado: 'asistio', puntualidad, hora_entrada: entrada, hora_salida: null, nota });
    checkPop.setValue(0);
    Animated.spring(checkPop, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    const obraNombre = obras.find((o) => o.id === selectedObraId)?.nombre ?? '';
    setConfirmacionExito({
      titulo: 'Entrada registrada',
      mensaje: `Marcaste tu llegada a las ${entrada.slice(0, 5)} en ${obraNombre}.${tarde > 0 ? ` Llegaste ${tarde} min tarde.` : ''}`,
    });
  }

  function confirmarSalida() {
    if (working || !registro?.hora_entrada) return;
    const minutosTrabajados = minutosDesdeMedianoche(horaActual()) - minutosDesdeMedianoche(registro.hora_entrada);
    if (minutosTrabajados < MIN_MINUTOS_ANTES_DE_SALIDA) {
      const faltan = MIN_MINUTOS_ANTES_DE_SALIDA - minutosTrabajados;
      showToast(`Aún es muy pronto. Podrás marcar salida en ${faltan} min`);
      return;
    }
    setConfirmSalidaOpen(true);
  }

  async function marcarSalida(notaSalida?: string) {
    if (working || !registro) return;
    setWorking(true);

    const ubicacion = await obtenerUbicacion();
    if (!ubicacion.ok) {
      setWorking(false);
      showToast(
        ubicacion.motivo === 'permiso'
          ? 'Activa el permiso de ubicación para poder marcar tu salida'
          : 'No se pudo obtener tu ubicación. Revisa tu GPS e intenta de nuevo',
      );
      return;
    }

    const salida = horaActual();
    const obraSalida = obras.find((o) => o.id === registro.obra_id);
    let fueraDeRangoSalida = false;
    if (obraSalida?.latitud != null && obraSalida?.longitud != null) {
      const distancia = distanciaMetros(ubicacion.lat, ubicacion.lng, obraSalida.latitud, obraSalida.longitud);
      fueraDeRangoSalida = distancia > obraSalida.radioMetros;
    }

    const { error } = await supabase
      .from('registro_diario_asistencia')
      .update({
        hora_salida: salida,
        lat_salida: ubicacion.lat,
        lng_salida: ubicacion.lng,
        fuera_de_rango_salida: fueraDeRangoSalida,
        ...(notaSalida ? { nota_salida: notaSalida } : {}),
      })
      .eq('empleado_id', worker.id)
      .eq('fecha', hoyISO());

    setWorking(false);
    if (error) {
      showToast('No se pudo registrar la salida. Intenta de nuevo.');
      return;
    }
    setRegistro((prev) => (prev ? { ...prev, hora_salida: salida } : prev));
    setConfirmacionExito({
      titulo: 'Salida registrada',
      mensaje: `Marcaste tu salida a las ${salida.slice(0, 5)}. Tu jornada de hoy quedó completa.`,
    });
  }

  function confirmarSalidaModal() {
    if (salidaTardia && motivoSalida.trim().length === 0) return;
    setConfirmSalidaOpen(false);
    marcarSalida(salidaTardia ? motivoSalida.trim() : undefined);
    setMotivoSalida('');
  }

  function cancelarSalidaModal() {
    setConfirmSalidaOpen(false);
    setMotivoSalida('');
  }

  const checkedIn = !!registro?.hora_entrada && !registro?.hora_salida;
  const checkedOut = !!registro?.hora_salida;
  const salidaTardia = minutosDesdeMedianoche(horaActual()) >= minutosDesdeMedianoche(horaExtraDesdeHoy());
  const horasHoy = registro?.hora_entrada ? formatHorasEnVivo(registro.hora_entrada, registro.hora_salida ?? now) : '0h 00m 00s';
  const minutosTrabajadosHoy = registro?.hora_entrada ? minutosDesdeMedianoche(horaActual()) - minutosDesdeMedianoche(registro.hora_entrada) : 0;
  const salidaHabilitada = minutosTrabajadosHoy >= MIN_MINUTOS_ANTES_DE_SALIDA;

  const ringColor = checkedIn || checkedOut ? AttendanceColors.success : AttendanceColors.accentTurquoise;
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });
  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const statusText = checkedOut ? 'Jornada completa' : checkedIn ? 'Ubicación registrada' : 'Sin marcar hoy';
  const buttonLabel = working
    ? 'Guardando…'
    : checkedOut
      ? 'Salida registrada'
      : checkedIn
        ? salidaHabilitada
          ? 'Marcar salida'
          : `Registrar salida disponible en ${MIN_MINUTOS_ANTES_DE_SALIDA - minutosTrabajadosHoy} min`
        : 'Marcar llegada';
  const obraSeleccionada = obras.find((o) => o.id === selectedObraId);
  const entradaLabel = registro?.hora_entrada ? `Entrada · ${registro.hora_entrada.slice(0, 5)}` : null;
  const subText = checkedOut
    ? `${entradaLabel} · Salida ${registro?.hora_salida?.slice(0, 5)}`
    : checkedIn
      ? [entradaLabel, registro?.nota].filter(Boolean).join(' · ')
      : 'Elige tu obra y toca para marcar';

  return (
    <View style={styles.screen}>
      <AmbientGlow />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {getSaludo()},{'\n'}
              {worker.nombre}.
            </Text>
            <Text style={styles.date}>{getFechaHoy()}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{worker.iniciales}</Text>
          </View>
        </View>

        <View style={styles.obraSelectorBlock}>
          <Text style={styles.obraSelectorLabel}>TU OBRA HOY</Text>
          <Pressable
            disabled={checkedIn || checkedOut || obras.length === 0}
            onPress={() => setObraPickerOpen(true)}
            style={[styles.obraDropdown, (checkedIn || checkedOut) && styles.obraChipDisabled]}>
            <Text style={[styles.obraDropdownText, !obraSeleccionada && styles.obraDropdownPlaceholder]} numberOfLines={1}>
              {obraSeleccionada?.nombre ?? (loading ? 'Cargando obras…' : obras.length === 0 ? 'No hay obras activas' : 'Elige una obra')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={AttendanceColors.textMuted} />
          </Pressable>
        </View>

        <Modal visible={obraPickerOpen} transparent animationType="fade" onRequestClose={() => setObraPickerOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setObraPickerOpen(false)}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Elige tu obra</Text>
              <ScrollView style={styles.modalList}>
                {obras.map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      setSelectedObraId(o.id);
                      setObraPickerOpen(false);
                    }}
                    style={[styles.modalOption, selectedObraId === o.id && styles.modalOptionActive]}>
                    <Text style={[styles.modalOptionText, selectedObraId === o.id && styles.modalOptionTextActive]}>{o.nombre}</Text>
                    {selectedObraId === o.id && <Ionicons name="checkmark" size={18} color={AttendanceColors.accentTurquoise} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        <Modal visible={confirmSalidaOpen} transparent animationType="fade" onRequestClose={cancelarSalidaModal}>
          <Pressable style={styles.modalBackdrop} onPress={cancelarSalidaModal}>
            <Pressable style={styles.confirmSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Marcar salida</Text>
              {salidaTardia ? (
                <>
                  <Text style={styles.confirmMessage}>
                    Has salido más tarde de tu hora habitual ({horaExtraDesdeHoy()}). Indica el motivo:
                  </Text>
                  <TextInput
                    value={motivoSalida}
                    onChangeText={setMotivoSalida}
                    placeholder="Ej: terminando de cerrar la obra"
                    placeholderTextColor={AttendanceColors.textMuted}
                    style={styles.motivoInput}
                    multiline
                  />
                </>
              ) : (
                <Text style={styles.confirmMessage}>¿Confirmas que estás terminando tu jornada?</Text>
              )}
              <View style={styles.confirmActions}>
                <Pressable
                  onPress={cancelarSalidaModal}
                  style={({ pressed }) => [styles.confirmButton, styles.confirmButtonCancel, pressed && styles.pressed]}>
                  <Text style={styles.confirmButtonCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={confirmarSalidaModal}
                  disabled={salidaTardia && motivoSalida.trim().length === 0}
                  style={({ pressed }) => [
                    styles.confirmButton,
                    styles.confirmButtonOk,
                    salidaTardia && motivoSalida.trim().length === 0 && styles.confirmButtonDisabled,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.confirmButtonOkText}>{salidaTardia ? 'Confirmar salida' : 'Sí, marcar salida'}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={!!confirmacionExito} transparent animationType="fade" onRequestClose={() => setConfirmacionExito(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.exitoSheet}>
              <View style={styles.exitoIconWrap}>
                <Ionicons name="checkmark-circle" size={64} color={AttendanceColors.success} />
              </View>
              <Text style={styles.exitoTitulo}>{confirmacionExito?.titulo}</Text>
              <Text style={styles.exitoMensaje}>{confirmacionExito?.mensaje}</Text>
              <Pressable
                onPress={() => setConfirmacionExito(null)}
                style={({ pressed }) => [styles.exitoBoton, pressed && styles.pressed]}>
                <Text style={styles.exitoBotonText}>Entendido</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={styles.checkInCard}>
          <Text style={styles.statusText}>{statusText.toUpperCase()}</Text>

          <View style={styles.checkButtonWrap}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glowRing,
                { borderColor: ringColor, opacity: glowOpacity, transform: [{ scale: glowScale }] },
              ]}
            />
            <Pressable onPress={checkedOut ? undefined : checkedIn ? confirmarSalida : marcarLlegada} disabled={checkedOut || working} style={styles.checkButton}>
              {working ? (
                <View style={styles.spinner} />
              ) : checkedIn || checkedOut ? (
                <Animated.View
                  style={{ transform: [{ scale: checkPop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
                  <Ionicons name="checkmark" size={44} color={AttendanceColors.success} />
                </Animated.View>
              ) : (
                <Ionicons name="location-outline" size={40} color={AttendanceColors.accentTurquoise} />
              )}
            </Pressable>
          </View>

          {checkedIn ? (
            <Pressable
              onPress={confirmarSalida}
              disabled={working}
              style={({ pressed }) => [
                styles.salidaButton,
                !salidaHabilitada && styles.salidaButtonDisabled,
                pressed && salidaHabilitada && styles.pressed,
              ]}>
              <Text style={[styles.salidaButtonText, !salidaHabilitada && styles.salidaButtonTextDisabled]}>{buttonLabel}</Text>
            </Pressable>
          ) : (
            <Text style={styles.buttonLabel}>{buttonLabel}</Text>
          )}
          <Text style={styles.subText}>{subText}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>HORAS HOY</Text>
            <Text style={styles.statValue}>{horasHoy}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>OBRA</Text>
            <Text style={styles.statValue} numberOfLines={1}>
              {obraSeleccionada?.nombre ?? '—'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {toast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  greeting: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeExtraBold,
    fontSize: 28,
    lineHeight: 30,
  },
  date: {
    color: AttendanceColors.textSecondary,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 13,
    marginTop: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AttendanceColors.avatarGradientStart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 15,
  },
  obraSelectorBlock: {
    marginBottom: 14,
  },
  obraSelectorLabel: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  obraDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    backgroundColor: AttendanceColors.glassBackground,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  obraChipDisabled: {
    opacity: 0.6,
  },
  obraDropdownText: {
    flex: 1,
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.plexSemiBold,
    fontSize: 14,
    marginRight: 10,
  },
  obraDropdownPlaceholder: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexRegular,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1D1712',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 34,
    maxHeight: '65%',
  },
  modalTitle: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 16,
    marginBottom: 12,
  },
  modalList: {
    maxHeight: '100%',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: AttendanceColors.glassBorder,
  },
  modalOptionActive: {
    borderBottomColor: `${AttendanceColors.accentTurquoise}55`,
  },
  modalOptionText: {
    flex: 1,
    color: AttendanceColors.textSecondary,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 14,
    marginRight: 10,
  },
  modalOptionTextActive: {
    color: AttendanceColors.accentTurquoise,
    fontFamily: AttendanceFonts.plexSemiBold,
  },
  confirmSheet: {
    backgroundColor: '#1D1712',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    padding: 20,
    marginHorizontal: 24,
  },
  exitoSheet: {
    backgroundColor: '#1D1712',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    padding: 28,
    marginHorizontal: 24,
    alignItems: 'center',
  },
  exitoIconWrap: {
    marginBottom: 16,
  },
  exitoTitulo: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeExtraBold,
    fontSize: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  exitoMensaje: {
    color: AttendanceColors.textSecondary,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  exitoBoton: {
    backgroundColor: AttendanceColors.success,
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  exitoBotonText: {
    color: '#0B1A12',
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 17,
  },
  confirmMessage: {
    color: AttendanceColors.textSecondary,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 14,
    marginBottom: 14,
  },
  motivoInput: {
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 14,
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmButtonCancel: {
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
  },
  confirmButtonCancelText: {
    color: AttendanceColors.textSecondary,
    fontFamily: AttendanceFonts.plexSemiBold,
    fontSize: 14,
  },
  confirmButtonOk: {
    backgroundColor: AttendanceColors.success,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonOkText: {
    color: '#0B1A12',
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 14,
  },
  checkInCard: {
    borderRadius: 28,
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  statusText: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  checkButtonWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  glowRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
  },
  checkButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    borderTopColor: AttendanceColors.accentTurquoise,
  },
  buttonLabel: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 17,
    marginBottom: 6,
  },
  salidaButton: {
    backgroundColor: AttendanceColors.success,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 6,
  },
  salidaButtonDisabled: {
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
  },
  salidaButtonText: {
    color: '#0B1A12',
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 16,
  },
  salidaButtonTextDisabled: {
    color: AttendanceColors.textMuted,
  },
  pressed: {
    opacity: 0.75,
  },
  subText: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 13,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    padding: 16,
  },
  statLabel: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 11.5,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeExtraBold,
    fontSize: 18,
  },
  toast: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: 'rgba(20,26,34,0.95)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    zIndex: 20,
    elevation: 20,
  },
  toastText: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 13,
  },
});
