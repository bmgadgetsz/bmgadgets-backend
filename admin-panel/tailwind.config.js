/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "rgba(226, 232, 240, 0.8)",
        input: "#cbd5e1",
        background: "#f8fafc",
        foreground: "#0f172a",
        primary: {
          DEFAULT: "#3b82f6", // Electric Blue
          dark: "#2563eb",
          light: "#60a5fa",
        },
        success: "#10b981", // Green
        warning: "#f59e0b", // Amber
        danger: "#ef4444", // Red
      },
    },
  },
  plugins: [],
}
