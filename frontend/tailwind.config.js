/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        cyber: {
          slate: '#0b0f19',
          obsidian: '#030712',
          cyan: '#06b6d4',
          teal: '#0d9488',
          indigo: '#6366f1',
          blue: '#2563eb',
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(6, 182, 212, 0.15)',
        'glow-teal': '0 0 15px rgba(13, 148, 136, 0.15)',
        'glow-brand': '0 0 15px rgba(37, 99, 235, 0.2)',
        'glow-cyan-lg': '0 0 30px rgba(6, 182, 212, 0.35)',
        'glow-brand-lg': '0 0 30px rgba(37, 99, 235, 0.35)',
        'glow-teal-lg': '0 0 30px rgba(13, 148, 136, 0.35)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};
