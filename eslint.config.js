// Flat ESLint config for the whole monorepo.
// Formatting is Prettier's job (eslint-config-prettier disables conflicting rules).
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.astro/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "server/pb_data/**",
      "server/pb_public/**",
      "server/pb_migrations/**",
      "server/pb_hooks/**",
      "client/src/lib/pb-types.ts",
    ],
  },

  // Base rules for all TypeScript files
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["warn", { fixStyle: "inline-type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },

  // Client: browser globals + React rules
  {
    files: ["client/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // shadcn/ui files export cva variants next to components; that is fine.
  {
    files: ["client/src/components/ui/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },

  // Node-side code: services, server seeds, e2e, scripts, config files
  {
    files: [
      "services/**/*.ts",
      "server/seed/**/*.ts",
      "e2e/**/*.ts",
      "scripts/**/*.ts",
      "strategy/tools/*.ts",
      "**/*.config.{ts,js,mts}",
      "**/jest.setup.ts",
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },

  // Tests: allow console + jest globals
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.jest, ...globals.node, ...globals.browser } },
    rules: { "no-console": "off", "react-refresh/only-export-components": "off" },
  },

  prettier,
);
