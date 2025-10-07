/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1f4b99',
          50: '#e6edfb',
          100: '#c4d3f5',
          200: '#9db7ef',
          300: '#769ae8',
          400: '#4f7de0',
          500: '#3563c7',
          600: '#284c9b',
          700: '#1f3c7a',
          800: '#142955',
          900: '#0a162f'
        }
      }
    }
  },
  plugins: []
};
