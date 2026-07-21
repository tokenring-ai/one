import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  resolve: {
    alias: [
      {
        // Catches any import starting with 'node:'
        find: /(^node:)|(Service|Registry)\.ts$/,
        replacement: "/src/forbidden-node-module-error.js"
      }
    ]
  }
});
