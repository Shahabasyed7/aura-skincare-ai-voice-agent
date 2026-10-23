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
        cream: {
          50: "#FCFBF8",
          100: "#FAF8F2", // Main background
          200: "#F3EFE6",
          300: "#E9E3D5",
          400: "#DDD4C1",
        },
        eucalyptus: {
          50: "#F4F6F4",
          100: "#E5ECE5",
          200: "#CBD8CB",
          300: "#A8BFA7",
          400: "#86A385",
          500: "#6B8068", // Primary button & active states
          600: "#576A54",
          700: "#455443",
          800: "#364335",
        },
        mist: {
          50: "#F5F8F4",
          100: "#EDF3EC",
          200: "#DCE7D8", // Soft surfaces & voice animation
          300: "#C4D6BF",
        },
        pistachio: {
          100: "#EDF2E6",
          200: "#DCE5D1",
          300: "#C9D4B5", // Subtle highlights
        },
        olive: {
          500: "#536B58",
          600: "#3E5142",
          700: "#2F3E32",
          800: "#29372D", // Deep olive text & headings
          900: "#1E2921",
          950: "#141C16",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      animation: {
        "orb-breathe": "orbBreathe 6s ease-in-out infinite",
        "orb-listen": "orbListen 2.5s ease-in-out infinite",
        "orb-speak": "orbSpeak 1.6s ease-in-out infinite",
        "orb-think": "orbThink 2s linear infinite",
        "pulse-subtle": "pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        orbBreathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        orbListen: {
          "0%, 100%": { transform: "scale(1)", filter: "brightness(1)" },
          "50%": { transform: "scale(1.08)", filter: "brightness(1.08)" },
        },
        orbSpeak: {
          "0%, 100%": { transform: "scale(1)", filter: "brightness(1)" },
          "50%": { transform: "scale(1.12)", filter: "brightness(1.15)" },
        },
        orbThink: {
          "0%": { transform: "rotate(0deg) scale(1)" },
          "50%": { transform: "rotate(180deg) scale(1.05)" },
          "100%": { transform: "rotate(360deg) scale(1)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
