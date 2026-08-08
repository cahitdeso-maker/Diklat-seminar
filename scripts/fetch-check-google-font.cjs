// scripts/fetch-check-google-font.cjs
// Fetch font Noto Sans Symbols (woff2) dari Google Fonts dan cek apakah
// mengandung glyph U+25B4 (▴) & U+25BE (▾). Tidak menyimpan file ke repo.
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
    const subOff = dec.readUInt32BE(cmap.offset + 4 + i * 8 + 4);
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

async function main() {
  const url =
    "https://fonts.gstatic.com/s/notosanssymbols/v47/rP2up3q65FkAtHfwd-eIS2brbDN6gxP34F9jRRCe4W3gfQ8QA_9Edkw.woff2";
  console.log("Fetching:", url);
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) {
    console.log("✗ HTTP", res.status);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  console.log("✓ Terfetch:", buf.length, "bytes");

  const map = glyphMapFromWoff2(buf);
  const total = Object.keys(map).length;
  let min = Infinity, max = -1;
  for (const k of Object.keys(map)) {
    const n = parseInt(k, 10);
    if (n < min) min = n;
    if (n > max) max = n;
  }
  console.log(`Codepoint: ${total} | rentang U+${min.toString(16).toUpperCase()}–U+${max.toString(16).toUpperCase()}`);
  for (const cp of [0x25b4, 0x25be, 0x25a0, 0x25b2, 0x25bc, 0x2665, 0x1f600]) {
    const gid = map[cp];
    console.log(`  U+${cp.toString(16).toUpperCase().padStart(4, "0")}: ${gid !== undefined ? `gid=${gid}` : "TIDAK ADA"}`);
  }
  const ok = map[0x25b4] !== undefined && map[0x25be] !== undefined;
  console.log(ok ? "✓ Font lengkap ini MENGANDUNG ▴ (U+25B4) dan ▾ (U+25BE)" : "✗ Font ini TIDAK mengandung target glyph");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
