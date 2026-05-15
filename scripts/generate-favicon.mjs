import sharp from 'sharp';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets/favicon/source.png');
const outDir = join(root, 'assets/favicon');

const meta = await sharp(src).metadata();
const w = meta.width;
const h = meta.height;
// Face + yellow hat: tight square crop from upper-center
const cropSize = Math.round(Math.min(w, h) * 0.72);
const left = Math.round((w - cropSize) * 0.42);
const top = Math.round((h - cropSize) * 0.02);

const cropped = sharp(src).extract({
  left: Math.max(0, Math.min(left, w - cropSize)),
  top: Math.max(0, Math.min(top, h - cropSize)),
  width: Math.min(cropSize, w),
  height: Math.min(cropSize, h),
});

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-192x192.png', size: 192 },
  { name: 'favicon-512x512.png', size: 512 },
];

for (const { name, size } of sizes) {
  await cropped
    .clone()
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(join(outDir, name));
}

// Multi-size ICO (16, 32, 48)
const pngBuffers = await Promise.all(
  [16, 32, 48].map((size) =>
    cropped.clone().resize(size, size).png().toBuffer()
  )
);

// Minimal ICO writer (PNG-embedded entries for modern browsers)
function buildIco(buffers) {
  const count = buffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = buffers.map((buf, i) => {
    const size = [16, 32, 48][i];
    const entry = {
      width: size === 256 ? 0 : size,
      height: size === 256 ? 0 : size,
      offset,
      length: buf.length,
    };
    offset += buf.length;
    return entry;
  });
  const total = offset;
  const out = Buffer.alloc(total);
  // ICONDIR
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  let pos = 6;
  for (const e of entries) {
    out.writeUInt8(e.width, pos);
    out.writeUInt8(e.height, pos + 1);
    out.writeUInt8(0, pos + 2);
    out.writeUInt8(0, pos + 3);
    out.writeUInt16LE(1, pos + 4);
    out.writeUInt16LE(32, pos + 6);
    out.writeUInt32LE(e.length, pos + 8);
    out.writeUInt32LE(e.offset, pos + 12);
    pos += 16;
  }
  let dataPos = headerSize;
  for (const buf of buffers) {
    buf.copy(out, dataPos);
    dataPos += buf.length;
  }
  return out;
}

await writeFile(join(outDir, 'favicon.ico'), buildIco(pngBuffers));
console.log('Favicon assets written to assets/favicon/');
