import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

function getInitialTheme() {
  const stored = localStorage.getItem('pulse_theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply theme to DOM whenever this instance changes
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pulse_theme', theme);
  }, [theme]);

  // Stay in sync when any other ThemeToggle instance changes the theme
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const t = document.documentElement.dataset.theme;
      if (t) setTheme(t);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
