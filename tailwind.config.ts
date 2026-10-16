import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'quest-blue': '#1d4ed8',
        'quest-navy': '#1e3a5f',
        'quest-light': '#eff6ff',
        'quest-accent': '#f59e0b',
      },
    },
  },
  plugins: [],
}

export default config
