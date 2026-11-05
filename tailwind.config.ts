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
        // Unified Industrial Telecom Console Palette
        canvas: {
          DEFAULT: '#090A0C', // root background
          subtle: '#0D0F12',
        },
        'canvas-subtle': '#0D0F12',
        surface: {
          DEFAULT: '#111317',       // base card / module surface
          subtle: '#0D0F12',        // recessed / inset surface
          elevated: '#181B21',      // elevated cards / active states
          interactive: '#20242C',   // hover / interactive items
          border: '#232730',
          'border-subtle': 'rgba(255, 255, 255, 0.05)',
          'border-strong': 'rgba(255, 255, 255, 0.16)',
        },
        'surface-elevated': '#181B21',
        'surface-interactive': '#20242C',
        'surface-subtle': '#0D0F12',
        'border-hairline': '#232730',
        accent: {
          DEFAULT: '#F59E0B', // signal amber / primary accent
          hover: '#D97706',
          vivid: '#FBBF24',
          subtle: 'rgba(245, 158, 11, 0.14)',
          border: 'rgba(245, 158, 11, 0.4)',
        },
        'accent-vivid': '#FBBF24',
        'status-converged': '#10B981', // telemetry green / success
        'status-alert': '#EF4444',     // drop red / error

        // Preserved semantic mappings for component compatibility
        success: {
          DEFAULT: '#10B981',
          hover: '#059669',
          subtle: 'rgba(16, 185, 129, 0.14)',
          border: 'rgba(16, 185, 129, 0.35)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          subtle: 'rgba(245, 158, 11, 0.14)',
          border: 'rgba(245, 158, 11, 0.35)',
        },
        danger: {
          DEFAULT: '#EF4444',
          subtle: 'rgba(239, 68, 68, 0.14)',
          border: 'rgba(239, 68, 68, 0.35)',
        },
        // Brand scale mapped to warm industrial amber/gold
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
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
        'glow-brand': '0 0 20px -3px rgba(245, 158, 11, 0.35)',
        'glow-brand-sm': '0 0 12px -2px rgba(245, 158, 11, 0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config;
