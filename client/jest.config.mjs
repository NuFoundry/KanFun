/** @type {import('jest').Config} */
export default {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  setupFiles: ["<rootDir>/jest.polyfills.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(tsx?|mjs)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },
  // Everything in node_modules is left alone except the ESM-only SDK (pnpm keeps it under .pnpm/).
  transformIgnorePatterns: ["/node_modules/(?!\\.pnpm/pocketbase@|pocketbase/)"],
  moduleNameMapper: {
    // Anything that touches import.meta.env lives in src/lib/env.ts; Jest gets a static stand-in.
    "^@/lib/env$": "<rootDir>/src/test/env.mock.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
    // react-markdown and its unified/remark tree are ESM-only; tests render the text as is.
    "^react-markdown$": "<rootDir>/src/test/react-markdown.mock.tsx",
    "^remark-(gfm|math)$": "<rootDir>/src/test/remark-gfm.mock.ts",
    // The SDK's CJS build has no named exports (ClientResponseError), so use the ESM build and
    // let ts-jest transpile it (see transform + transformIgnorePatterns below).
    "^pocketbase$": "<rootDir>/node_modules/pocketbase/dist/pocketbase.es.mjs",
    "\\.(css|less|scss)$": "identity-obj-proxy",
    "\\.(svg|png|jpe?g|gif|webp)$": "<rootDir>/src/test/file.mock.ts",
  },
  clearMocks: true,
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/components/ui/**",
    "!src/main.tsx",
    "!src/test/**",
    "!src/lib/pb-types.ts",
    "!src/vite-env.d.ts",
  ],
};
