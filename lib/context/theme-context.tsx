'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'fleetwatch-theme',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');

  // Initial load from storage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored) setTheme(stored);
  }, [storageKey]);

  // Handle theme changes and system preferences
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    const resolveTheme = (t: Theme): 'dark' | 'light' => {
      if (t === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return t;
    };

    const resolved = resolveTheme(theme);
    root.classList.add(resolved);
    setResolvedTheme(resolved);

    // Update color-scheme CSS property
    root.style.colorScheme = resolved;

    // Listen for system changes if in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        const newResolved = resolveTheme('system');
        root.classList.remove('light', 'dark');
        root.classList.add(newResolved);
        setResolvedTheme(newResolved);
        root.style.colorScheme = newResolved;
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: (newTheme) => {
          localStorage.setItem(storageKey, newTheme);
          setTheme(newTheme);
        },
        resolvedTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
