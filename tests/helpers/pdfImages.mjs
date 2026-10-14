// Images intégrées d'un PDF scanné → PNG (Buffer), sans dépendance native.
// Sert aux tests Node de l'OCR, où il n'y a pas de canvas pour rendre la page.
import { deflateSync } from 'node:zlib';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** kind PDF.js : 1 = gris 1 bit, 2 = RGB 24 bits, 3 = RGBA 32 bits. */
export function toPng({ width, height, data, kind }) {
  const rgba = Buffer.alloc(width * height * 4);
  if (kind === 1) {
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const v = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1 ? 255 : 0;
        rgba.set([v, v, v, 255], (y * width + x) * 4);
      }
  } else {
    const ch = kind === 2 ? 3 : 4;
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = data[i * ch];
      rgba[i * 4 + 1] = data[i * ch + 1];
      rgba[i * 4 + 2] = data[i * ch + 2];
      rgba[i * 4 + 3] = 255;
    }
  }
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Plus grande image de la page (le scan), en PNG, avec ses dimensions. */
export async function pageScanImage(page) {
  const ops = await page.getOperatorList();
  let best;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== OPS.paintImageXObject) continue;
    const img = await new Promise((res) => page.objs.get(ops.argsArray[i][0], res));
    if (!best || img.width * img.height > best.width * best.height) best = img;
  }
  return best && { png: toPng(best), width: best.width, height: best.height };
}
