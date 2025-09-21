/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f5ff',
          100: '#e6e6ff',
          200: '#c4c6ff',
          300: '#9ea4ff',
          400: '#7a82ff',
          500: '#585ef8',
          600: '#3a3cd4',
          700: '#2b2baa',
          800: '#202180',
          900: '#161757'
        }
      }
    }
  },
  plugins: [],
};
