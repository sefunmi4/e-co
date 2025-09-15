import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        eco: {
          plasma: '#7C3AED',
          neon: '#22D3EE',
          void: '#0F172A',
        },
      },
    },
  },
  plugins: [],
};

export default config;
