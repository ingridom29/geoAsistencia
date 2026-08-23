import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AttendanceColors, AttendanceFonts } from '@/constants/attendance-theme';
import { useAuth } from '@/hooks/use-auth';

export default function PerfilScreen() {
  const { worker, signOut } = useAuth();
  if (!worker) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{worker.iniciales}</Text>
      </View>
      <Text style={styles.name}>
        {worker.nombre} {worker.apellido}
      </Text>

      <Pressable onPress={signOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AttendanceColors.screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: AttendanceColors.avatarGradientStart,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 28,
  },
  name: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 18,
    marginBottom: 32,
  },
  signOutButton: {
    backgroundColor: AttendanceColors.glassBackground,
    borderWidth: 1,
    borderColor: AttendanceColors.glassBorder,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  signOutText: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.plexSemiBold,
    fontSize: 14,
  },
});
