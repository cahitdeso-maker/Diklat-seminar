// scripts/debug-cmap.cjs
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

const buf = fs.readFileSync("noto_sans_symbols.woff2");
let off = 48;
const n = buf.readUInt16BE(12);
const entries = [];
let sumStored = 0;
for (let i = 0; i < n; i++) {
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
  const stored = trans ? tl : ol;
  sumStored += stored;
  entries.push({ tag: tag.trim(), tv, orig: ol, stored });
}
console.log("entries:", entries.map((e) => `${e.tag}(${e.orig}/${e.stored})`).join(" "));
const comp = buf.subarray(off, off + buf.readUInt32BE(20));
const dec = zlib.brotliDecompressSync(comp);
console.log("decompressed length:", dec.length, "sumStored:", sumStored, "match:", dec.length === sumStored);

let cur = 0;
const tabs = {};
for (const e of entries) {
  tabs[e.tag] = { off: cur, len: e.stored };
  cur += e.stored;
}
const cm = tabs.cmap;
console.log("cmap at", cm.off, "len", cm.len);
console.log("cmap version:", dec.readUInt16BE(cm.off), "numTables:", dec.readUInt16BE(cm.off + 2));
// subtable 1 = plat 0 enc 4 → format 12 at relative offset
const o12 = dec.readUInt32BE(cm.off + 8 + 1 * 8);
console.log("fmt12 subtable relative offset:", o12, "absolute:", cm.off + o12);
const s12 = cm.off + o12;
console.log("fmt12 header: format", dec.readUInt16BE(s12), "reserved", dec.readUInt16BE(s12 + 2), "length", dec.readUInt32BE(s12 + 4), "language", dec.readUInt32BE(s12 + 8), "numGroups", dec.readUInt32BE(s12 + 12));
console.log("first 5 groups:");
for (let g = 0; g < Math.min(5, dec.readUInt32BE(s12 + 12)); g++) {
  const sc = dec.readUInt32BE(s12 + 16 + g * 12);
  const ec = dec.readUInt32BE(s12 + 20 + g * 12);
  const sg = dec.readUInt32BE(s12 + 24 + g * 12);
  console.log(`  group ${g}: start=${sc.toString(16)} end=${ec.toString(16)} startGlyph=${sg}`);
}
// search all groups for our targets
const ng = dec.readUInt32BE(s12 + 12);
const targets = [0x25b4, 0x25be, 0x25a0, 0x25b2, 0x25bc];
for (let g = 0; g < ng; g++) {
  const sc = dec.readUInt32BE(s12 + 16 + g * 12);
  const ec = dec.readUInt32BE(s12 + 20 + g * 12);
  const sg = dec.readUInt32BE(s12 + 24 + g * 12);
  for (const t of targets) {
    if (t >= sc && t <= ec) console.log(`  target U+${t.toString(16)} in group ${g}: gid=${sg + (t - sc)}`);
  }
}
