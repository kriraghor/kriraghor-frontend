// Splits the Kriraghor logo into its three pieces (cricket ball, shuttlecock, football) as
// same-size transparent PNGs, so the loader can fly them in and they line up exactly
// (kriraghor-docs 09 §8, logo loader).
//
// The logo's white is transparent, so each piece is a set of colour islands. Amber is the
// football; a green island goes to the cricket ball or the shuttlecock, whichever is nearer
// (seeded inside each piece, both halves of the ball either side of its seam).
//
// Usage: node scripts/split-logo.mjs apps/web/public/logo.png <out dir> [<out dir> …]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SIZE = 256; // shown at up to 128 px, so 2× is enough
const [src, ...outs] = process.argv.slice(2);
if (!src || !outs.length) {
  console.error("Usage: node scripts/split-logo.mjs <logo.png> <out dir> [<out dir> …]");
  process.exit(1);
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;

// 0 transparent, 2 green, 3 amber (anything visible that is not amber counts as green).
const cls = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const r = data[i * 4], g = data[i * 4 + 1], a = data[i * 4 + 3];
  cls[i] = a < 40 ? 0 : r > g ? 3 : 2;
}

const at = (x, y) => Math.round((y * H) / 512) * W + Math.round((x * W) / 512);
const PIECES = ["cricket", "shuttle", "football"];
const SEEDS = { cricket: [at(200, 192), at(48, 160)], shuttle: [at(40, 324), at(300, 352)] };

// Flood each seed through its own colour.
const owner = new Int32Array(N).fill(-1);
const flood = (start, id) => {
  const q = [start];
  owner[start] = id;
  while (q.length) {
    const i = q.pop();
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (owner[j] === -1 && cls[j] === cls[start]) {
        owner[j] = id;
        q.push(j);
      }
    }
  }
};
for (const [name, points] of Object.entries(SEEDS)) {
  for (const p of points) {
    if (cls[p] !== 2) throw new Error(`seed for ${name} is not on green`);
    if (owner[p] === -1) flood(p, PIECES.indexOf(name));
  }
}

// Spread the green seeds outwards over every pixel (breadth first, 8 directions); amber is the football.
let frontier = [];
for (let i = 0; i < N; i++) {
  if (cls[i] === 3) owner[i] = 2;
  else if (owner[i] >= 0) frontier.push(i);
}
while (frontier.length) {
  const next = [];
  for (const i of frontier) {
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (owner[j] === -1) {
        owner[j] = owner[i];
        next.push(j);
      }
    }
  }
  frontier = next;
}

for (const out of outs) mkdirSync(out, { recursive: true });
for (let k = 0; k < PIECES.length; k++) {
  const buf = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) if (owner[i] === k && data[i * 4 + 3] > 0) data.copy(buf, i * 4, i * 4, i * 4 + 4);
  const png = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).resize(SIZE, SIZE).png({ compressionLevel: 9, palette: true }).toBuffer();
  for (const out of outs) await sharp(png).toFile(join(out, `logo-${PIECES[k]}.png`));
}
const whole = await sharp(src).resize(SIZE, SIZE).png({ compressionLevel: 9, palette: true }).toBuffer();
for (const out of outs) await sharp(whole).toFile(join(out, "logo-mark.png"));
console.log(`logo pieces → ${outs.join(", ")}`);
