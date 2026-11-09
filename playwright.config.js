import { defineConfig, devices } from "@playwright/test";
const exe = process.env.CHROME_PATH || undefined;
const chrome = (d) => ({ ...d, browserName: "chromium", launchOptions: exe ? { executablePath: exe } : {} });
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  workers: 2,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL || "http://127.0.0.1:8787", trace: "off" },
  projects: [
    { name: "iphone", use: chrome(devices["iPhone 15 Pro"]) },
    { name: "android", use: chrome(devices["Pixel 7"]) },
    { name: "ipad", use: chrome(devices["iPad Pro 11"]) },
    { name: "desktop", use: chrome({ ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }) },
  ],
});
