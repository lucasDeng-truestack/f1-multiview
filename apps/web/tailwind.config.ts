import type { Config } from "tailwindcss";

// Semantic tokens mapped from globals.css — brand.md is the source of truth.
// Components should use these (bg-panel, text-mid, border-hairline, text-label)
// instead of raw values.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        panel: "var(--bg-panel)",
        raised: "var(--bg-raised)",
        border: "var(--border)",
        "border-hi": "var(--border-hi)",
        "text-hi": "var(--text-hi)",
        "text-mid": "var(--text-mid)",
        "text-low": "var(--text-low)",
        purple: "var(--purple)",
        green: "var(--green)",
        yellow: "var(--yellow)",
        red: "var(--red)",
        cyan: "var(--cyan)",
        "white-best": "var(--white-best)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        label: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
        data: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      // Type scale (brand.md): 11 unit · 13 label · 15 body · 20 title · 28 hero
      fontSize: {
        unit: ["11px", "1.4"],
        label: ["13px", "1.4"],
        body: ["15px", "1.4"],
        title: ["20px", "1.2"],
        hero: ["28px", "1"],
      },
      borderWidth: {
        hairline: "0.5px",
      },
      borderRadius: {
        panel: "6px",
      },
      transitionDuration: {
        tick: "120ms",
        flash: "600ms",
      },
    },
  },
  plugins: [],
};

export default config;
