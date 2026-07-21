import puppeteer, { Browser } from "puppeteer";
import fs from "fs";
import path from "path";

/**
 * Cari executable Chrome/Chromium dengan urutan prioritas:
 * 1. Environment variable PUPPETEER_EXECUTABLE_PATH
 * 2. Puppeteer's bundled Chrome (dari cache)
 * 3. System Chrome/Chromium (Linux: /usr/bin/chromium-browser, /usr/bin/google-chrome, etc.)
 *
 * Mengembalikan path jika ditemukan, null jika tidak.
 */
function findChromeExecutable(): string | null {
  // Prioritas 1: Environment variable
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Prioritas 2: Puppeteer cache path
  const cacheDir = resolveCacheDir();
  if (cacheDir) {
    const chromePath = findInPuppeteerCache(cacheDir);
    if (chromePath) return chromePath;
  }

  // Prioritas 3: System Chrome/Chromium (Linux)
  if (process.platform === "linux") {
    return findSystemChrome();
  }

  return null;
}

/**
 * Resolve Puppeteer cache directory.
 */
function resolveCacheDir(): string | null {
  if (process.env.PUPPETEER_CACHE_DIR) {
    return process.env.PUPPETEER_CACHE_DIR;
  }

  if (process.platform === "win32") {
    return process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, ".cache", "puppeteer")
      : null;
  }

  return path.join(process.env.HOME || "/root", ".cache", "puppeteer");
}

/**
 * Cari Chrome di dalam Puppeteer cache directory.
 * Puppeteer menyimpan Chrome di: <cacheDir>/chrome/<platform>-<revision>/chrome-<platform>/chrome
 */
function findInPuppeteerCache(cacheDir: string): string | null {
  const chromeDir = path.join(cacheDir, "chrome");
  if (!fs.existsSync(chromeDir)) return null;

  const browserDirs = fs.readdirSync(chromeDir);
  if (browserDirs.length === 0) return null;

  // Urutkan descending dan ambil versi terbaru
  browserDirs.sort().reverse();
  const latestDir = browserDirs[0];

  const chromePath = path.join(
    chromeDir,
    latestDir,
    process.platform === "win32"
      ? "chrome-win64\\chrome.exe"
      : process.platform === "darwin"
        ? "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium"
        : "chrome-linux64/chrome",
  );

  if (fs.existsSync(chromePath)) return chromePath;

  // Fallback: coba chrome-headless-shell
  return findHeadlessShell(cacheDir);
}

/**
 * Cari chrome-headless-shell di Puppeteer cache.
 */
function findHeadlessShell(cacheDir: string): string | null {
  const headlessDir = path.join(cacheDir, "chrome-headless-shell");
  if (!fs.existsSync(headlessDir)) return null;

  const headlessDirs = fs.readdirSync(headlessDir);
  if (headlessDirs.length === 0) return null;

  headlessDirs.sort().reverse();
  const latestHeadless = headlessDirs[0];

  const headlessPath = path.join(
    headlessDir,
    latestHeadless,
    process.platform === "win32"
      ? "chrome-headless-shell-win64\\chrome-headless-shell.exe"
      : process.platform === "darwin"
        ? "chrome-headless-shell-mac-arm64/chrome-headless-shell"
        : "chrome-headless-shell-linux64/chrome-headless-shell",
  );

  return fs.existsSync(headlessPath) ? headlessPath : null;
}

/**
 * Cari Chrome/Chromium di path sistem Linux umum.
 */
function findSystemChrome(): string | null {
  const commonPaths = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",
    "/app/.apt/usr/bin/google-chrome", // Heroku
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

/**
 * Launch Puppeteer browser dengan konfigurasi optimal untuk production (Linux).
 * Logging detail:
 * - executablePath yang digunakan
 * - Platform (process.platform, process.arch)
 * - Apakah menggunakan bundled Chrome atau system Chrome
 *
 * @throws Error dengan pesan jelas jika browser tidak ditemukan
 */
export async function launchBrowser(): Promise<Browser> {
  const executablePath = findChromeExecutable();

  // Logging detail untuk debugging
  console.log("[Puppeteer] Launching browser...");
  console.log(`[Puppeteer] Platform: ${process.platform} (${process.arch})`);
  console.log(`[Puppeteer] Node version: ${process.version}`);
  console.log(
    `[Puppeteer] PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || "(not set)"}`,
  );
  console.log(
    `[Puppeteer] PUPPETEER_CACHE_DIR: ${process.env.PUPPETEER_CACHE_DIR || "(not set)"}`,
  );
  console.log(
    `[Puppeteer] Executable path resolved: ${executablePath || "(not found)"}`,
  );

  if (!executablePath) {
    const installCommand =
      process.platform === "win32"
        ? "npx puppeteer browsers install chrome"
        : "npx puppeteer browsers install chrome";

    throw new Error(
      `[Puppeteer] Browser Chrome/Chromium TIDAK DITEMUKAN!\n\n` +
        `Langkah perbaikan:\n` +
        `1. Set environment variable:\n` +
        `   export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome\n\n` +
        `2. Atau install Chrome dengan perintah:\n` +
        `   ${installCommand}\n\n` +
        `3. Atau install Chromium via package manager:\n` +
        `   sudo apt-get install chromium-browser  (Debian/Ubuntu)\n` +
        `   sudo yum install chromium              (RHEL/CentOS)\n\n` +
        `Detail:\n` +
        `- Platform: ${process.platform} (${process.arch})\n` +
        `- Node: ${process.version}`,
    );
  }

  console.log(`[Puppeteer] Launching browser with executable: ${executablePath}`);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--no-first-run",
      ],
    });

    console.log("[Puppeteer] Browser launched successfully");
    return browser;
  } catch (error) {
    console.error("[Puppeteer] Failed to launch browser:", error);
    throw new Error(
      `[Puppeteer] Gagal meluncurkan browser!\n` +
        `Path: ${executablePath}\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Pastikan Chrome/Chromium sudah terinstall dan dapat dijalankan.`,
    );
  }
}
