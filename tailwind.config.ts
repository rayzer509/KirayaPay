import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F7F6F2',
        surface: '#FFFFFF',
        navy: '#1C2B3A',
        saffron: {
          DEFAULT: '#E8870A',
          light: '#FEF3E2',
        },
        sage: {
          DEFAULT: '#4A7C6F',
          light: '#EAF4F1',
        },
        coral: {
          DEFAULT: '#E8503A',
          light: '#FEF0EE',
        },
        slate: {
          DEFAULT: '#64748B',
          light: '#F1F5F9',
        },
        border: '#E8E6DF',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
      },
      width: {
        sidebar: '220px',
      },
      fontSize: {
        'money': ['0.9375rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
};

export default config;
