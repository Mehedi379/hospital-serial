/* Shared Tailwind theme — crimson palette derived from the hospital logo (#c22832). */
/* Loaded before the Tailwind CDN / vendored script so tailwind.config picks it up.  */
/* Keeps Reception / Assistant / Launcher visually in sync with the TV display.      */
window.tailwind = window.tailwind || {};
tailwind.config = {
  theme: {
    extend: {
      colors: {
        surface: '#fbf8f8',
        'surface-bright': '#fbf8f8',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f6f2f2',
        'surface-container': '#f0eaea',
        'surface-container-high': '#eae4e4',
        'surface-container-highest': '#e3dddd',
        'surface-variant': '#e5e0e0',
        'on-surface': '#1e1919',
        'on-surface-variant': '#4c4444',
        outline: '#7d7575',
        'outline-variant': '#cdc5c5',
        /* Deep crimson brand (headers, TV panels) */
        primary: '#3a0a0d',
        'primary-container': '#3a0a0d',
        'on-primary': '#ffffff',
        'on-primary-container': '#e6a9a9',
        'primary-fixed': '#ffdad7',
        'primary-fixed-dim': '#e6b6b6',
        /* Crimson accent (buttons, serials) */
        secondary: '#c22832',
        'on-secondary': '#ffffff',
        'secondary-container': '#ff5a5f',
        'on-secondary-container': '#7a0010',
        'secondary-fixed': '#ffdad7',
        'secondary-fixed-dim': '#ffb3ad',
        'on-secondary-fixed': '#3d0006',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        warning: '#9a6700',
        success: '#0f7b3f',
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { DEFAULT: '0.375rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem' },
    },
  },
};

/* The vendored Play-CDN build replaces window.tailwind with a Proxy at init and
   generates styles from its own (empty) config — any pre-init window.tailwind.config
   is discarded. Assigning the config AFTER init goes through the Proxy's set trap,
   which stores it AND rebuilds the stylesheet with the custom theme. The real CDN
   supports the same post-init assignment, so this works with both builds. */
(function syncTailwindConfig() {
  // Capture NOW, while `tailwind` is still the plain object this file just created —
  // after the vendored script runs, `tailwind` is the Proxy and .config would be {}.
  const themed = tailwind.config;
  const apply = () => { try { window.tailwind.config = themed; } catch (e) { console.warn('theme.js: could not sync Tailwind config', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
