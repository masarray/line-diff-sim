import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Relative assets allow the same build to work at a GitHub Pages project path
  // such as https://owner.github.io/line-diff-lab/ and in local preview.
  base: "./",
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
