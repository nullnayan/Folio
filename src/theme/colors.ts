export type ThemeMode = 'light' | 'dark';

export interface AppTheme {
  mode: ThemeMode;
  // surfaces
  background: string;
  backgroundSoft: string;
  card: string;
  cardElevated: string;
  border: string;
  borderSoft: string;
  searchBg: string;
  inputBg: string;
  // text
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  // brand
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  gold: string;
  goldSoft: string;
  // status
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  whatsapp: string;
  whatsappDark: string;
  // misc
  shadow: string;
  sheetHandle: string;
  stepDone: string;
  stepTodo: string;
}

export const LightTheme: AppTheme = {
  mode: 'light',
  background: '#F5F1E8',
  backgroundSoft: '#EFE9DB',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  border: '#E7DFCE',
  borderSoft: '#F0EAD9',
  searchBg: '#FFFFFF',
  inputBg: '#F7F3E9',
  text: '#1C1917',
  textSecondary: '#57534E',
  textMuted: '#A8A29E',
  textOnPrimary: '#FFFFFF',
  primary: '#4338CA',
  primarySoft: '#EEECFF',
  primaryBorder: '#C7D2FE',
  gold: '#B45309',
  goldSoft: '#FEF3C7',
  success: '#047857',
  successSoft: '#D1FAE5',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  whatsapp: '#1DA851',
  whatsappDark: '#128C4B',
  shadow: 'rgba(28, 25, 23, 0.08)',
  sheetHandle: '#D6CFC0',
  stepDone: '#4338CA',
  stepTodo: '#E7DFCE',
};

export const DarkTheme: AppTheme = {
  mode: 'dark',
  background: '#0C1120',
  backgroundSoft: '#0A0E1A',
  card: '#151D32',
  cardElevated: '#1B2540',
  border: '#263252',
  borderSoft: '#1E2943',
  searchBg: '#151D32',
  inputBg: '#1B2540',
  text: '#F8FAFC',
  textSecondary: '#A7B3C7',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',
  primary: '#818CF8',
  primarySoft: 'rgba(129, 140, 248, 0.14)',
  primaryBorder: 'rgba(129, 140, 248, 0.35)',
  gold: '#FBBF24',
  goldSoft: 'rgba(251, 191, 36, 0.14)',
  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  whatsapp: '#25D366',
  whatsappDark: '#1DA851',
  shadow: 'rgba(0, 0, 0, 0.4)',
  sheetHandle: '#2B3A5E',
  stepDone: '#818CF8',
  stepTodo: '#263252',
};

export function withAlpha(hex: string, alpha: number): string {
  // hex like #RRGGBB -> rgba()
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** @deprecated kept for old imports — use LightTheme / DarkTheme */
export const Colors = {
  background: DarkTheme.background,
  surface: DarkTheme.card,
  surfaceLight: DarkTheme.cardElevated,
  surfaceBorder: DarkTheme.border,
  text: DarkTheme.text,
  textSecondary: DarkTheme.textSecondary,
  textMuted: DarkTheme.textMuted,
  gold: '#F59E0B',
  goldBg: 'rgba(245, 158, 11, 0.12)',
  blue: '#3B82F6',
  blueBg: 'rgba(59, 130, 246, 0.12)',
  emerald: '#10B981',
  emeraldBg: 'rgba(16, 185, 129, 0.12)',
  purple: '#8B5CF6',
  purpleBg: 'rgba(139, 92, 246, 0.12)',
  rose: '#F43F5E',
  roseBg: 'rgba(244, 63, 94, 0.12)',
  cyan: '#06B6D4',
  cyanBg: 'rgba(6, 182, 212, 0.12)',
  primaryButton: '#F59E0B',
  primaryButtonText: '#0B1220',
  danger: '#EF4444',
  success: '#10B981',
};
