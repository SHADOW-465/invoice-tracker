import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite serves the UI and forwards /api to the ledger server (npm run dev:server).
// In production both come from the same Node process, so no proxy is involved.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 3000,
    open: false,
    proxy: { "/api": "http://127.0.0.1:4321" }
  }
});
