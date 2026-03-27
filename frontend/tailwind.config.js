/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        akan: {
          DEFAULT: '#af4408',
          light: '#d4651e',
          dark: '#8a3506',
        },
        cream: '#FFF8F0',
        status: {
          confirmed: '#16a34a',
          tentative: '#eab308',
          cancelled: '#ef4444',
          completed: '#6366f1',
          pending: '#f97316',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
