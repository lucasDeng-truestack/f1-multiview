import type { Config } from "tailwindcss";

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
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      borderRadius: {
        panel: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
