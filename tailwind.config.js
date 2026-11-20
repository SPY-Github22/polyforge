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
        studio: {
          950: '#0d1117',
          900: '#161b22',
          850: '#1c2128',
          800: '#21262d',
          750: '#2d333b',
          700: '#30363d',
          600: '#484f58',
          500: '#6e7681',
          accent: '#388bfd',
          warning: '#d29922',
          success: '#2ea043',
          danger: '#f85149',
          purple: '#a371f7',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
