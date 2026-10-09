import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// The cloud build environment ships a pinned Chromium; use it when present so
// the e2e suite never needs to download a browser.
const pinned = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.PW_CHROMIUM ?? (existsSync(pinned) ? pinned : undefined);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
    permissions: [],
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
