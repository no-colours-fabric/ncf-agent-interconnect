import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
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
await copyFile('desktop/assets/app-icon.png', 'build/assets/icon.png');
await copyFile('desktop/assets/app-icon.icns', 'build/assets/icon.icns');
await copyFile('desktop/assets/app-icon.ico', 'build/assets/icon.ico');
await writeFile('build/assets/trayTemplate.png', image(22, true));
await writeFile('build/assets/trayTemplate@2x.png', image(44, true));
if (process.platform === 'darwin') {
  await copyFile('desktop/assets/chatgpt-shortcut.icns', 'build/assets/chatgpt-shortcut.icns');
  execFileSync(
    '/usr/bin/xcrun',
    [
      '--sdk',
      'macosx',
      'clang',
      '-fobjc-arc',
      '-framework',
      'AppKit',
      '-arch',
      'arm64',
      '-arch',
      'x86_64',
      '-mmacosx-version-min=12.0',
      '-o',
      'build/assets/codex-mac-launcher',
      'desktop/integrations/codex-shortcut-mac.m',
    ],
    { stdio: 'inherit' },
  );
}
if (process.platform === 'win32') {
  const csc = path.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'Microsoft.NET',
    'Framework64',
    'v4.0.30319',
    'csc.exe',
  );
  for (const helper of ['codex-win-socket', 'codex-stdio-shim', 'codex-console-stop']) {
    execFileSync(
      csc,
      [
        '/nologo',
        '/optimize+',
        '/target:exe',
        helper === 'codex-win-socket' && process.arch !== 'x64'
          ? '/platform:anycpu'
          : '/platform:x64',
        ...(helper === 'codex-stdio-shim' ? ['/reference:System.Web.Extensions.dll'] : []),
        '/out:' + path.resolve('build', 'assets', helper + '.exe'),
        path.resolve('desktop', 'integrations', helper + '.cs'),
      ],
      { stdio: 'inherit', windowsHide: true },
    );
  }
  await mkdir('build/integrations', { recursive: true });
  await copyFile(
    'desktop/integrations/codex-windows-bridge.cjs',
    'build/integrations/codex-windows-bridge.cjs',
  );
}
await mkdir('release', { recursive: true });
await copyFile('distribution/README.md', 'release/README.md');
