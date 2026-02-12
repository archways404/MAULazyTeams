import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		outDir: "dist",
		emptyOutDir: true,
		sourcemap: true, // helps debugging extensions a LOT
		rollupOptions: {
			input: {
				background: resolve(__dirname, "./background.js"),
				content: resolve(__dirname, "./content.js"),
				popup: resolve(__dirname, "popup/popup.html"), // ✅ this bundles popup.js too
			},
			output: {
				// MV3 likes stable filenames for entries
				entryFileNames: "[name].js",
				chunkFileNames: "chunks/[name]-[hash].js",
				assetFileNames: "assets/[name]-[hash][extname]",
				format: "es",
			},
		},
	},
});
