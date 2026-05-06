/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn baseline
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },

        // dear-baby palette
        coral: "#D4836B",
        peach: "#F5C6A8",
        cream: "#FAF6F1",
        beige: "#F0E6D8",
        ivory: "#FFFFFF",
        sage: "#A8C5A0",
        teal: "#7BACA3",
        gold: "#D4B896",
        ink: {
          DEFAULT: "#3D2E1E",
          sub: "#8C7B6B",
          muted: "#B5A898",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "db-xs": "8px",
        "db-sm": "12px",
        "db-md": "16px",
        "db-lg": "20px",
        "db-xl": "24px",
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Noto Sans KR",
          "Malgun Gothic",
          "sans-serif",
        ],
        serif: ['"Noto Serif KR"', "Georgia", "serif"],
        display: ['"Playfair Display"', "Georgia", "serif"],
        hand: ['"Nanum Pen Script"', "cursive"],
      },
      boxShadow: {
        "db-sm": "0 2px 8px rgba(61, 46, 30, 0.06)",
        "db-md": "0 4px 16px rgba(61, 46, 30, 0.08)",
        "db-lg": "0 8px 24px rgba(61, 46, 30, 0.12)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "pulse-soft": { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: ".85", transform: "scale(1.04)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
