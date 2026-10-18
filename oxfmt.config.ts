import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: ["dist/**", "*.min.js"],
    svelte: true,
});