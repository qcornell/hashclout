import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        arena: {
          bg: '#0a0a0f',
          card: '#14141f',
          border: '#2a2a3a',
          purple: '#8b5cf6',
          'purple-dark': '#6d28d9',
          fire: '#f97316',
          win: '#22c55e',
          loss: '#ef4444',
          gold: '#fbbf24',
          muted: '#71717a',
        }
      }
    },
  },
  plugins: [],
}
export default config
