// Prettier for the whole repo (AGENTS.md section 7). Tailwind class sorting runs last.
export default {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./client/src/styles.css",
  tailwindFunctions: ["cn", "cva"],
  overrides: [{ files: "web/**", options: { tailwindStylesheet: "./web/src/styles/site.css" } }],
};
