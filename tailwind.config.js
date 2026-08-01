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
        bg: {
          primary: "#060810",
          secondary: "#0a0d1a",
          tertiary: "#0f1424",
          card: "rgba(255, 255, 255, 0.035)",
          "card-hover": "rgba(255, 255, 255, 0.06)",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.07)",
          hover: "rgba(255, 255, 255, 0.14)",
          accent: "rgba(59, 130, 246, 0.3)",
        },
        accent: {
          blue: "#3b82f6",
          "blue-light": "#60a5fa",
          "blue-hover": "#2563eb",
          purple: "#6366f1",
          "purple-light": "#818cf8",
          emerald: "#10b981",
          "emerald-light": "#34d399",
          red: "#ef4444",
          "red-light": "#f87171",
          cyan: "#22d3ee",
          orange: "#f97316",
        },
        text: {
          primary: "#eef2ff",
          secondary: "#7c8ba8",
          muted: "#4a5568",
        },
        // Legacy aliases mapped to myCloud palette
        background: "#060810",
        surface: "#0a0d1a",
        primary: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
          glow: "#60a5fa",
        },
      },
      fontFamily: {
        sans: ['Inter', -apple-system, 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
        roboto: ['Roboto', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
      boxShadow: {
        'sm-dark': '0 1px 3px rgba(0,0,0,0.4)',
        'md-dark': '0 4px 20px rgba(0,0,0,0.5)',
        'lg-dark': '0 20px 60px rgba(0,0,0,0.6)',
        'glow': '0 0 40px rgba(59,130,246,0.15)',
        'glow-sm': '0 0 20px rgba(59,130,246,0.25)',
        'glow-emerald': '0 0 20px rgba(16,185,129,0.3)',
      },
      backgroundImage: {
        'grad-blue-purple': 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
        'grad-text': 'linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #a78bfa 100%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'pulse-ring': 'pulseRing 2s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'shimmer': 'shimmer 2.5s infinite',
        'blob': 'blob 7s infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(0.8)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.5)' },
          '70%': { boxShadow: '0 0 0 8px rgba(16,185,129,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

