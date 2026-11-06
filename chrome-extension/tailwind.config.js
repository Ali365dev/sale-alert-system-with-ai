/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        primary: "#E7000B",
        "primary-dark": "#B50008",
        dark: "#0D0D11",
        accent: "#FACC15",
        surface: "#17171D",
        "surface-2": "#1F1F27",
        "surface-3": "#282832",
        line: "#27272F",
        t1: "#F0F0F4",
        t2: "#9898A8",
        t3: "#5A5A68",
      },
      // Status badges/toasts use Tailwind's green/red/orange/amber/blue-500
      // at ~8% bg opacity + 20% border opacity + 400 text — keep new status
      // UI on this one convention instead of ad-hoc 900/20 or raw hex.
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
