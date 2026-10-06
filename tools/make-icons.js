// Draws the app icons as pixel art and writes them to icons/. Run with:  node tools/make-icons.js   (no installs needed)
// One 32 x 32 picture (an 8-ball on the cloth) is scaled up with hard pixel edges. The ball stays inside the
// middle 80% so phones can crop the icon to a circle or rounded square ("maskable") without cutting it.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const out = path.join(__dirname, '..', 'icons');

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const COL = {
  cloth: hex('#1d8a74'), clothDark: hex('#12604f'), shadow: hex('#0e4a3e'), ink: hex('#0d0a1c'),
  ballLit: hex('#4a4560'), ball: hex('#26222f'), ballDark: hex('#141019'), paper: hex('#f7ead2'), paperDark: hex('#d9c7a8'),
  shine: hex('#fff4dd'),
};
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dither = (x, y, t) => t > (BAYER[y & 3][x & 3] + 0.5) / 16;   // true on roughly a fraction t of pixels

const N = 32, CX = 16, CY = 15.5, RB = 10.4;          // grid size, ball centre and radius (grid pixels)
const DCX = 15, DCY = 14.5, RD = 4.4;                // the white "8" disc, nudged towards the light
const EIGHT = ['111', '101', '111', '101', '111'];
function pixel(x, y) {
  const px = x + 0.5, py = y + 0.5;
  const dx = px - CX, dy = py - CY, d = Math.hypot(dx, dy);
  if (d <= RB) {
    // the digit, then the disc, then the ball, all lit from the top left
    const gx = x - (DCX - 2), gy = y - (DCY - 2.5);
    if (gx >= 0 && gx < 3 && gy >= 0 && gy < 5 && EIGHT[gy][gx] === '1') return COL.ink;
    const dd = Math.hypot(px - DCX, py - DCY);
    if (dd <= RD) return dd > RD - 1.1 && px + py > DCX + DCY + 2 ? COL.paperDark : COL.paper;
    if (Math.hypot(px - (CX - 5.5), py - (CY - 5.5)) < 1.3) return COL.shine;
    const light = (-dx - dy) / (1.414 * RB);          // -1 (lower right) to 1 (upper left)
    if (light > 0.4) return dither(x, y, (light - 0.4) * 4) ? COL.ballLit : COL.ball;
    if (light < -0.35) return dither(x, y, (-0.35 - light) * 3) ? COL.ballDark : COL.ball;
    return COL.ball;
  }
  if (d <= RB + 1.02) return COL.ink;                // the game's dark outline
  if (Math.hypot((px - CX - 2.5) / 1.15, py - CY - 2.5) <= RB + 0.5) return COL.shadow;
  const edge = Math.hypot(px - 16, py - 16) / 22.6;   // darker cloth towards the corners, dithered like the game
  return dither(x, y, (edge - 0.45) * 1.8) ? COL.clothDark : COL.cloth;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;                     // filter: none
    for (let x = 0; x < size; x++) {
      const c = pixel(Math.floor(x * N / size), Math.floor(y * N / size));
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;                          // 8 bits per channel, RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(out, name), png(size));
  console.log(`Wrote icons/${name} (${size} x ${size})`);
}
