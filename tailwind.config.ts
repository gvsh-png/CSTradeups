import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: "#030304",
          elevated: "#08080d",
        },
        surface: {
          DEFAULT: "#0c0c12",
          raised: "#111118",
          border: "#1c1c28",
          hover: "#16161f",
        },
        accent: {
          DEFAULT: "#00d4aa",
          dim: "#00a884",
          muted: "#00d4aa20",
        },
        profit: "#00e676",
        loss: "#ff5252",
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
        DEFAULT: "6px",
        lg: "8px",
        xl: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
