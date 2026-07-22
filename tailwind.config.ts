import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0d1117",
          deep: "#0b0e11",
        },
        surface: {
          DEFAULT: "#1a1b1e",
          panel: "#1a1b1e",
          low: "#161b22",
          container: "#1a1b1e",
          high: "#22252b",
          highest: "#2a2e36",
          raised: "#22252b",
          border: "#2a2e36",
          hover: "#2a2e36",
        },
        accent: {
          DEFAULT: "#0041c2",
          dim: "#00359f",
          bright: "#1a5ad4",
          muted: "#0041c222",
          ink: "#ffffff",
        },
        secondary: {
          DEFAULT: "#0041c2",
          dim: "#00359f",
          bright: "#1a5ad4",
          ink: "#ffffff",
        },
        tertiary: {
          DEFAULT: "#8fa5d6",
        },
        outline: {
          DEFAULT: "#9ca3af",
          variant: "#2a2e36",
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
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      maxWidth: {
        container: "1280px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
