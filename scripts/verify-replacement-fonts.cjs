// scripts/verify-replacement-fonts.cjs
// Uji font pengganti yang MENGANDUNG U+25B4 (▴) / U+25BE (▾):
//   1. Subset "text=" dari Google Fonts CSS2 API
//   2. Semua subset css2 dari: Noto Sans Symbols 2, Noto Symbols, Noto Symbols 2
//      (dengan parser unicode-range yang benar)
//   3. DejaVu Sans (dari npm registry / github release)
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

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

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

function parseWoff2(buf) {
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
  return { dec, cmap: tabs.cmap };
}

function parseTtf(buf) {
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = buf.toString("latin1", rec, rec + 4);
    tables[tag] = { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) };
  }
  return { dec: buf, cmap: tables.cmap };
}

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

function analyze(buf, label) {
  const isWoff2 = buf.toString("latin1", 0, 4) === "wOF2";
  let dec, cmap;
  try {
    if (isWoff2) {
      const r = parseWoff2(buf);
      dec = r.dec;
      cmap = r.cmap;
    } else {
      const r = parseTtf(buf);
      dec = r.dec;
      cmap = r.cmap;
    }
  } catch (e) {
    console.log(`  ${label}: GAGAL PARSE — ${e.message}`);
    return false;
  }
  const map = glyphMap(dec, cmap);
  const total = Object.keys(map).length;
  const up = map[0x25b4];
  const down = map[0x25be];
  console.log(
    `  ${label} (${buf.length} bytes, ${isWoff2 ? "woff2" : "ttf"}, ${total} cp): ` +
      `▴ ${up !== undefined ? `✓gid=${up}` : "✗"} | ▾ ${down !== undefined ? `✓gid=${down}` : "✗"}`,
  );
  return up !== undefined && down !== undefined;
}

function rangeCovers(rangeStr, cp) {
  return rangeStr.split(",").some((part) => {
    const m = part.trim().match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/);
    if (!m) return false;
    const start = parseInt(m[1], 16);
    const end = m[2] ? parseInt(m[2], 16) : start;
    return cp >= start && cp <= end;
  });
}

async function fetchBuf(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", Referer: "https://fonts.googleapis.com/" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function checkFamilySubsets(family, label) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family}&display=swap&format=woff2`;
  let css;
  try {
    css = await (await fetch(cssUrl, { headers: { "User-Agent": UA } })).text();
  } catch (e) {
    console.log(`  ✗ ${label}: fetch CSS gagal — ${e.message}`);
    return false;
  }
  const blocks = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  console.log(`  ${label}: ${blocks.length} subset`);
  let ok = false;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const ur = block.match(/unicode-range:\s*([^;]+);/);
    const src = block.match(/url\((https:\/\/[^)]+)\)/);
    if (!ur || !src) continue;
    const covers =
      rangeCovers(ur[1], 0x25b4) || rangeCovers(ur[1], 0x25be);
    if (!covers) {
      console.log(`  subset ${i}: range=${ur[1].trim().slice(0, 80)} (tidak mencakup target)`);
      continue;
    }
    console.log(`  ★ subset ${i}: range=${ur[1].trim().slice(0, 80)}\n    url=${src[1]}`);
    try {
      const buf = await fetchBuf(src[1]);
      ok = analyze(buf, `${label} #${i}`) || ok;
    } catch (e) {
      console.log(`    ✗ fetch subset gagal: ${e.message}`);
    }
  }
  return ok;
}

async function findDejaVu() {
  // Coba beberapa sumber umum untuk DejaVu Sans TTF.
  const candidates = [
    "https://registry.npmjs.org/-/v1/search?text=dejavu%20sans&size=8",
  ];
  const names = [];
  try {
    const r = await (await fetch(candidates[0])).json();
    for (const o of r.objects || []) names.push(o.package.name);
  } catch {}
  console.log("  npm packages 'dejavu':", names.join(", ") || "(tidak ada)");

  const urlCandidates = [];
  if (names.includes("dejavu-fonts-ttf")) {
    urlCandidates.push("https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
  }
  urlCandidates.push(
    "https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37_1/dejavu-fonts-ttf-2.37.1.zip",
  );

  for (const url of urlCandidates) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        console.log(`  ✗ ${url} — HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (url.endsWith(".zip")) {
        // Minimal ZIP reader (mendukung entry deflate) — ekstrak DejaVuSans.ttf
        const ttf = extractFromZip(buf, /DejaVuSans\.ttf$/);
        if (!ttf) {
          console.log("  ✗ DejaVuSans.ttf tidak ditemukan di dalam zip");
          continue;
        }
        return analyze(ttf, "DejaVu Sans (ttf dari zip)");
      }
      return analyze(buf, "DejaVu Sans (ttf)");
    } catch (e) {
      console.log(`  ✗ ${url} — ${e.message}`);
    }
  }
  return false;
}

// Minimal ZIP reader: cari central directory, baca nama + offset, lalu inflate.
function extractFromZip(zipBuf, nameRe) {
  const eocd = zipBuf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  const cdCount = zipBuf.readUInt16LE(eocd + 10);
  const cdOff = zipBuf.readUInt32LE(eocd + 16);
  let p = cdOff;
  for (let i = 0; i < cdCount; i++) {
    if (zipBuf.readUInt32LE(p) !== 0x02014b50) break;
    const method = zipBuf.readUInt16LE(p + 10);
    const compSize = zipBuf.readUInt32LE(p + 20);
    const nameLen = zipBuf.readUInt16LE(p + 28);
    const extraLen = zipBuf.readUInt16LE(p + 30);
    const commentLen = zipBuf.readUInt16LE(p + 32);
    const localOff = zipBuf.readUInt32LE(p + 42);
    const name = zipBuf.toString("utf8", p + 46, p + 46 + nameLen);
    if (nameRe.test(name)) {
      const lhNameLen = zipBuf.readUInt16LE(localOff + 26);
      const lhExtraLen = zipBuf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      const comp = zipBuf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return Buffer.from(comp);
      if (method === 8) return zlib.inflateRawSync(comp);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

async function main() {
  console.log("=== 1. text= subset (Noto Sans Symbols) ===\n");
  try {
    const css = await (
      await fetch("https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols&text=%E2%96%BE%E2%96%B4&format=woff2", {
        headers: { "User-Agent": UA },
      })
    ).text();
    const m = css.match(/url\((https:\/\/[^)]+)\)/);
    if (m) {
      console.log("  URL:", m[1]);
      try {
        const buf = await fetchBuf(m[1]);
        analyze(buf, "text= subset (Google)");
      } catch (e) {
        console.log("  ✗ text= subset:", e.message);
      }
    } else {
      console.log("  ✗ tidak ada URL di CSS");
    }
  } catch (e) {
    console.log("  ✗ text= subset:", e.message);
  }

  for (const fam of [
    ["Noto+Sans+Symbols+2", "Noto Sans Symbols 2"],
    ["Noto+Symbols", "Noto Symbols"],
    ["Noto+Symbols+2", "Noto Symbols 2"],
  ]) {
    console.log(`\n=== 2. ${fam[1]} (css2 subsets) ===\n`);
    await checkFamilySubsets(fam[0], fam[1]);
  }

  console.log("\n=== 3. DejaVu Sans ===\n");
  await findDejaVu();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
