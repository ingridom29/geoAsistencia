import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttendanceColors, AttendanceFonts } from '@/constants/attendance-theme';
import { useAuth } from '@/hooks/use-auth';

const PIN_LENGTH = 4;
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
  const { worker, signIn } = useAuth();
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
      const success = signIn(next);
      if (!success) {
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
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />
      <View style={[styles.glow, styles.glowThree]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBlock}>
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
          <Text style={styles.obra}>{worker.obra}</Text>

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
                          backgroundColor: error ? AttendanceColors.alert : AttendanceColors.accentAmber,
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
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  glowOne: {
    width: 380,
    height: 380,
    backgroundColor: AttendanceColors.glowAmberStrong,
    opacity: 0.35,
    top: -60,
    left: -90,
  },
  glowTwo: {
    width: 320,
    height: 320,
    backgroundColor: AttendanceColors.glowAmberDeep,
    opacity: 0.3,
    top: '22%',
    right: -110,
  },
  glowThree: {
    width: 300,
    height: 300,
    backgroundColor: AttendanceColors.glowBrown,
    opacity: 0.25,
    bottom: -40,
    left: 20,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 26,
  },
  topBlock: {
    alignItems: 'center',
    paddingTop: 90,
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
  },
  obra: {
    color: AttendanceColors.textSecondary,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 12.5,
    marginTop: 2,
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
});
