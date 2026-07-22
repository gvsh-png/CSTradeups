import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d141d",
        surface: {
          DEFAULT: "#0d141d",
          panel: "#16191e",
          low: "#151c25",
          container: "#192029",
          high: "#232a34",
          highest: "#2e353f",
          raised: "#232a34",
          border: "#4e4639",
          hover: "#2e353f",
        },
        accent: {
          DEFAULT: "#e9c176",
          dim: "#c5a059",
          muted: "#e9c17620",
          ink: "#412d00",
        },
        outline: {
          DEFAULT: "#9a8f80",
          variant: "#4e4639",
        },
        profit: "#5ecf8e",
        loss: "#e35d5d",
        rarity: {
          consumer: "#b0c3d9",
          industrial: "#5e98d9",
          milspec: "#4b69ff",
          restricted: "#8847ff",
          classified: "#d32ce6",
          covert: "#eb4b4b",
          extraordinary: "#e4ae39",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      maxWidth: {
        container: "1280px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.55s ease-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
