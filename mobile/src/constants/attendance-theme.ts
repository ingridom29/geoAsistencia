// Design tokens from design_handoff_asistencia_app/README.md, converted from oklch to hex/rgba
// because React Native's style engine does not parse oklch().
export const AttendanceColors = {
  screenBackground: '#17130F',
  glowAmberStrong: 'rgba(217,121,58,0.6)',
  glowAmberDeep: 'rgba(168,69,43,0.5)',
  glowBrown: 'rgba(110,75,46,0.4)',

  avatarGradientStart: '#C98A4A',
  avatarGradientEnd: '#96502C',

  accentAmber: '#F2A968',
  accentTurquoise: '#6FCFDD',
  success: '#74CB93',
  alert: '#E2694A',

  textPrimary: '#F8F7FA',
  textSecondary: '#A8ABB2',
  textMuted: '#ABAEB5',

  glassBackground: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.10)',

  pinDotEmptyFill: 'rgba(255,255,255,0.15)',
  pinDotEmptyBorder: 'rgba(255,255,255,0.25)',

  keypadBackground: 'rgba(255,255,255,0.06)',
  keypadBorder: 'rgba(255,255,255,0.08)',
} as const;

export const AttendanceFonts = {
  manropeBold: 'Manrope_700Bold',
  manropeExtraBold: 'Manrope_800ExtraBold',
  manropeSemiBold: 'Manrope_600SemiBold',
  plexRegular: 'IBMPlexSans_400Regular',
  plexMedium: 'IBMPlexSans_500Medium',
  plexSemiBold: 'IBMPlexSans_600SemiBold',
} as const;
