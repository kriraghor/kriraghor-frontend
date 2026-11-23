// Builds every logo file from the two master images in scripts/brand (the "K" of 23 Nov 2026, made from the
// product owner's artwork by brand-from-art.mjs): the same-size transparent pieces the animations use (the
// stem, the orange strokes, the lower arm), the whole logo, the icons on black (browser tab, phone home
// screen, share images: the artwork's own black) and favicon.ico.
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

// In the master's 1024 square, the lower arm is the white (or ink) below and right of this corner; the rest of
// the white is the stem. The two never touch: the orange strokes run between them.
const LOWER = { x: 394, y: 471 };

async function pieces(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const out = { stem: Buffer.alloc(data.length), upper: Buffer.alloc(data.length), lower: Buffer.alloc(data.length) };
  for (let i = 0; i < W * H; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    if (!a) continue;
    const x = i % W;
    const y = (i - x) / W;
    // Orange by its hue (red well above green), so its soft edges stay with it; white and black ink never are.
    const orange = r > 1.6 * g + 8 && r > b + 40;
    const name = orange ? "upper" : x > LOWER.x && y > LOWER.y ? "lower" : "stem";
    out[name].set([r, g, b, a], i * 4);
  }
  const png = {};
  for (const [name, buf] of Object.entries(out)) {
    png[name] = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).resize(PIECE, PIECE, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
  }
  return png;
}

/** The logo on a black rounded tile, as in the artwork: browser tabs and home screens can be any colour. */
async function tile(size, { radius = 0.18, fill = 0.84 } = {}) {
  const r = Math.round(size * radius);
  const bg = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#000"/></svg>`);
  const inner = Math.round(size * fill);
  const logo = await sharp(join(BRAND, "logo-dark.png")).resize(inner, inner, { kernel: "lanczos3" }).toBuffer();
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
  "brand/logo-stem.png": light.stem,
  "brand/logo-stem-dark.png": dark.stem,
  "brand/logo-lower.png": light.lower,
  "brand/logo-lower-dark.png": dark.lower,
  "brand/logo-upper.png": light.upper,
  "brand/logo-mark.png": await whole("light", PIECE),
  "brand/logo-mark-dark.png": await whole("dark", PIECE),
  // The share cards' logo (packages/ui share/og.tsx), on their dark field.
  "logo.png": await whole("dark", 512),
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
