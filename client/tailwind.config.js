/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#050506",
        fg: "#fafafa",
        muted: "#71717a",
        primary: "#a855f7",
        danger: "#f87171",
        purple: "#a855f7",
        gold: "#fbbf24",
        success: "#4ade80",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
