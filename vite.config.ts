import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => ({
  base: mode === "demo" ? process.env.PAGES_BASE_PATH || "/" : "/",
  build: { outDir: mode === "demo" ? "dist-demo" : "dist" },
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key}",
        "**/.git/**",
        "**/server/**",
        "**/*.db*",
        "**/*.sqlite*",
        "**/tests/**",
      ],
    },
    proxy: { "/api": process.env.API_PROXY_TARGET || "http://127.0.0.1:3001" },
  },
}));
