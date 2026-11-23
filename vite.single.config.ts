import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/** One HTML file with JS, CSS, and fonts inlined so it opens from disk. */
export default defineConfig({
  base: "./",
  plugins: [
    viteSingleFile({
      removeViteModuleLoader: true,
      outputFileName: "meridian.html",
    }),
  ],
  build: {
    outDir: "dist-single",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    modulePreload: false,
  },
});
