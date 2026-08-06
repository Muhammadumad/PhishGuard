import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "./phishguard-frontend",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
