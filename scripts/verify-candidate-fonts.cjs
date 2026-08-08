// scripts/verify-candidate-fonts.cjs
// Verifikasi dua kandidat pengganti font yang seharusnya MENGANDUNG
// U+25B4 (▴) dan U+25BE (▾):
//   1. Subset "text=" dari Google Fonts CSS2 API (hanya 2 karakter ini)
//   2. Font variabel penuh NotoSansSymbols dari repo google/fonts (GitHub)
const zlib = require("zlib");

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

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function u128(b, o) {
  let a = 0;
  for (let i = 0; i < 5; i++) {
    const x = b.readUInt8(o.off);
    o.off++;
    if (a & 0xfe000000) throw Error("overflow");
    a = (a << 7) | (x & 0x7f);
    if (!(x & 0x80)) return a;
  }
  throw Error("too long");
}

// cmap lookup dari container (buffer) + tabel cmap. Mendukung format 4 & 12.
function glyphMap(container, cmap) {
  const map = {};
  if (!cmap) return map;
  const numSub = container.readUInt16BE(cmap.offset + 2);
  for (let i = 0; i < numSub; i++) {
    const subOff = container.readUInt32BE(cmap.offset + 8 + i * 8);
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
        for (let cp = start; cp <= end && cp <= 0xffff; cp++) {
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
        for (let cp = sc; cp <= ec; cp++) {
          const gid = sg + (cp - sc);
          if (gid !== 0 && !(cp in map)) map[cp] = gid;
        }
      }
    }
  }
  return map;
}

function tablesFromTtf(buf) {
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = buf.toString("latin1", rec, rec + 4);
    tables[tag] = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
  }
  return tables;
}

function tablesFromWoff2(buf) {
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
    const ol = u128(buf, o);
    off = o.off;
    const trans = (tag === "glyf" || tag === "loca") ? tv !== 3 : tv !== 0;
    let tl = 0;
    if (trans) {
      const o2 = { off };
      tl = u128(buf, o2);
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
  return tabs;
}

function analyze(buf, label) {
  const isWoff2 = buf.toString("latin1", 0, 4) === "wOF2";
  const tables = isWoff2 ? tablesFromWoff2(buf) : tablesFromTtf(buf);
  const container = isWoff2 ? (() => {
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
      const ol = u128(buf, o);
      off = o.off;
      const trans = (tag === "glyf" || tag === "loca") ? tv !== 3 : tv !== 0;
      let tl = 0;
      if (trans) {
        const o2 = { off };
        tl = u128(buf, o2);
        off = o2.off;
      }
      entries.push({ tag: tag.trim(), stored: trans ? tl : ol });
    }
    const comp = buf.subarray(off, off + buf.readUInt32BE(20));
    return zlib.brotliDecompressSync(comp);
  })() : buf;

  const map = glyphMap(container, tables.cmap);
  const total = Object.keys(map).length;
  const up = map[0x25b4];
  const down = map[0x25be];
  console.log(
    `  ${label} (${buf.length} bytes, ${isWoff2 ? "woff2" : "ttf"}, ${total} codepoint): ` +
      `▴ U+25B4 ${up !== undefined ? `✓gid=${up}` : "✗"} | ▾ U+25BE ${down !== undefined ? `✓gid=${down}` : "✗"}`,
  );
  return up !== undefined && down !== undefined;
}

async function checkTextSubset() {
  const cssUrl =
    "https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols&text=%E2%96%BE%E2%96%B4&format=woff2";
  const res = await fetch(cssUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.log("  ✗ text= subset: HTTP", res.status);
    return false;
  }
  const css = await res.text();
  const m = css.match(/url\((https:\/\/[^)]+)\)/);
  if (!m) {
    console.log("  ✗ text= subset: tidak ada URL di CSS:", css.slice(0, 300));
    return false;
  }
  console.log("  text= subset URL:", m[1]);
  const fr = await fetch(m[1], { headers: { "User-Agent": UA } });
  if (!fr.ok) {
    console.log("  ✗ text= subset: HTTP", fr.status);
    return false;
  }
  const buf = Buffer.from(await fr.arrayBuffer());
  return analyze(buf, "text= subset (woff2)");
}

async function checkFullVariableFont() {
  // Cari nama file asli di repo google/fonts via GitHub API.
  const api = await fetch("https://api.github.com/repos/google/fonts/contents/ofl/notosanssymbols", {
    headers: { "User-Agent": UA },
  });
  if (!api.ok) {
    console.log("  ✗ listing repo: HTTP", api.status);
    return false;
  }
  const files = await api.json();
  const ttf = files.find((f) => f.name.endsWith(".ttf"));
  if (!ttf) {
    console.log("  ✗ tidak ada .ttf di repo, isi:", files.map((f) => f.name).join(", "));
    return false;
  }
  console.log("  file di repo:", ttf.name);
  const res = await fetch(ttf.download_url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.log("  ✗ font variabel: HTTP", res.status);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return analyze(buf, "NotoSansSymbols (variable, GitHub)");
}

async function main() {
  console.log("=== Kandidat 1: subset text= dari Google Fonts ===\n");
  const ok1 = await checkTextSubset();
  console.log("\n=== Kandidat 2: font variabel penuh dari google/fonts GitHub ===\n");
  const ok2 = await checkFullVariableFont();
  console.log("\nResult:", ok1 ? "text= subset ✓" : "text= subset ✗", "|", ok2 ? "variable font ✓" : "variable font ✗");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
