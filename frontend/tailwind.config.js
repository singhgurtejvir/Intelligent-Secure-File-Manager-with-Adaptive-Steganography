export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          base: '#0A0B0F',
          surface: '#111318',
          elevated: '#181C24',
        },
        luxe: {
          gold: '#C8A96E',
          teal: '#2DD4BF',
          rose: '#FB7185',
          blue: '#60A5FA',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

