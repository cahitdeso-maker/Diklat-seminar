// scripts/scan-symbol-range.cjs
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
  entries.push({ tag: tag.trim(), stored: trans ? tl : ol });
}
const comp = buf.subarray(off, off + buf.readUInt32BE(20));
const dec = zlib.brotliDecompressSync(comp);
let cur = 0;
const tabs = {};
for (const e of entries) {
  tabs[e.tag] = { off: cur, len: e.stored };
  cur += e.stored;
}
const cm = tabs.cmap;
const o12 = dec.readUInt32BE(cm.off + 8 + 1 * 8); // plat 0 enc 4
const s12 = cm.off + o12;
const ng = dec.readUInt32BE(s12 + 12);
console.log("numGroups:", ng);

const present = {};
const interesting = [];
for (let g = 0; g < ng; g++) {
  const sc = dec.readUInt32BE(s12 + 16 + g * 12);
  const ec = dec.readUInt32BE(s12 + 20 + g * 12);
  const sg = dec.readUInt32BE(s12 + 24 + g * 12);
  for (let cp = sc; cp <= ec; cp++) {
    const gid = sg + (cp - sc);
    if (gid !== 0) present[cp] = gid;
    if (cp >= 0x2000 && cp <= 0x2fff) interesting.push([cp, gid, sc, ec]);
  }
}
console.log("total mapped cps:", Object.keys(present).length);
console.log("=== codepoints in 0x2000-0x2FFF ===");
for (const [cp, gid, sc, ec] of interesting) {
  console.log(`U+${cp.toString(16).toUpperCase().padStart(4, "0")} gid=${gid} (group ${sc.toString(16)}-${ec.toString(16)})`);
}
// explicit targets
for (const t of [0x25b4, 0x25be, 0x25a0, 0x25b2, 0x25bc, 0x25bd, 0x2665]) {
  console.log(`TARGET U+${t.toString(16).toUpperCase()}: ${present[t] ? "gid=" + present[t] : "MISSING"}`);
}
