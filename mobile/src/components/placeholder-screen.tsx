import { StyleSheet, Text, View } from 'react-native';

import { AttendanceColors, AttendanceFonts } from '@/constants/attendance-theme';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Próximamente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AttendanceColors.screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: AttendanceColors.textPrimary,
    fontFamily: AttendanceFonts.manropeBold,
    fontSize: 20,
    marginBottom: 6,
  },
  subtitle: {
    color: AttendanceColors.textMuted,
    fontFamily: AttendanceFonts.plexRegular,
    fontSize: 13,
  },
});
