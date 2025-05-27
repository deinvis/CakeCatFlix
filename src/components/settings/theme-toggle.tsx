"use client";

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Moon, Sun } from 'lucide-react';
import { LOCALSTORAGE_THEME_KEY } from '@/lib/constants';

export function ThemeToggle() {
  // Initialize state from localStorage or default to dark theme
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem(LOCALSTORAGE_THEME_KEY);
      return storedTheme ? storedTheme === 'dark' : true; // Default to dark
    }
    return true; // Default server-side, will be corrected on client
  });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Ensure the class is set on initial client mount based on initial state
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]); // Rerun if isDarkMode changes (e.g. from initial localStorage read)


  const toggleTheme = (checked: boolean) => {
    setIsDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(LOCALSTORAGE_THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(LOCALSTORAGE_THEME_KEY, 'light');
    }
  };

  if (!isMounted) {
    // Render a placeholder or null during SSR/hydration to avoid mismatch
    // This is important because localStorage is not available on the server.
    return (
      <Card className="shadow-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-6 w-6 text-primary opacity-50" /> / <Moon className="h-6 w-6 text-primary opacity-50" /> Tema
          </CardTitle>
          <CardDescription>Carregando preferência de tema...</CardDescription>
        </CardHeader>
        <CardContent className="h-12 animate-pulse bg-muted/50 rounded-md"></CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isDarkMode ? <Moon className="h-6 w-6 text-primary" /> : <Sun className="h-6 w-6 text-primary" />}
           Tema
        </CardTitle>
        <CardDescription>Alterne entre o tema claro e escuro para a aplicação.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch
            id="theme-switch"
            checked={isDarkMode}
            onCheckedChange={toggleTheme}
            aria-label="Alternar tema escuro"
          />
          <Label htmlFor="theme-switch" className="text-base">
            {isDarkMode ? 'Tema Escuro' : 'Tema Claro'}
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
