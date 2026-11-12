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
        // Editorial Atelier Official Palette
        atelier: {
          aubergine: '#29202B',  // Midnight Aubergine (Primary text, navigation)
          porcelain: '#F3EEE8',  // Porcelain (Main page background)
          oxblood: '#743C49',    // Oxblood (Primary accent and important actions)
          rose: '#D5A6A0',       // Dusty Rose (Secondary accent)
          camel: '#B49B82',      // Muted Camel (Supporting accent)
          white: '#FFFFFF',      // Gallery White (Content surfaces)
          olive: '#6D7068',      // Slate Olive (Secondary interface elements)
          taupe: '#DCD4CC',      // Soft Taupe (Borders and dividers)
          error: '#A33D42',      // Error Red
          success: '#426B50',    // Success Green
          // Dark Atelier mode tokens
          darkBg: '#1A151C',
          darkSurface: '#241D27',
          darkBorder: '#392F3E',
          darkText: '#F3EEE8',
          darkMuted: '#A89E9B',
        },

        // Official TailorBird Editorial Fashion Palette
        brand: {
          ink: '#29202B',        // Midnight Aubergine
          ivory: '#F3EEE8',      // Porcelain
          sage: '#6D7068',       // Slate Olive
          stone: '#DCD4CC',      // Soft Taupe
          taupe: '#B49B82',      // Muted Camel
          olive: '#743C49',      // Oxblood
          deep: '#29202B',       // Midnight Aubergine
          muted: '#6D7068',      // Slate Olive
          sand: '#D5A6A0',       // Dusty Rose
          dark: '#1A151C',       // Dark Atelier Canvas
          darkSurface: '#241D27',// Dark Atelier Surface
          darkSubtle: '#2C2430', // Dark Atelier Subtle
          darkBorder: '#392F3E', // Dark Atelier Border
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
          '"Cormorant Garamond"',
          '"Playfair Display"',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'serif',
        ],
        editorial: [
          '"Cormorant Garamond"',
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
