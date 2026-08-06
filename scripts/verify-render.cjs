/* Render preview sertifikat & area tanda tangan ke PNG untuk verifikasi visual */
const puppeteer = require("puppeteer-core");
const detectBrowser = require("./detect-browser.cjs");

const REG_ID = "msa1n1n132xxjmwr0";
const SEM_ID = "ms5q3un6vd6k0r83c";
const URL = `http://localhost:3001/api/certificates/generate?registrationId=${REG_ID}&seminarId=${SEM_ID}`;
const PDF_FILE =
  "file:///C:/temp/cert-verify2/extracted/sertifikat_1074_mahmud_.pdf";

(async () => {
  const exec = detectBrowser();
  if (!exec) throw new Error("Browser tidak ditemukan");
  console.log("Browser:", exec);

  const browser = await puppeteer.launch({
    executablePath: exec,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    // 1. Render HTML preview (sama dengan yang jadi PDF)
    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
    await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: "C:/temp/cert-verify2/preview-full.png" });

    // 2. Screenshot area tanda tangan
    const sigEl = await page.$(".cert-signature");
    if (sigEl) {
      await sigEl.screenshot({ path: "C:/temp/cert-verify2/signature-area.png" });
      console.log("Area tanda tangan dirender");
    } else {
      console.log("Elemen .cert-signature TIDAK ditemukan");
    }
    await page.close();

    // 3. Render PDF langsung dari ZIP di Chrome viewer
    const pdfPage = await browser.newPage();
    await pdfPage.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
    await pdfPage.goto(PDF_FILE, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 4000));
    await pdfPage.screenshot({ path: "C:/temp/cert-verify2/pdf-view.png" });
    console.log("PDF viewer dirender");
    await pdfPage.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});