import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '375px',
      },
      colors: {
        // Rich dark navy technical palette (preserves NetMentor identity)
        canvas: {
          DEFAULT: '#0a0f1d', // rich space navy canvas
          subtle: '#0d1424',  // slightly lifted section background
        },
        surface: {
          DEFAULT: '#111a2e',       // primary card surface (deep slate navy)
          subtle: '#0c1322',        // recessed/inset surface
          elevated: '#17233d',      // elevated panels, dropdowns, modals
          interactive: '#1d2c4d',   // hover / active state
          border: 'rgba(255, 255, 255, 0.08)',
          'border-subtle': 'rgba(255, 255, 255, 0.05)',
          'border-strong': 'rgba(255, 255, 255, 0.16)',
        },
        // NetMentor Primary Networking Blue
        accent: {
          DEFAULT: '#0c87eb', // vivid networking blue (original brand-500)
          hover: '#0073cc',   // deeper blue on active/hover
          vivid: '#36a6f6',   // bright blue text highlight
          subtle: 'rgba(12, 135, 235, 0.14)',
          border: 'rgba(12, 135, 235, 0.4)',
        },
        // Success (Operational / Mastered Green)
        success: {
          DEFAULT: '#10b981', // healthy emerald
          hover: '#059669',
          subtle: 'rgba(16, 185, 129, 0.14)',
          border: 'rgba(16, 185, 129, 0.35)',
        },
        // Warning (Protocol trap / Amber)
        warning: {
          DEFAULT: '#f59e0b',
          subtle: 'rgba(245, 158, 11, 0.14)',
          border: 'rgba(245, 158, 11, 0.35)',
        },
        // Error (Danger Red)
        danger: {
          DEFAULT: '#ef4444',
          subtle: 'rgba(239, 68, 68, 0.14)',
          border: 'rgba(239, 68, 68, 0.35)',
        },
        // Full original brand scale for backward compatibility
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc5fb',
          400: '#36a6f6',
          500: '#0c87eb',
          600: '#006ac9',
          700: '#0154a3',
          800: '#064786',
          900: '#0b3c6f',
          950: '#07264a',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'elevated-sm': '0 2px 8px -1px rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        'elevated-md': '0 8px 24px -4px rgba(0, 0, 0, 0.5), 0 2px 6px -2px rgba(0, 0, 0, 0.4)',
        'elevated-lg': '0 16px 40px -8px rgba(0, 0, 0, 0.65), 0 4px 12px -2px rgba(0, 0, 0, 0.45)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'glow-brand': '0 0 20px -3px rgba(12, 135, 235, 0.35)',
        'glow-brand-sm': '0 0 12px -2px rgba(12, 135, 235, 0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config;
