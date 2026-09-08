import { defineConfig } from "@playwright/test";
import "dotenv/config";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.TEST_WEB_URL || "http://localhost:5173",
    headless: true,
  },
  reporter: "list",
  timeout: 30000,
});
