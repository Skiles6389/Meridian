import { defineConfig } from "@playwright/test";

/*
 * End-to-end checks in real browser engines: WebKit (the engine behind Safari) and Chromium. Each
 * runs against the dev server and against the single-file build in play/, which is what gets played.
 * Set E2E_URL to also run against a deployed copy.
 */

const PORT = 8733;
const dev = `http://127.0.0.1:${PORT}/`;
const built = `file://${process.cwd()}/play/dogfight.html`;
const live = process.env.E2E_URL;
/** Headless Chromium has no GPU: software WebGL keeps the moving backdrop in the picture. */
const gl = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts$/,
  timeout: 180_000,
  fullyParallel: true,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 2,
  reporter: [["list"]],
  webServer: { command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`, url: dev, reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "webkit-dev", use: { browserName: "webkit" }, metadata: { url: dev } },
    { name: "webkit-built", use: { browserName: "webkit" }, metadata: { url: built } },
    { name: "chromium-dev", use: { browserName: "chromium", launchOptions: gl }, metadata: { url: dev } },
    { name: "chromium-built", use: { browserName: "chromium", launchOptions: gl }, metadata: { url: built } },
    ...(live
      ? [
          { name: "webkit-live", use: { browserName: "webkit" as const }, metadata: { url: live } },
          { name: "chromium-live", use: { browserName: "chromium" as const, launchOptions: gl }, metadata: { url: live } },
        ]
      : []),
  ],
});
