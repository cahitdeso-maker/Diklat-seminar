import type { Browser } from "puppeteer-core";

/**
 * Launch Puppeteer browser dengan konfigurasi optimal untuk:
 * - Vercel Serverless (via @sparticuz/chromium v149)
 * - Local development (via system Chrome yang terinstall)
 *
 * Menggunakan `puppeteer-core` (tanpa bundled Chromium) agar deployment tetap ringan.
 */
export async function launchBrowser(): Promise<Browser> {
  const isVercel = process.env.VERCEL === "1" || process.env.AWS_EXECUTION_ENV !== undefined;

  if (isVercel) {
    return launchVercelBrowser();
  }
  return launchLocalBrowser();
}

async function launchVercelBrowser(): Promise<Browser> {
  // @sparticuz/chromium v149: class Chromium with static getters/methods
  const chromiumModule = await import("@sparticuz/chromium");
  const Chromium = chromiumModule.default || chromiumModule;

  const puppeteer = await import("puppeteer-core");

  const browser = await puppeteer.default.launch({
    args: Chromium.args,
    executablePath: await Chromium.executablePath(),
    headless: true,
  });

  return browser as unknown as Browser;
}

async function launchLocalBrowser(): Promise<Browser> {
  const { detectBrowser } = await import("./detect-browser");
  const puppeteer = await import("puppeteer-core");

  const executablePath = detectBrowser();

  if (executablePath) {
    console.log(`[Browser] Using local Chrome: ${executablePath}`);
    const browser = await puppeteer.default.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    return browser as unknown as Browser;
  }

  // Fallback: biarkan puppeteer-core menentukan sendiri
  console.log("[Browser] No local Chrome found, using puppeteer-core default...");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  return browser as unknown as Browser;
}
