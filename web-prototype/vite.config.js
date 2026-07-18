import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (
            id.includes("node_modules/tone") ||
            id.includes("node_modules/standardized-audio-context")
          ) {
            return "tone";
          }
          return undefined;
        },
      },
    },
  },
});
