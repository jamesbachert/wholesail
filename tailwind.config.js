/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // WholeSail Brand Colors
        brand: {
          deep: '#0A7E8C',
          ocean: '#1B98A8',
          cyan: '#2EC4D4',
        },
        // Dark mode surfaces
        dark: {
          bg: '#0B1120',
          surface: '#131D35',
          elevated: '#1A2744',
          border: '#1E3050',
        },
        // Light mode surfaces
        light: {
          bg: '#F8FAFB',
          surface: '#FFFFFF',
          elevated: '#F1F5F9',
          border: '#E2E8F0',
        },
        // Semantic
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#2EC4D4',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
