// scripts/debug-woff2-cmap.cjs
// Debug struktur woff2 (symbols.woff2): print directory, subtable cmap,
// dan cari segmen/kelompok yang berisi U+25B4 (0x25b4) / U+25BE (0x25be).
const zlib = require("zlib");
const fs = require("fs");

const KNOWN = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post",
  "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
  "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
  "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
  "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
  "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

const u128 = (b, o) => {
  let a = 0;
  for (let i = 0; i < 5; i++) {
    const x = b.readUInt8(o.off);
    o.off++;
    if (a & 0xfe000000) throw Error("overflow");
    a = (a << 7) | (x & 0x7f);
    if (!(x & 0x80)) return a;
  }
  throw Error("too long");
};

const buf = fs.readFileSync("symbols.woff2");
console.log("magic:", buf.toString("latin1", 0, 4), "| size:", buf.length);
const numTables = buf.readUInt16BE(12);
console.log("numTables:", numTables);

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
  } else tag = KNOWN[idx];
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
  entries.push({ tag: tag.trim(), tv, orig: ol, stored: trans ? tl : ol });
}
console.log("entries:", entries.map((e) => `${e.tag}(${e.orig})`).join(" "));

const comp = buf.subarray(off, off + buf.readUInt32BE(20));
const dec = zlib.brotliDecompressSync(comp);
console.log("decompressed:", dec.length, "bytes");

let cur = 0;
const tabs = {};
for (const e of entries) {
  tabs[e.tag] = { off: cur, len: e.stored };
  cur += e.stored;
}
const cm = tabs.cmap;
console.log("cmap @", cm.off, "len", cm.len);
console.log("cmap version:", dec.readUInt16BE(cm.off), "numSub:", dec.readUInt16BE(cm.off + 2));

const numSub = dec.readUInt16BE(cm.off + 2);
for (let i = 0; i < numSub; i++) {
  const p = dec.readUInt16BE(cm.off + 4 + i * 8);
  const e = dec.readUInt16BE(cm.off + 6 + i * 8);
  const subOff = dec.readUInt32BE(cm.off + 8 + i * 8);
  const abs = cm.off + subOff;
  const fmt = dec.readUInt16BE(abs);
  console.log(`  subtable ${i}: plat=${p} enc=${e} fmt=${fmt} rel=+${subOff}`);

  if (fmt === 12) {
    const ng = dec.readUInt32BE(abs + 12);
    console.log(`    fmt12 numGroups=${ng}`);
    for (let g = 0; g < ng; g++) {
      const sc = dec.readUInt32BE(abs + 16 + g * 12);
      const ec = dec.readUInt32BE(abs + 20 + g * 12);
      const sg = dec.readUInt32BE(abs + 24 + g * 12);
      if (ec < 0x2500 || sc > 0x2800) continue;
      console.log(
        `    group ${g}: U+${sc.toString(16).toUpperCase()}–U+${ec.toString(16).toUpperCase()} startGlyph=${sg}`,
      );
    }
  }
  if (fmt === 4) {
    const segCount = dec.readUInt16BE(abs + 6) / 2;
    const endOff = abs + 14;
    const startOff = endOff + segCount * 2 + 2;
    const deltaOff = startOff + segCount * 2;
    const rangeOff = deltaOff + segCount * 2;
    console.log(`    fmt4 segCount=${segCount}`);
    for (let s = 0; s < segCount; s++) {
      const start = dec.readUInt16BE(startOff + s * 2);
      const end = dec.readUInt16BE(endOff + s * 2);
      if (end < 0x2500 || start > 0x2800) continue;
      const delta = dec.readUInt16BE(deltaOff + s * 2);
      const range = dec.readUInt16BE(rangeOff + s * 2);
      console.log(
        `    seg ${s}: U+${start.toString(16).toUpperCase()}–U+${end.toString(16).toUpperCase()} delta=${delta} range=${range}`,
      );
    }
  }
}

// Ringkasan coverage dari format 12 pertama
const f12 = entries.findIndex(() => true);
let total12 = 0;
let minCp = Infinity, maxCp = -1;
for (let i = 0; i < numSub; i++) {
  const subOff = dec.readUInt32BE(cm.off + 8 + i * 8);
  const abs = cm.off + subOff;
  const fmt = dec.readUInt16BE(abs);
  if (fmt !== 12) continue;
  const ng = dec.readUInt32BE(abs + 12);
  for (let g = 0; g < ng; g++) {
    const sc = dec.readUInt32BE(abs + 16 + g * 12);
    const ec = dec.readUInt32BE(abs + 20 + g * 12);
    total12 += ec - sc + 1;
    if (sc < minCp) minCp = sc;
    if (ec > maxCp) maxCp = ec;
  }
  break;
}
console.log(`fmt12 total codepoint: ${total12} | rentang U+${minCp.toString(16).toUpperCase()}–U+${maxCp.toString(16).toUpperCase()}`);
