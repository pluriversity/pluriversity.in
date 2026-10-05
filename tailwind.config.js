module.exports = {
  content: ["./src/**/*.html", "!./_site/**", "!./node_modules/**"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {},
    },
  },
  variants: {},
  plugins: [require("@tailwindcss/typography")],
};
