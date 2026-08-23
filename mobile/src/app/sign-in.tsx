import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientGlow } from '@/components/ambient-glow';
import { AttendanceColors, AttendanceFonts } from '@/constants/attendance-theme';
import { clearSavedDni, getSavedDni, lookupWorkerByDni, pinFromFecha, saveDni, useAuth, type Worker } from '@/hooks/use-auth';

const PIN_LENGTH = 4;
const ADMIN_PANEL_URL = process.env.EXPO_PUBLIC_ADMIN_PANEL_URL ?? 'https://sgds.pe/empleados/';

const KEYPAD_ROWS: Array<Array<{ label: string; value: string } | null>> = [
  [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
  ],
  [
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
  ],
  [
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
  ],
  [null, { label: '0', value: '0' }, { label: '⌫', value: 'backspace' }],
];

export default function SignInScreen() {
  const [selected, setSelected] = useState<Worker | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedDni = await getSavedDni();
      if (!savedDni) {
        if (!cancelled) setBooting(false);
        return;
      }
      const result = await lookupWorkerByDni(savedDni);
      if (cancelled) return;
      if (result.ok) {
        setSelected(result.worker);
      } else if (result.reason !== 'network') {
        // DNI no longer valid on this device (deactivated, role changed) — forget it.
        await clearSavedDni();
      }
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChangeUser() {
    await clearSavedDni();
    setSelected(null);
  }

  if (booting) {
    return (
      <View style={styles.screen}>
        <AmbientGlow />
        <SafeAreaView style={[styles.safeArea, styles.bootingContainer]}>
          <ActivityIndicator color={AttendanceColors.accentTurquoise} />
        </SafeAreaView>
      </View>
    );
  }

  if (!selected) {
    return (
      <DniEntry
        onFound={(worker) => {
          saveDni(worker.dni);
          setSelected(worker);
        }}
      />
    );
  }

  return <PinEntry worker={selected} onBack={handleChangeUser} />;
}

function DniEntry({ onFound }: { onFound: (worker: Worker) => void }) {
  const [dni, setDni] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (loading) return;
    setLoading(true);
    setError(null);
    const result = await lookupWorkerByDni(dni.trim());
    setLoading(false);

    if (result.ok) {
      onFound(result.worker);
      return;
    }
    if (result.reason === 'office_role') {
      setError('Tu cargo usa el panel web de administración, no esta app.');
    } else if (result.reason === 'network') {
      setError('No se pudo conectar. Intenta de nuevo.');
    } else {
      setError('No encontramos ese DNI. Verifica e intenta de nuevo.');
    }
  }

  return (
    <View style={styles.screen}>
      <AmbientGlow />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pickerTopBlock}>
          <Text style={styles.pickerTitle}>Ingresa tu DNI</Text>
          <Text style={styles.pickerSubtitle}>Lo usamos para identificarte y marcar tu asistencia</Text>
        </View>

        <TextInput
          value={dni}
          onChangeText={(v) => {
            setDni(v.replace(/[^0-9]/g, ''));
            setError(null);
          }}
          placeholder="Número de DNI"
          placeholderTextColor={AttendanceColors.textMuted}
          keyboardType="number-pad"
          maxLength={8}
          style={[styles.dniInput, error && styles.dniInputError]}
          onSubmitEditing={handleContinue}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          onPress={handleContinue}
          disabled={dni.length === 0 || loading}
          style={({ pressed }) => [styles.continueButton, (dni.length === 0 || loading) && styles.continueButtonDisabled, pressed && styles.pressed]}>
          {loading ? (
            <ActivityIndicator color={AttendanceColors.accentTurquoise} />
          ) : (
            <Text style={styles.continueButtonText}>Continuar</Text>
          )}
        </Pressable>

        <Pressable onPress={() => Linking.openURL(ADMIN_PANEL_URL)} hitSlop={8} style={styles.adminLink}>
          <Text style={styles.adminLinkText}>¿Eres del área administrativa? Ingresa aquí</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function PinEntry({ worker, onBack }: { worker: Worker; onBack: () => void }) {
  const { signInAs } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  // Mirrors `pin` synchronously so rapid taps can't read a stale value from a not-yet-flushed render.
  const pinRef = useRef('');

  function triggerShake() {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -0.6, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0.6, duration: 90, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  }

  function handleKeyPress(value: string) {
    if (error) return;

    if (value === 'backspace') {
      pinRef.current = pinRef.current.slice(0, -1);
      setPin(pinRef.current);
      return;
    }

    if (pinRef.current.length >= PIN_LENGTH) return;
    const next = pinRef.current + value;
    pinRef.current = next;
    setPin(next);

    if (next.length === PIN_LENGTH) {
      const expectedPin = pinFromFecha(worker.fechaNacimiento);
      const success = expectedPin !== '' && expectedPin === next;
      if (success) {
        signInAs(worker);
      } else {
        setError(true);
        triggerShake();
        setTimeout(() => {
          pinRef.current = '';
          setPin('');
          setError(false);
        }, 550);
      }
    }
  }

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <View style={styles.screen}>
      <AmbientGlow />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBlock}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Cambiar usuario</Text>
          </Pressable>

          <LinearGradient
            colors={[AttendanceColors.avatarGradientStart, AttendanceColors.avatarGradientEnd]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.avatar}>
            <Text style={styles.avatarText}>{worker.iniciales}</Text>
          </LinearGradient>

          <Text style={styles.name}>
            {worker.nombre} {worker.apellido}
          </Text>

          <Text style={styles.prompt}>
            {error ? 'PIN incorrecto, intenta de nuevo' : 'Ingresa tu PIN para marcar asistencia'}
          </Text>

          <Animated.View style={[styles.dotsRow, { transform: [{ translateX }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => {
              const filled = i < pin.length;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    filled
                      ? {
                          backgroundColor: error ? AttendanceColors.alert : AttendanceColors.accentTurquoise,
                          transform: [{ scale: 1.1 }],
                        }
                      : {
                          backgroundColor: AttendanceColors.pinDotEmptyFill,
                          borderWidth: 1.5,
                          borderColor: AttendanceColors.pinDotEmptyBorder,
                        },
                  ]}
                />
              );
            })}
          </Animated.View>
        </View>

        <View style={styles.spacer} />

        <View style={styles.keypad}>
          {KEYPAD_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((key, keyIndex) =>
                key ? (
                  <Pressable
                    key={key.value}
                    onPress={() => handleKeyPress(key.value)}
                    style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
                    <Text style={key.value === 'backspace' ? styles.keyBackspace : styles.keyLabel}>
                      {key.label}
                    </Text>
                  </Pressable>
                ) : (
                  <View key={`empty-${rowIndex}-${keyIndex}`} style={styles.key} />
                ),
              )}
            </View>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AttendanceColors.screenBackground,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 26,
  },
  bootingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBlock: {
    alignItems: 'center',
    paddingTop: 60,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 22,
  },
  backButtonText: {
    color: AttendanceColors.textSecondary,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 13,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 22,
  },
  name: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 17,
    marginBottom: 26,
  },
  prompt: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 13,
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 8,
  },
  spacer: {
    flex: 1,
  },
  keypad: {
    gap: 14,
    marginBottom: 34,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  key: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: AttendanceColors.keypadBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.keypadBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: {
    opacity: 0.6,
  },
  keyLabel: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeSemiBold,
    fontSize: 22,
  },
  keyBackspace: {
    color: AttendanceColors.textSecondary,
    fontSize: 20,
  },
  pickerTopBlock: {
    alignItems: 'center',
    paddingTop: 90,
    marginBottom: 30,
  },
  pickerTitle: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeExtraBold,
    fontSize: 24,
    marginBottom: 8,
  },
  pickerSubtitle: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 13,
    textAlign: 'center',
  },
  dniInput: {
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: 'center',
  },
  dniInputError: {
    borderColor: AttendanceColors.alert,
  },
  errorText: {
    color: AttendanceColors.alert,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 12.5,
    marginTop: 10,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: `${AttendanceColors.accentTurquoise}26`,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: AttendanceColors.accentTurquoise,
    fontFamily: AttendanceFonts.plexSemiBold,
    fontSize: 15,
  },
  adminLink: {
    alignItems: 'center',
    marginTop: 22,
  },
  adminLinkText: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexMedium,
    fontSize: 12.5,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
});
