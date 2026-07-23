import type { Browser } from "puppeteer-core";
import { createRequire } from "module";
import { existsSync } from "fs";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);

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

  // Resolve the chromium bin directory using createRequire to find the
  // actual package location at runtime (important when the package is
  // externalized but its binary assets may not be at the expected path).
  let executablePath: string;

  try {
    // First attempt: let @sparticuz/chromium resolve the path itself
    // This works when the package is properly externalized from the bundler.
    executablePath = await Chromium.executablePath();
  } catch {
    // Second attempt: manually resolve the bin directory path using
    // require.resolve to find the package location, then navigate to bin/
    // This handles cases where import.meta.url gets transformed by the bundler.
    try {
      const chromiumPkgPath = require.resolve("@sparticuz/chromium/package.json");
      const binDir = join(dirname(chromiumPkgPath), "bin");

      if (!existsSync(binDir)) {
        throw new Error(`Chromium bin directory not found at: ${binDir}`);
      }

      executablePath = await Chromium.executablePath(binDir);
    } catch (innerError) {
      console.error("[Browser] Failed to resolve @sparticuz/chromium bin path:", innerError);
      throw new Error(
        "Could not find chromium binary. Ensure @sparticuz/chromium is properly installed " +
        "and its bin/ directory is included in the deployment. " +
        "See: https://github.com/Sparticuz/chromium#bundler-configuration"
      );
    }
  }

  const browser = await puppeteer.default.launch({
    args: Chromium.args,
    executablePath,
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
