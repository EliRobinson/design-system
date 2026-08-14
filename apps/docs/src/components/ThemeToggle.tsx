'use client';

import { useEffect, useState } from 'react';

import { Button } from '@elirobinson/react/components/atoms/Button';

import { THEME_STORAGE_KEY, type Theme, isTheme } from '../lib/theme';

export function ThemeToggle() {
  /* Seeded from the DOM after mount rather than during render. The inline
     bootstrap has already set the attribute by then, but the prerendered HTML
     was built without it, so reading it during render would disagree with what
     the server sent. */
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(isTheme(current) ? current : 'light');
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.setAttribute('data-theme', next);
        setTheme(next);

        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          /* Same reasoning as the bootstrap: a blocked store costs the
             preference on the next visit, not this interaction. */
        }
      }}
    >
      {next === 'dark' ? 'Dark' : 'Light'}
    </Button>
  );
}
