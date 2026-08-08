// scripts/find-symbols-subset.cjs
// Fetch CSS2 API Google Fonts untuk "Noto Sans Symbols", temukan subset yang
// unicode-range-nya mencakup U+25B4 (▴) / U+25BE (▾), lalu verifikasi bahwa
// glyph-nya benar-benar ada di file woff2 subset tersebut (in-memory).
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
  const cmap = tabs.cmap;
  if (!cmap) return {};
  const map = {};
  const numSub = dec.readUInt16BE(cmap.offset + 2);
  for (let i = 0; i < numSub; i++) {
    const subOff = dec.readUInt32BE(cmap.offset + 8 + i * 8);
    const abs = cmap.offset + subOff;
    const format = dec.readUInt16BE(abs);
    if (format === 12) {
      const numGroups = dec.readUInt32BE(abs + 12);
      for (let g = 0; g < numGroups; g++) {
        const sc = dec.readUInt32BE(abs + 16 + g * 12);
        const ec = dec.readUInt32BE(abs + 20 + g * 12);
        const sg = dec.readUInt32BE(abs + 24 + g * 12);
        for (let cp = sc; cp <= ec; cp++) {
          const gid = sg + (cp - sc);
          if (gid !== 0 && !(cp in map)) map[cp] = gid;
        }
      }
    }
  }
  return map;
}

// Parse unicode-range seperti "U+25A0-25FF, U+2000-206F" → cek apakah cp tercakup.
function rangeCovers(rangeStr, cp) {
  return rangeStr.split(",").some((part) => {
    const m = part.trim().match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/);
    if (!m) return false;
    const start = parseInt(m[1], 16);
    const end = m[2] ? parseInt(m[2], 16) : start;
    return cp >= start && cp <= end;
  });
}

async function checkUrl(url, label) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" } });
    if (!res.ok) return `${label}: HTTP ${res.status}`;
    const buf = Buffer.from(await res.arrayBuffer());
    const map = glyphMapFromWoff2(buf);
    const has = (cp) => (map[cp] !== undefined ? `✓gid=${map[cp]}` : "✗");
    return `${label}: ${buf.length} bytes | ▴ ${has(0x25b4)} | ▾ ${has(0x25be)}`;
  } catch (e) {
    return `${label}: ERROR ${e.message}`;
  }
}

async function main() {
  const cssUrl =
    "https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols&display=swap&format=woff2";
  console.log("Fetching CSS:", cssUrl);
  const res = await fetch(cssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    console.log("✗ HTTP", res.status);
    process.exit(1);
  }
  const css = await res.text();
  const blocks = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  console.log(`Menemukan ${blocks.length} @font-face (subset).\n`);

  const interesting = [];
  for (const block of blocks) {
    const ur = block.match(/unicode-range:\s*([^;]+);/);
    const src = block.match(/url\((https:\/\/[^)]+?\.woff2)\)/);
    const rangeStr = ur ? ur[1].trim() : "";
    const url = src ? src[1] : null;
    const coversTarget = rangeCovers(rangeStr, 0x25b4) || rangeCovers(rangeStr, 0x25be);
    console.log(
      `${coversTarget ? "★" : " "} range=${rangeStr}${url ? "\n    url=" + url : ""}`,
    );
    if (coversTarget && url) interesting.push(url);
  }

  console.log("\n=== Verifikasi subset yang mencakup target ===\n");
  if (interesting.length === 0) {
    console.log("Tidak ada subset yang unicode-range-nya mencakup U+25B4/U+25BE!");
    process.exit(1);
  }
  for (const url of interesting) {
    console.log(await checkUrl(url, "subset"));
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
