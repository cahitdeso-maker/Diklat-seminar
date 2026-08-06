// scripts/check-noto-font.cjs
// Verifikasi bahwa font woff2 benar-benar mengandung glyph U+25B4 (▴) dan U+25BE (▾).
// Parsing cmap langsung dari data woff2 (decompress brotli, jalan-jalan di table directory).
// Mengikuti W3C WOFF2 spec (https://www.w3.org/TR/WOFF2/#table_dir_format).
const zlib = require("zlib");
const fs = require("fs");

// Known Table Tags (W3C WOFF2 spec section 4.1)
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

function decodeUIntBase128(buf, offObj) {
  let accum = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf.readUInt8(offObj.off);
    offObj.off += 1;
    if (i === 0 && byte === 0x80) throw new Error("UIntBase128 leading byte 0x80");
    if (accum & 0xfe000000) throw new Error("UIntBase128 overflow");
    accum = (accum << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return accum;
  }
  throw new Error("UIntBase128 too long");
}

// Parse woff2 → { tables: { tag: {offset, length} }, dirEndOffset }
function parseWoff2(woff2Buf) {
  if (woff2Buf.length < 48) throw new Error("File terlalu pendek untuk header woff2");
  if (woff2Buf.toString("latin1", 0, 4) !== "wOF2") throw new Error("Bukan file woff2");
  const numTables = woff2Buf.readUInt16BE(12);
  const totalCompressedSize = woff2Buf.readUInt32BE(20);

  let off = 48;
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const flags = woff2Buf.readUInt8(off);
    off += 1;
    const index = flags & 0x3f;
    const tv = (flags >> 6) & 0x3;
    let tag;
    if (index === 0x3f) {
      // 4-byte inline tag (UInt32, optional field per spec)
      tag = woff2Buf.toString("latin1", off, off + 4);
      off += 4;
    } else {
      tag = KNOWN_TAGS[index];
    }
    const o = { off };
    const origLength = decodeUIntBase128(woff2Buf, o);
    off = o.off;
    // transformLength hadir iff table diproses dengan non-null transform:
    //  - glyf/loca: null transform = tv 3, jadi transformed iff tv !== 3
    //  - lainnya  : null transform = tv 0, jadi transformed iff tv !== 0
    let isTransformed;
    if (tag === "glyf" || tag === "loca") {
      isTransformed = tv !== 3;
    } else {
      isTransformed = tv !== 0;
    }
    let transformLength = 0;
    if (isTransformed) {
      const o2 = { off };
      transformLength = decodeUIntBase128(woff2Buf, o2);
      off = o2.off;
    }
    entries.push({
      tag,
      origLength,
      tv,
      transformLength,
      storedLength: isTransformed ? transformLength : origLength,
    });
  }

  const compressed = woff2Buf.subarray(off, off + totalCompressedSize);
  const decompressed = zlib.brotliDecompressSync(compressed);
  let cursor = 0;
  const tables = {};
  for (const e of entries) {
    tables[e.tag.trim()] = { offset: cursor, length: e.storedLength };
    cursor += e.storedLength;
  }
  return { tables, decompressed, dirEndOffset: off, totalCompressedSize };
}

function parseCmap(decompressed, cmapTable) {
  const buf = decompressed.subarray(cmapTable.offset, cmapTable.offset + cmapTable.length);
  const numTables = buf.readUInt16BE(2);
  const subtables = [];
  for (let i = 0; i < numTables; i++) {
    subtables.push({
      platformID: buf.readUInt16BE(4 + i * 8),
      encodingID: buf.readUInt16BE(6 + i * 8),
      offset: buf.readUInt32BE(8 + i * 8),
    });
  }
  const target =
    subtables.find((s) => s.platformID === 3 && s.encodingID === 1) ||
    subtables.find((s) => s.platformID === 0 && s.encodingID === 3) ||
    subtables.find((s) => s.platformID === 0 && s.encodingID === 4) ||
    subtables.find((s) => s.platformID === 3 && s.encodingID === 10);
  if (!target) return { format: "none", has: { up: false, down: false } };
  const format = buf.readUInt16BE(target.offset);
  const sub = buf.subarray(target.offset);
  const has = { up: false, down: false };
  if (format === 4) {
    const segCount = buf.readUInt16BE(target.offset + 6) / 2;
    const endCodesOff = target.offset + 14;
    const startCodesOff = endCodesOff + segCount * 2 + 2;
    const idDeltaOff = startCodesOff + segCount * 2;
    const idRangeOff = idDeltaOff + segCount * 2;
    const glyphIdArrayOff = idRangeOff + segCount * 2;
    for (let i = 0; i < segCount; i++) {
      const start = buf.readUInt16BE(startCodesOff + i * 2);
      const end = buf.readUInt16BE(endCodesOff + i * 2);
      if (start === 0xffff) continue;
      for (const cp of [0x25b4, 0x25be]) {
        if (cp >= start && cp <= end) {
          const idDelta = buf.readUInt16BE(idDeltaOff + i * 2);
          const idRangeOffset = buf.readUInt16BE(idRangeOff + i * 2);
          let glyphId;
          if (idRangeOffset === 0) {
            glyphId = (cp + idDelta) & 0xffff;
          } else {
            const idx = idRangeOff + i * 2 + idRangeOffset + (cp - start) * 2;
            const g = buf.readUInt16BE(idx);
            glyphId = g === 0 ? 0 : (g + idDelta) & 0xffff;
          }
          if (glyphId !== 0) {
            if (cp === 0x25b4) has.up = true;
            if (cp === 0x25be) has.down = true;
          }
        }
      }
    }
  } else if (format === 12) {
    const numGroups = buf.readUInt32BE(target.offset + 12);
    for (let g = 0; g < numGroups; g++) {
      const startChar = buf.readUInt32BE(target.offset + 16 + g * 12);
      const endChar = buf.readUInt32BE(target.offset + 20 + g * 12);
      const startGlyph = buf.readUInt32BE(target.offset + 24 + g * 12);
      for (const cp of [0x25b4, 0x25be]) {
        if (cp >= startChar && cp <= endChar && startGlyph + (cp - startChar) !== 0) {
          if (cp === 0x25b4) has.up = true;
          if (cp === 0x25be) has.down = true;
        }
      }
    }
  }
  return { format, has, subtableCount: numTables };
}

async function check(url, label) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      console.log(`✗ ${label}: HTTP ${res.status}`);
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`✓ ${label}: fetched ${(buf.length / 1024).toFixed(1)} KB`);
    const { tables, decompressed } = parseWoff2(buf);
    if (!tables.cmap) {
      console.log(`  ✗ cmap tidak ditemukan! Tables: ${Object.keys(tables).join(", ")}`);
      return;
    }
    const result = parseCmap(decompressed, tables.cmap);
    console.log(
      `  cmap format ${result.format}: ▴(U+25B4) present=${result.has.up}, ▾(U+25BE) present=${result.has.down}`,
    );
    const outName = label.replace(/[^a-z0-9]+/gi, "_").toLowerCase() + ".woff2";
    fs.writeFileSync(outName, buf);
    console.log(`  saved to ${outName}`);
  } catch (e) {
    console.log(`✗ ${label}: ERROR ${e.message}`);
  }
}

(async () => {
  const urls = [
    [
      "Noto Sans Symbols",
      "https://fonts.gstatic.com/s/notosanssymbols/v47/rP2up3q65FkAtHfwd-eIS2brbDN6gxP34F9jRRCe4W3gfQ8QA_9Edkw.woff2",
    ],
  ];
  for (const [label, url] of urls) await check(url, label);
})();
