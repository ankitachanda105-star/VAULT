/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-0': '#07090d',
        'bg-1': '#0c1118',
        'bg-2': '#131a24',
        'line': 'rgba(148, 163, 184, 0.08)',
        'accent': '#22d3ee',
        'accent-2': '#a78bfa',
        'ok': '#10b981',
        'warn': '#f59e0b',
        'bad': '#ef4444',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
