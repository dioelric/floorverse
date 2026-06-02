/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EEF5FF',
          100: '#D5E8FF',
          200: '#B3D4FF',
          300: '#80B3F5',
          400: '#4D8FE0',
          500: '#2D7DD2',
          600: '#1A6BBF',
          700: '#1A3C6B',
          800: '#0D2547',
          900: '#061428',
        },
        accent: {
          500: '#F05D23',
          600: '#D94F1B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
