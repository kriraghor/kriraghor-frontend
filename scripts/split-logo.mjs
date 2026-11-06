// Builds every logo file from the two master images in scripts/brand (Version A, product owner, 5 Nov 2026):
// the same-size transparent pieces the animations use (bottle with its ring, upper arm, lower arm), the whole
// logo, the white-tile icons (browser tab, phone home screen, share images) and favicon.ico.
//
// The pieces only divide the master's pixels, so stacked they are the master again.
//
// Usage: node scripts/split-logo.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = join(root, "scripts", "brand");
const APPS = ["web", "esports", "gym", "portal"].map((a) => join(root, "apps", a, "public"));
const PIECE = 256; // shown at up to 128 px, so 2× is enough

// The ring in the master's 1024 square: its centre and outer radius, and the bottle's right edge.
const RING = { x: 276, y: 676, r: 178 };
const BOTTLE_RIGHT = 384;

async function pieces(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const out = { bottle: Buffer.alloc(data.length), upper: Buffer.alloc(data.length), lower: Buffer.alloc(data.length) };
  for (let i = 0; i < W * H; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    if (!a) continue;
    const x = i % W;
    const y = (i - x) / W;
    const orange = r > 200 && b < 60 && g < 170;
    const inRing = (x - RING.x) ** 2 + (y - RING.y) ** 2 <= RING.r ** 2;
    const name = orange ? "upper" : inRing || x <= BOTTLE_RIGHT ? "bottle" : "lower";
    out[name].set([r, g, b, a], i * 4);
  }
  const png = {};
  for (const [name, buf] of Object.entries(out)) {
    png[name] = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).resize(PIECE, PIECE, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
  }
  return png;
}

/** The logo on a white rounded tile: browser tabs and home screens can be any colour, and the logo has black in it. */
async function tile(size, { radius = 0.18, fill = 0.84 } = {}) {
  const r = Math.round(size * radius);
  const bg = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`);
  const inner = Math.round(size * fill);
  const logo = await sharp(join(BRAND, "logo-light.png")).resize(inner, inner, { kernel: "lanczos3" }).toBuffer();
  const at = Math.round((size - inner) / 2);
  return sharp(bg).composite([{ input: logo, left: at, top: at }]).png({ compressionLevel: 9 }).toBuffer();
}

/** A .ico is a small directory of PNGs. */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head[e] = size === 256 ? 0 : size;
    head[e + 1] = size === 256 ? 0 : size;
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map((m) => m.png)]);
}

const light = await pieces(join(BRAND, "logo-light.png"));
const dark = await pieces(join(BRAND, "logo-dark.png"));
const whole = (name, size) => sharp(join(BRAND, `logo-${name}.png`)).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
const files = {
  "brand/logo-bottle.png": light.bottle,
  "brand/logo-bottle-dark.png": dark.bottle,
  "brand/logo-lower.png": light.lower,
  "brand/logo-lower-dark.png": dark.lower,
  "brand/logo-upper.png": light.upper,
  "brand/logo-mark.png": await whole("light", PIECE),
  "brand/logo-mark-dark.png": await whole("dark", PIECE),
  "logo.png": await whole("light", 512),
  "icon-512.png": await tile(512),
  "apple-icon.png": await tile(180, { radius: 0 }),
};
const favicon = ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await tile(size, { fill: 0.94 }) }))));

for (const pub of APPS) {
  mkdirSync(join(pub, "brand"), { recursive: true });
  for (const [name, buf] of Object.entries(files)) writeFileSync(join(pub, name), buf);
}
for (const a of ["web", "esports", "gym", "portal"]) writeFileSync(join(root, "apps", a, "src", "app", "favicon.ico"), favicon);
console.log(`wrote ${Object.keys(files).length} files and favicon.ico for ${APPS.length} apps`);
