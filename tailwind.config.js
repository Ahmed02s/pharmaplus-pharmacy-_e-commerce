/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e8f5f0',
          100: '#c5e6d8',
          200: '#9fd4bc',
          300: '#72c1a0',
          400: '#4db38a',
          500: '#1a9e6e',
          600: '#0f8a5c',
          700: '#077348',
          800: '#025c36',
          900: '#014727',
        },
        accent: {
          50:  '#fff8e1',
          100: '#ffecb3',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        modal: '0 20px 60px rgba(0,0,0,0.18)',
      }
    },
  },
  plugins: [],
}
