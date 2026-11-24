import type { Config } from "tailwindcss";

const withAlpha = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      colors: {
        bg: withAlpha("--bg"),
        surface: withAlpha("--surface"),
        "surface-2": withAlpha("--surface-2"),
        border: withAlpha("--border"),
        ink: withAlpha("--ink"),
        muted: withAlpha("--muted"),
        primary: { DEFAULT: withAlpha("--primary"), fg: withAlpha("--primary-fg"), soft: withAlpha("--primary-soft") },
        accent: { DEFAULT: withAlpha("--accent"), soft: withAlpha("--accent-soft") },
        success: { DEFAULT: withAlpha("--success"), soft: withAlpha("--success-soft") },
        warning: { DEFAULT: withAlpha("--warning"), soft: withAlpha("--warning-soft") },
        danger: { DEFAULT: withAlpha("--danger"), soft: withAlpha("--danger-soft") },
        info: { DEFAULT: withAlpha("--info"), soft: withAlpha("--info-soft") },
        side: { DEFAULT: withAlpha("--side"), ink: withAlpha("--side-ink"), muted: withAlpha("--side-muted"), hover: withAlpha("--side-hover") },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.2rem" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.06), 0 4px 16px -6px rgb(var(--shadow) / 0.10)",
        pop: "0 12px 40px -8px rgb(var(--shadow) / 0.28)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "slide-in": { from: { transform: "translateX(-100%)" }, to: { transform: "none" } },
        progress: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(250%)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in .25s ease-out both",
        "slide-in": "slide-in .22s ease-out both",
        progress: "progress 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
