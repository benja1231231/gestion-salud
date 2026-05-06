import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0066cc",
        "primary-focus": "#0071e3",
        "primary-on-dark": "#2997ff",
        canvas: "#ffffff",
        "canvas-parchment": "#f5f5f7",
        "surface-pearl": "#fafafc",
        "surface-tile-1": "#272729",
        "surface-tile-2": "#2a2a2c",
        "surface-tile-3": "#252527",
        "surface-black": "#000000",
        ink: "#1d1d1f",
        "body-on-dark": "#ffffff",
        "body-muted": "#cccccc",
        "ink-muted-80": "#333333",
        "ink-muted-48": "#7a7a7a",
        "divider-soft": "#f0f0f0",
        hairline: "#e0e0e0",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "18px",
        pill: "9999px",
      },
      spacing: {
        section: "80px",
      },
    },
  },
  plugins: [],
};
export default config;
