// scripts/check-symbol-fonts.cjs
// Perbandingan: cek glyph U+25B4 (▴) & U+25BE (▾) di:
//   1. public/fonts/NotoSansSymbols-Regular.ttf (yang diupload)
//   2. noto-test.woff2  (woff2 di root repo)
//   3. symbols.woff2    (woff2 di root repo)
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const TARGETS = [0x25b4, 0x25be];
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post",
  "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
  "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
  "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
  "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
  "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

function decodeUIntBase128(b, o) {
  let a = 0;
  for (let i = 0; i < 5; i++) {
    const x = b.readUInt8(o.off);
    o.off++;
    if (a & 0xfe000000) throw new Error("overflow");
    a = (a << 7) | (x & 0x7f);
    if (!(x & 0x80)) return a;
  }
  throw new Error("UIntBase128 too long");
}

// ── TTF (sfnt) parser ──
function glyphMapFromTtf(buf) {
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = buf.toString("latin1", rec, rec + 4);
    tables[tag] = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
  }
  return glyphMapFromCmap(buf, tables.cmap);
}

// ── WOFF2 parser ──
function glyphMapFromWoff2(buf) {
  const numTables = buf.readUInt16BE(12);
  let off = 48;
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const f = buf.readUInt8(off++);
    const idx = f & 0x3f;
    const tv = (f >> 6) & 3;
    let tag;
    if (idx === 0x3f) {
      tag = buf.toString("latin1", off, off + 4);
      off += 4;
    } else tag = KNOWN_TAGS[idx];
    const o = { off };
    const ol = decodeUIntBase128(buf, o);
    off = o.off;
    const trans = (tag === "glyf" || tag === "loca") ? tv !== 3 : tv !== 0;
    let tl = 0;
    if (trans) {
      const o2 = { off };
      tl = decodeUIntBase128(buf, o2);
      off = o2.off;
    }
    entries.push({ tag: tag.trim(), stored: trans ? tl : ol });
  }
  const comp = buf.subarray(off, off + buf.readUInt32BE(20));
  const dec = zlib.brotliDecompressSync(comp);
  let cur = 0;
  const tabs = {};
  for (const e of entries) {
    tabs[e.tag] = { offset: cur, length: e.stored };
    cur += e.stored;
  }
  return glyphMapFromCmap(dec, tabs.cmap);
}

// ── cmap generic: kembalikan { codepoint → gid } dari semua subtable ──
function glyphMapFromCmap(container, cmap) {
  if (!cmap) return null;
  const map = {};
  const numSub = container.readUInt16BE(cmap.offset + 2);
  for (let i = 0; i < numSub; i++) {
    const r = cmap.offset + 4 + i * 8;
    const subOff = container.readUInt32BE(r + 4);
    const abs = cmap.offset + subOff;
    const format = container.readUInt16BE(abs);
    if (format === 4) {
      const segCount = container.readUInt16BE(abs + 6) / 2;
      const endOff = abs + 14;
      const startOff = endOff + segCount * 2 + 2;
      const deltaOff = startOff + segCount * 2;
      const rangeOff = deltaOff + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const start = container.readUInt16BE(startOff + s * 2);
        const end = container.readUInt16BE(endOff + s * 2);
        if (start === 0xffff) continue;
        const delta = container.readUInt16BE(deltaOff + s * 2);
        const range = container.readUInt16BE(rangeOff + s * 2);
        for (let cp = start; cp <= end; cp++) {
          if (cp > 0xffff) break;
          let gid;
          if (range === 0) gid = (cp + delta) & 0xffff;
          else {
            const idx = rangeOff + s * 2 + range + (cp - start) * 2;
            const g = container.readUInt16BE(idx);
            gid = g === 0 ? 0 : (g + delta) & 0xffff;
          }
          if (gid !== 0 && !(cp in map)) map[cp] = gid;
        }
      }
    } else if (format === 12) {
      const numGroups = container.readUInt32BE(abs + 12);
      for (let g = 0; g < numGroups; g++) {
        const sc = container.readUInt32BE(abs + 16 + g * 12);
        const ec = container.readUInt32BE(abs + 20 + g * 12);
        const sg = container.readUInt32BE(abs + 24 + g * 12);
        for (let cp = sc; cp <= ec && cp - sc < 0x100000; cp++) {
          const gid = sg + (cp - sc);
          if (gid !== 0 && !(cp in map)) map[cp] = gid;
        }
      }
    }
  }
  return map;
}

function checkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`- ${filePath}: FILE TIDAK ADA`);
    return;
  }
  const buf = fs.readFileSync(filePath);
  const isWoff2 = buf.toString("latin1", 0, 4) === "wOF2";
  let map;
  try {
    map = isWoff2 ? glyphMapFromWoff2(buf) : glyphMapFromTtf(buf);
  } catch (e) {
    console.log(`- ${filePath} (${buf.length} bytes, ${isWoff2 ? "woff2" : "ttf"}): GAGAL PARSE — ${e.message}`);
    return;
  }
  const results = TARGETS.map((cp) => {
    const gid = map[cp];
    return `${gid !== undefined ? "✓" : "✗"} U+${cp.toString(16).toUpperCase()} gid=${gid !== undefined ? gid : 0}`;
  });
  const total = Object.keys(map).length;
  console.log(`- ${filePath} (${buf.length} bytes, ${isWoff2 ? "woff2" : "ttf"}, ${total} codepoint): ${results.join(" | ")}`);
}

console.log("=== Cek glyph ▴ (U+25B4) & ▾ (U+25BE) di tiap font ===\n");
checkFile(path.join(process.cwd(), "public", "fonts", "NotoSansSymbols-Regular.ttf"));
checkFile(path.join(process.cwd(), "noto-test.woff2"));
checkFile(path.join(process.cwd(), "symbols.woff2"));
console.log("");
