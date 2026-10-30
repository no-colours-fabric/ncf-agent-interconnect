import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
const table = Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  t.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc(Buffer.concat([t, data])), data.length + 8);
  return result;
}
function image(size, template) {
  const stride = size * 4 + 1,
    data = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = x / size,
        ny = y / size,
        circles = [
          [0.25, 0.28],
          [0.75, 0.28],
          [0.5, 0.74],
        ],
        line =
          (Math.abs(ny - (nx * 0.92 + 0.05)) < 0.04 && nx > 0.24 && nx < 0.5) ||
          (Math.abs(ny - (-nx * 0.92 + 0.97)) < 0.04 && nx > 0.5 && nx < 0.76) ||
          (Math.abs(ny - 0.28) < 0.04 && nx > 0.25 && nx < 0.75);
      const active = line || circles.some(([cx, cy]) => Math.hypot(nx - cx, ny - cy) < 0.13);
      const i = y * stride + 1 + x * 4;
      if (template) {
        if (active) data[i + 3] = 255;
      } else {
        const edge = Math.min(nx, ny, 1 - nx, 1 - ny);
        const inside =
          edge > 0.06 ||
          Math.hypot(Math.max(0.12 - nx, 0, nx - 0.88), Math.max(0.12 - ny, 0, ny - 0.88)) < 0.065;
        data[i] = active ? 217 : 23;
        data[i + 1] = active ? 247 : 107;
        data[i + 2] = active ? 236 : 98;
        data[i + 3] = inside ? 255 : 0;
      }
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(data)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
await mkdir('build/assets', { recursive: true });
await writeFile('build/assets/icon.png', image(512, false));
await writeFile('build/assets/trayTemplate.png', image(22, true));
await writeFile('build/assets/trayTemplate@2x.png', image(44, true));
await mkdir('release', { recursive: true });
await copyFile('distribution/README.md', 'release/README.md');
