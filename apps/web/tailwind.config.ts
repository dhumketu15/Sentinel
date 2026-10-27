import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#071126",
          900: "#0B1733",
          800: "#101F43",
        },
        violet: {
          500: "#8B5CF6",
          400: "#A78BFA",
          100: "#EDE9FE",
        },
      },
      fontFamily: {
        display: ["Sora", "Noto Sans Devanagari", "system-ui", "sans-serif"],
        sans: ["Inter", "Noto Sans Devanagari", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 18px 50px -36px rgba(5, 10, 28, 0.55)",
        glow: "0 18px 45px -30px rgba(139, 92, 246, 0.7)",
      },
    },
  },
  plugins: [],
} satisfies Config;
