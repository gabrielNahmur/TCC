import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const palette = {
  forest: [18, 55, 42, 255],
  amber: [242, 195, 107, 255]
};

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function roundedRect(pixels, size, x, y, width, height, radius, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const dx = Math.max(x + radius - px, 0, px - (x + width - radius - 1));
      const dy = Math.max(y + radius - py, 0, py - (y + height - radius - 1));
      if (dx * dx + dy * dy <= radius * radius) setPixel(pixels, size, px, py, color);
    }
  }
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = (y * size + x) * 4;
  pixels.set(color, offset);
}

function circle(pixels, size, cx, cy, radius, color) {
  const radiusSquared = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radiusSquared) setPixel(pixels, size, x, y, color);
    }
  }
}

function createIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const scale = size / 192;
  const n = (value) => Math.round(value * scale);

  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(palette.forest, offset);
  roundedRect(pixels, size, n(28), n(28), n(136), n(136), n(30), palette.amber);

  // Cadeado: arco vazado e corpo. O desenho é deliberadamente simples para
  // continuar legível em telas iniciais pequenas.
  circle(pixels, size, n(96), n(83), n(34), palette.forest);
  circle(pixels, size, n(96), n(83), n(20), palette.amber);
  roundedRect(pixels, size, n(57), n(82), n(78), n(64), n(13), palette.forest);
  circle(pixels, size, n(96), n(111), n(7), palette.amber);
  roundedRect(pixels, size, n(93), n(111), n(6), n(17), n(3), palette.amber);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, rowOffset + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const root = fileURLToPath(new URL("../public/", import.meta.url));
for (const size of [192, 512]) writeFileSync(`${root}icon-${size}.png`, createIcon(size));
