import fs from "fs";
import path from "path";

/**
 * Mendeteksi path Chrome/Chromium yang terinstall di sistem lokal.
 * Untuk production di Vercel, gunakan @sparticuz/chromium.
 */
export function detectBrowser(): string | null {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const commonPaths: string[] = [];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const programFiles = process.env["PROGRAMFILES"] || "C:\\Program Files";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";

    commonPaths.push(
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFiles, "Chromium", "Application", "chrome.exe"),
      path.join(localAppData, "Chromium", "Application", "chrome.exe"),
      // Microsoft Edge (Chromium-based)
      path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    );

    // Cek di Puppeteer cache
    const userHome = process.env.USERPROFILE || "";
    if (userHome) {
      const cacheDir = path.join(userHome, ".cache", "puppeteer");
      if (fs.existsSync(cacheDir)) {
        commonPaths.push(
          ...findChromeInCache(cacheDir, "chrome-win64", "chrome.exe"),
        );
      }
    }
  } else if (process.platform === "darwin") {
    commonPaths.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      path.join(process.env.HOME || "", "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    );
  } else {
    // Linux
    commonPaths.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
    );
  }

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

function findChromeInCache(cacheDir: string, platformDir: string, exeName: string): string[] {
  const results: string[] = [];
  const chromeDir = path.join(cacheDir, "chrome");
  if (!fs.existsSync(chromeDir)) return results;

  try {
    const versions = fs.readdirSync(chromeDir).sort().reverse();
    for (const version of versions) {
      const exePath = path.join(chromeDir, version, platformDir, exeName);
      if (fs.existsSync(exePath)) {
        results.push(exePath);
      }
    }
  } catch {
    // Ignore errors
  }

  return results;
}
