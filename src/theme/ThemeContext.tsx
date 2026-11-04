import React, { createContext, useContext } from 'react';
import { AppTheme } from './colors';

export interface ThemeBag {
  theme: AppTheme;
  isDark: boolean;
}

const ThemeCtx = createContext<ThemeBag | null>(null);

export const ThemeProvider: React.FC<{ theme: AppTheme; children: React.ReactNode }> = ({
  theme,
  children,
}) => {
  return (
    <ThemeCtx.Provider value={{ theme, isDark: theme.mode === 'dark' }}>
      {children}
    </ThemeCtx.Provider>
  );
};

export function useTheme(): ThemeBag {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
