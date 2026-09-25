/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#0a0e14",
          panel: "#0f1620",
          card: "#151e2b",
          border: "#1e293b",
          online: "#10b981",
          repair: "#f59e0b",
          failed: "#ef4444",
          accent: "#38bdf8",
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
