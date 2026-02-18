import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		outDir: "dist",
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			input: {
				background: resolve(__dirname, "./background.js"),
				content: resolve(__dirname, "./content.js"),
				popup: resolve(__dirname, "popup/popup.html"),
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
