import { useEffect, useState } from 'react';
import { tsParticles } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';

let _ready = false;
let _initPromise = null;

function ensureEngine() {
  if (_ready) return Promise.resolve();
  if (!_initPromise) {
    _initPromise = loadSlim(tsParticles)
      .then(() => { _ready = true; })
      .catch(() => { _initPromise = null; });
  }
  return _initPromise;
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

// dark: --accent-info #5B8DEF  |  light: --accent-info #3D6FD1
// Both values come directly from THEME.md tokens.
function accentColor(theme) {
  return theme === 'light' ? '#3D6FD1' : '#5B8DEF';
}

function buildOptions(theme) {
  const color = accentColor(theme);
  const isLight = theme === 'light';

  return {
    background: { color: { value: 'transparent' } },
    fpsLimit: 50,
    interactivity: {
      events: {
        onHover: { enable: true, mode: 'grab' },
        resize: { enable: true },
      },
      modes: {
        grab: { distance: 180, links: { opacity: isLight ? 0.85 : 0.7 } },
      },
    },
    particles: {
      color: { value: color },
      links: {
        color,
        distance: 200,
        enable: true,
        // Light bg needs higher link opacity so thin lines stay clearly visible
        opacity: isLight ? 0.6 : 0.45,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.6,
        direction: 'none',
        random: true,
        straight: false,
        outModes: { default: 'bounce' },
      },
      number: { value: 300, density: { enable: false } },
      // Light bg needs higher dot opacity for the same reason
      opacity: { value: isLight ? { min: 0.6, max: 1.0 } : { min: 0.45, max: 0.9 } },
      shape: { type: 'circle' },
      size: { value: { min: 1.5, max: 3.5 } },
    },
    detectRetina: true,
  };
}

export default function ParticleBackground() {
  const [ready, setReady] = useState(_ready);

  useEffect(() => {
    if (_ready) { setReady(true); return; }
    let alive = true;
    ensureEngine().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    let container = null;
    // Sequence counter — rapid theme toggles discard in-flight loads cleanly
    let seq = 0;

    async function load() {
      const mySeq = ++seq;
      const c = await tsParticles.load({
        id: 'bg-particles',
        options: buildOptions(currentTheme()),
      });
      if (!mounted || mySeq !== seq) { c?.destroy(); return; }
      container?.destroy();
      container = c;
    }

    load();

    // Re-load whenever ThemeToggle flips data-theme on <html>
    const observer = new MutationObserver(() => {
      console.log('[ParticleBackground] data-theme changed →', document.documentElement.dataset.theme);
      if (mounted) load();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      mounted = false;
      observer.disconnect();
      container?.destroy();
    };
  }, [ready]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <div id="bg-particles" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
