// scripts/render-symbol-check.ts
// Tes render end-to-end: embed TTF sebagai data URI (persis seperti di
// src/lib/certificate-pdf.ts: format('truetype') + unicode-range) lalu
// render ▾▴ di headless Chrome. Verifikasi bahwa @font-face termuat dan
// glyph benar-benar dirender (bukan tofu/fallback).
import { readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { detectBrowser } from "../src/lib/detect-browser";

const FONT_PATH = join(
  process.cwd(),
  "public",
  "fonts",
  "NotoSansSymbols-Regular.ttf",
);

async function main() {
  const fontBase64 = readFileSync(FONT_PATH).toString("base64");
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<style>
  @font-face {
    font-family: 'NotoSymbols';
    src: url('data:font/truetype;base64,${fontBase64}') format('truetype');
    unicode-range: U+25BE, U+25B4;
  }
  body { margin: 0; background: #fff; }
  .test { font-family: 'NotoSymbols', Arial, sans-serif; font-size: 120px; color: #033b5c; }
</style>
</head>
<body>
  <div id="t" class="test">&#x25BE;&#x25B4;</div>
</body>
</html>`;

  const executablePath = detectBrowser();
  if (!executablePath) {
    console.log("✗ Chrome tidak ditemukan (detectBrowser kosong)");
    process.exit(1);
  }
  console.log("[Render] Menggunakan Chrome:", executablePath);

  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 500, height: 220 });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => (document as Document).fonts.ready);

    const result = await page.evaluate(async () => {
      const loaded = await (document as Document).fonts.load("120px NotoSymbols", "▾▴");
      const check = (document as Document).fonts.check("120px NotoSymbols", "▾");
      const faces = [...(document as Document).fonts].map(
        (f) => `'${f.family}' status=${f.status}`,
      );

      // Bandingkan lebar glyph ▾ dengan font yang tidak punya glyph ini.
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 200;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "120px NotoSymbols, Arial";
      const wSymbols = ctx.measureText("▾").width;
      ctx.font = "120px 'Times New Roman'";
      const wTimes = ctx.measureText("▾").width;
      return { loadedCount: loaded.length, check, faces, wSymbols, wTimes };
    });

    console.log("[Render] fonts.load resolved faces:", result.loadedCount);
    console.log("[Render] document.fonts.check('120px NotoSymbols', '▾'):", result.check);
    console.log("[Render] FontFace terdaftar:", result.faces.join(" | "));
    console.log(
      "[Render] measureText '▾' width — NotoSymbols:",
      result.wSymbols,
      "vs Times New Roman (fallback tanpa glyph):",
      result.wTimes,
    );

    const shotPath = join(tmpdir(), "symbols-render-test.png");
    await page.screenshot({ path: shotPath });
    console.log("[Render] Screenshot: " + shotPath);

    const ok = result.check && result.wSymbols !== result.wTimes;
    console.log(ok ? "✓ RENDER OK — glyph ▾▴ dirender dari font NotoSansSymbols" : "✗ Gagal render");
    process.exit(ok ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[Render] ERROR:", err);
  process.exit(1);
});
