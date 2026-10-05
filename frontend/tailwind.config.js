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
        cream: {
          50: '#FEFCF9',
          100: '#FAF7F2',
          200: '#F4EFE6',
          300: '#EBE3D5',
        },
        sand: {
          50: '#FAF8F5',
          100: '#F5EFE6',
          200: '#EDE3D5',
          300: '#DFCDB8',
          400: '#CBB296',
          500: '#B29474',
        },
        cognac: {
          50: '#FBF7F4',
          100: '#F5ECE3',
          200: '#EBD7C4',
          300: '#DCBDA1',
          400: '#C69A72',
          500: '#A8764B',
          600: '#8C5E37',
          700: '#704729',
          800: '#573720',
          900: '#3D2516',
        },
        charcoal: {
          50: '#F6F6F6',
          100: '#E7E7E7',
          200: '#D1D1D1',
          300: '#B0B0B0',
          400: '#888888',
          500: '#636363',
          600: '#464646',
          700: '#2E2E2E',
          800: '#1C1B1A',
          900: '#121110',
          950: '#0A0A09',
        },
        sage: {
          50: '#F4F7F4',
          100: '#E6EBE5',
          500: '#7E9181',
          600: '#637566',
        },
        dustyrose: {
          50: '#FAF5F5',
          100: '#F4E7E7',
          500: '#B88686',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        editorial: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft-sm': '0 2px 8px -2px rgba(28, 27, 26, 0.05), 0 1px 4px -1px rgba(28, 27, 26, 0.03)',
        'soft': '0 4px 20px -2px rgba(28, 27, 26, 0.06), 0 2px 6px -1px rgba(28, 27, 26, 0.02)',
        'soft-lg': '0 12px 32px -4px rgba(28, 27, 26, 0.08), 0 4px 12px -2px rgba(28, 27, 26, 0.03)',
        'soft-xl': '0 20px 48px -8px rgba(28, 27, 26, 0.12), 0 8px 16px -4px rgba(28, 27, 26, 0.04)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}

