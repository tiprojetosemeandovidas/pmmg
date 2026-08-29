import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "api/**",
    "scripts/**",
    "tests/**/*.js",
    "lib/**/*.js",
    "public/admin.js",
    "public/edital.js",
    "public/rota-engine.js",
  ]),
]);
