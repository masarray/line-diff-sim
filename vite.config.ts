import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Relative assets keep local preview and the GitHub Pages project path
  // https://masarray.github.io/line-diff-sim/ on the same static build.
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
