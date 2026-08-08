// scripts/check-ttf-symbols.cjs
// Verifikasi bahwa TTF (public/fonts/NotoSansSymbols-Regular.ttf) mengandung
// glyph U+25B4 (▴) dan U+25BE (▾) dengan parsing cmap langsung dari sfnt.
// Catatan: ini TTF (bukan woff2), jadi struktur sfnt klasik, bukan WOFF2.
const fs = require("fs");
const path = require("path");

const TARGETS = [0x25b4, 0x25be]; // ▴ ▾ — yang dipakai dekorasi sertifikat
// Referensi sanity check: 'A' harus selalu ada; simbol lain untuk cek cakupan.
const REFERENCES = [
  0x41, // A (harus selalu ada)
  0x25a0, // ■ BLACK SQUARE
  0x25b2, // ▲ BLACK UP-POINTING TRIANGLE
  0x25bc, // ▼ BLACK DOWN-POINTING TRIANGLE
  0x25bd, // ▽ WHITE DOWN-POINTING TRIANGLE
  0x25c6, // ◆ BLACK DIAMOND
  0x25cf, // ● BLACK CIRCLE
  0x2665, // ♥ BLACK HEART
];
const ALL_CODES = [...TARGETS, ...REFERENCES];

const fontPath = path.join(
  process.cwd(),
  "public",
  "fonts",
  "NotoSansSymbols-Regular.ttf",
);

if (!fs.existsSync(fontPath)) {
  console.log(`✗ File tidak ditemukan: ${fontPath}`);
  process.exit(1);
}
const buf = fs.readFileSync(fontPath);
console.log(`File: ${fontPath}`);
console.log(`Ukuran: ${buf.length} bytes | magic: 0x${buf.toString("hex", 0, 4)}`);

// ── sfnt header / table directory ──
const numTables = buf.readUInt16BE(4);
const tables = {};
for (let i = 0; i < numTables; i++) {
  const rec = 12 + i * 16;
  const tag = buf.toString("latin1", rec, rec + 4);
  const offset = buf.readUInt32BE(rec + 8);
  const length = buf.readUInt32BE(rec + 12);
  tables[tag] = { offset, length };
}
console.log(`Tables: ${Object.keys(tables).join(", ")}`);

if (!tables.cmap) {
  console.log("✗ cmap table tidak ada");
  process.exit(1);
}

// ── cmap header ──
const cm = tables.cmap;
const numSub = buf.readUInt16BE(cm.offset + 2);
const subtables = [];
for (let i = 0; i < numSub; i++) {
  const r = cm.offset + 4 + i * 8;
  subtables.push({
    platformID: buf.readUInt16BE(r),
    encodingID: buf.readUInt16BE(r + 2),
    offset: buf.readUInt32BE(r + 4),
  });
}
console.log(`cmap: ${numSub} subtable(s)`);

const found = {};
for (const cp of ALL_CODES) found[cp] = null;

for (const s of subtables) {
  const abs = cm.offset + s.offset;
  const format = buf.readUInt16BE(abs);
  console.log(`  plat=${s.platformID} enc=${s.encodingID} format=${format} @+${s.offset}`);

  const glyphOf = (cp) => {
    if (format === 4) {
      const segCount = buf.readUInt16BE(abs + 6) / 2;
      const endOff = abs + 14;
      const startOff = endOff + segCount * 2 + 2;
      const deltaOff = startOff + segCount * 2;
      const rangeOff = deltaOff + segCount * 2;
      for (let i = 0; i < segCount; i++) {
        const start = buf.readUInt16BE(startOff + i * 2);
        const end = buf.readUInt16BE(endOff + i * 2);
        if (start === 0xffff) continue;
        if (cp >= start && cp <= end) {
          const delta = buf.readUInt16BE(deltaOff + i * 2);
          const range = buf.readUInt16BE(rangeOff + i * 2);
          if (range === 0) return (cp + delta) & 0xffff;
          const idx = rangeOff + i * 2 + range + (cp - start) * 2;
          const g = buf.readUInt16BE(idx);
          return g === 0 ? 0 : (g + delta) & 0xffff;
        }
      }
      return 0;
    }
    if (format === 12) {
      const numGroups = buf.readUInt32BE(abs + 12);
      for (let g = 0; g < numGroups; g++) {
        const startChar = buf.readUInt32BE(abs + 16 + g * 12);
        const endChar = buf.readUInt32BE(abs + 20 + g * 12);
        const startGlyph = buf.readUInt32BE(abs + 24 + g * 12);
        if (cp >= startChar && cp <= endChar) {
          return startGlyph + (cp - startChar);
        }
      }
      return 0;
    }
    return null; // format tidak dikenal (2/14/dst) — lewati
  };

  for (const cp of ALL_CODES) {
    const gid = glyphOf(cp);
    if (gid === null) continue;
    if (found[cp] === null && gid !== 0) {
      found[cp] = { gid, via: `format ${format} (plat ${s.platformID}/${s.encodingID})` };
    }
    if (TARGETS.includes(cp)) {
      console.log(`    U+${cp.toString(16).toUpperCase().padStart(4, "0")} → gid=${gid}`);
    }
  }
}

// ── Ringkasan coverage dari subtable format 12 pertama yang valid ──
const f12 = subtables.find((s) => {
  const f = buf.readUInt16BE(cm.offset + s.offset);
  return f === 12 && (s.platformID === 0 || s.platformID === 3);
});
if (f12) {
  const abs = cm.offset + f12.offset;
  const numGroups = buf.readUInt32BE(abs + 12);
  let mapped = 0;
  let minCp = Infinity;
  let maxCp = -1;
  for (let g = 0; g < numGroups; g++) {
    const sc = buf.readUInt32BE(abs + 16 + g * 12);
    const ec = buf.readUInt32BE(abs + 20 + g * 12);
    mapped += ec - sc + 1;
    if (sc < minCp) minCp = sc;
    if (ec > maxCp) maxCp = ec;
  }
  console.log(
    `format 12 (plat ${f12.platformID}/${f12.encodingID}): ${numGroups} group, ${mapped} codepoint, rentang U+${minCp.toString(16).toUpperCase()}–U+${maxCp.toString(16).toUpperCase()}`,
  );
}

console.log("");
console.log("=== Referensi sanity check ===");
for (const cp of REFERENCES) {
  const hex = cp.toString(16).toUpperCase().padStart(4, "0");
  const label =
    { 0x41: "A", 0x25a0: "■", 0x25b2: "▲", 0x25bc: "▼", 0x25bd: "▽", 0x25c6: "◆", 0x25cf: "●", 0x2665: "♥" }[cp] || "";
  console.log(`U+${hex} ${label}: ${found[cp] ? `gid=${found[cp].gid}` : "TIDAK ADA"}`);
}

console.log("");
let ok = true;
for (const cp of TARGETS) {
  const hex = cp.toString(16).toUpperCase().padStart(4, "0");
  const label = cp === 0x25b4 ? "▴ (U+25B4)" : "▾ (U+25BE)";
  if (found[cp]) {
    console.log(`✓ ${label} ADA — glyph ID ${found[cp].gid} via ${found[cp].via}`);
  } else {
    console.log(`✗ ${label} TIDAK ADA (gid=0/.notdef)`);
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
