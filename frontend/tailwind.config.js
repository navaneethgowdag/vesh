/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Official TailorBird Editorial Fashion Palette
        brand: {
          ink: '#202321',        // Primary Deep Charcoal Ink
          ivory: '#F8F6F1',      // Warm Editorial Canvas
          sage: '#899783',       // Signature Muted Sage
          stone: '#E9E6DE',      // Soft Architectural Stone
          taupe: '#B5AA99',      // Supporting Warm Taupe
          olive: '#727D69',      // Accent Muted Olive
          deep: '#292D29',       // High-Contrast Deep Text
          muted: '#777C75',      // High-Contrast Secondary Text
          sand: '#D8D3C8',       // Light Stone Accent
          dark: '#141715',       // Dark Mode Canvas Background
          darkSurface: '#1C201D',// Dark Mode Card Surface
          darkSubtle: '#252A26', // Dark Mode Hover / Subtle Surface
          darkBorder: '#2E3530', // Dark Mode Fine Borders
        },

        // Surface Design Tokens (Dynamic CSS Variable Mapping)
        luxury: {
          bg: 'var(--luxury-bg, #F8F6F1)',
          surface: 'var(--luxury-surface, #FFFFFF)',
          surfaceSubtle: 'var(--luxury-surface-subtle, #F1EEE7)',
          elevated: 'var(--luxury-elevated, #FFFFFF)',
          text: 'var(--luxury-text, #202321)',
          textMuted: 'var(--luxury-text-muted, #777C75)',
          primary: 'var(--luxury-primary, #202321)',
          secondary: 'var(--luxury-secondary, #727D69)',
          muted: 'var(--luxury-muted, #777C75)',
          champagne: 'var(--luxury-champagne, #899783)',
          olive: 'var(--luxury-olive, #727D69)',
          border: 'var(--luxury-border, #E4DFD5)',
          borderSubtle: 'var(--luxury-border-subtle, #EFECE4)',
          espresso: 'var(--luxury-espresso, #202321)',
          // Dark Tokens
          'dark-bg': 'var(--luxury-dark-bg, #141715)',
          'dark-surface': 'var(--luxury-dark-surface, #1C201D)',
          'dark-surfaceSubtle': 'var(--luxury-dark-surface-subtle, #252A26)',
          'dark-text': 'var(--luxury-dark-text, #F8F6F1)',
          'dark-textMuted': 'var(--luxury-dark-text-muted, #A2A89F)',
          'dark-border': 'var(--luxury-dark-border, #2E3530)',
          'dark-champagne': 'var(--luxury-dark-champagne, #899783)',
          'dark-espresso': 'var(--luxury-dark-espresso, #141715)',
        },

        // Backward compatibility scales refined to fashion palette
        champagne: {
          DEFAULT: '#899783',
          50: '#F7F8F6',
          100: '#EFF2ED',
          200: '#DDE2D9',
          300: '#C2CBC0',
          400: '#A4B0A1',
          500: '#899783',
          600: '#727D69',
          700: '#5A6353',
          800: '#434A3E',
          900: '#2E332B',
        },
        olive: {
          DEFAULT: '#727D69',
          50: '#F5F7F4',
          100: '#EAEFE8',
          200: '#D5DFD2',
          300: '#B8C7B3',
          400: '#95A68F',
          500: '#727D69',
          600: '#5C6554',
          700: '#474E41',
          800: '#343930',
          900: '#202321',
        },
        espresso: {
          DEFAULT: '#202321',
          50: '#F8F6F1',
          100: '#E9E6DE',
          200: '#D8D3C8',
          300: '#B5AA99',
          400: '#777C75',
          500: '#50564E',
          600: '#3A3F38',
          700: '#292D29',
          800: '#202321',
          900: '#141715',
          950: '#0C0E0D',
        },
        cream: {
          50: '#FFFFFF',
          100: '#FDFCF9',
          200: '#F8F6F1',
          300: '#E9E6DE',
        },
        sand: {
          50: '#F8F6F1',
          100: '#E9E6DE',
          200: '#D8D3C8',
          300: '#C5BEB0',
          400: '#B5AA99',
          500: '#777C75',
        },
        cognac: {
          DEFAULT: '#899783',
          50: '#F7F8F6',
          100: '#EFF2ED',
          200: '#DDE2D9',
          300: '#C2CBC0',
          400: '#A4B0A1',
          500: '#899783',
          600: '#727D69',
          700: '#5A6353',
          800: '#434A3E',
          900: '#2E332B',
        },
        charcoal: {
          50: '#F8F6F1',
          100: '#E9E6DE',
          200: '#D8D3C8',
          300: '#A2A89F',
          400: '#777C75',
          500: '#50564E',
          600: '#3A3F38',
          700: '#292D29',
          800: '#202321',
          900: '#141715',
          950: '#0C0E0D',
        },
        sage: {
          50: '#F7F8F6',
          100: '#EFF2ED',
          200: '#DDE2D9',
          300: '#C2CBC0',
          400: '#A4B0A1',
          500: '#899783',
          600: '#727D69',
          700: '#5A6353',
          800: '#434A3E',
          900: '#2E332B',
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        serif: [
          '"Playfair Display"',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'serif',
        ],
        editorial: [
          '"Playfair Display"',
          'Georgia',
          'serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(32, 35, 33, 0.04)',
        'soft-sm': '0 1px 3px 0 rgba(32, 35, 33, 0.06)',
        'soft': '0 2px 6px -1px rgba(32, 35, 33, 0.07), 0 1px 3px -1px rgba(32, 35, 33, 0.04)',
        'soft-md': '0 4px 12px -2px rgba(32, 35, 33, 0.08), 0 2px 4px -2px rgba(32, 35, 33, 0.04)',
        'soft-lg': '0 8px 24px -4px rgba(32, 35, 33, 0.09), 0 4px 8px -4px rgba(32, 35, 33, 0.03)',
        'soft-xl': '0 16px 36px -6px rgba(32, 35, 33, 0.12), 0 6px 12px -4px rgba(32, 35, 33, 0.04)',
        'dark-soft': '0 2px 8px 0 rgba(0, 0, 0, 0.35)',
        'dark-lg': '0 8px 24px -2px rgba(0, 0, 0, 0.55)',
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        DEFAULT: '8px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
        '2xl': '22px',
        '3xl': '28px',
        'full': '9999px',
      },
    },
  },
  plugins: [],
}
