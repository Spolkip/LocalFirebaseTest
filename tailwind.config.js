/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'title': ['"IM Fell English SC"', 'serif'],
      },
      colors: {
        // You can define custom colors here if you want
      }
    },
  },
  plugins: [],
}
