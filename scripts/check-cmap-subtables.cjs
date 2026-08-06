// scripts/check-cmap-subtables.cjs
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

function parseWoff2(buf) {
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
  return { dec, cm: tabs.cmap };
}

function fmt4(dec, cmOff, o) {
  const seg = dec.readUInt16BE(cmOff + o + 6) / 2;
  const eO = cmOff + o + 14;
  const sO = eO + seg * 2 + 2;
  const dO = sO + seg * 2;
  const rO = dO + seg * 2;
  const out = {};
  for (let i = 0; i < seg; i++) {
    const st = dec.readUInt16BE(sO + i * 2);
    const en = dec.readUInt16BE(eO + i * 2);
    if (st === 0xffff) continue;
    for (let cp = st; cp <= en; cp++) {
      const id = dec.readUInt16BE(dO + i * 2);
      const ro = dec.readUInt16BE(rO + i * 2);
      let g;
      if (ro === 0) g = (cp + id) & 0xffff;
      else {
        g = dec.readUInt16BE(rO + i * 2 + ro + (cp - st) * 2);
        if (g !== 0) g = (g + id) & 0xffff;
      }
      if (g !== 0) out[cp] = g;
    }
  }
  return out;
}

function fmt12(dec, cmOff, o) {
  const ng = dec.readUInt32BE(cmOff + o + 12);
  const out = {};
  for (let g = 0; g < ng; g++) {
    const sc = dec.readUInt32BE(cmOff + o + 16 + g * 12);
    const ec = dec.readUInt32BE(cmOff + o + 20 + g * 12);
    const sg = dec.readUInt32BE(cmOff + o + 24 + g * 12);
    for (let cp = sc; cp <= ec; cp++) {
      if (sg + (cp - sc) !== 0) out[cp] = sg + (cp - sc);
    }
  }
  return out;
}

const buf = fs.readFileSync("noto_sans_symbols.woff2");
const { dec, cm } = parseWoff2(buf);
const subN = dec.readUInt16BE(cm.off + 2);
const maps = [];
for (let i = 0; i < subN; i++) {
  const p = dec.readUInt16BE(cm.off + 4 + i * 8);
  const e = dec.readUInt16BE(cm.off + 6 + i * 8);
  const o = dec.readUInt32BE(cm.off + 8 + i * 8);
  const fmt = dec.readUInt16BE(cm.off + o);
  const map = fmt === 4 ? fmt4(dec, cm.off, o) : fmt === 12 ? fmt12(dec, cm.off, o) : null;
  maps.push({ p, e, fmt, map });
  console.log(`subtable plat=${p} enc=${e} fmt=${fmt}`);
  for (const cp of [0x41, 0x25a0, 0x25b2, 0x25b4, 0x25bc, 0x25be, 0x2665, 0x1f600]) {
    if (map) {
      console.log(`  U+${cp.toString(16).toUpperCase().padStart(4, "0")}: gid=${map[cp] || 0}`);
    }
  }
}
