// Makes the logo masters from the product owner's artwork (23 Nov 2026: the orange and white "K" on black,
// scripts/brand/logo-art.jpg). Nothing is redrawn: every pixel comes from the artwork.
//
// The artwork is two flat colours on pure black, so each pixel is the colour times its coverage. The black is
// keyed out: coverage (alpha) is the pixel's brightness over its colour's, and the colour is snapped back to
// the artwork's own white or orange. Then:
//  - logo-dark.png:  as supplied (white and orange), transparent, for dark backgrounds;
//  - logo-light.png: the white parts in black ink, for light backgrounds (as Version A was).
// Both are the same square crop around the mark, so split-logo.mjs cuts the same pieces from each; the icons
// put logo-dark.png back on black, which is the artwork again.
//
// Usage: node scripts/brand-from-art.mjs, then node scripts/split-logo.mjs
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BRAND = join(dirname(fileURLToPath(import.meta.url)), "brand");
const ART = join(BRAND, "logo-art.jpg");

// The artwork's two colours (measured: the mean of its solid pixels).
const WHITE = [238, 238, 236];
const ORANGE = [248, 100, 1];
const INK = [0, 0, 0];
// The square around the mark (780 × 421 px, centred in the 1024 artwork) with a small margin.
export const CROP = { left: 112, top: 112, size: 800 };
const NOISE = 6; // JPEG ringing on the black, below this brightness, is background

const { data, info } = await sharp(ART).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;

const SOLID = 96; // bright enough that its colour is certain
const REACH = 5; // a dim edge pixel takes the colour of the nearest solid pixel within this many px

/** White (true) or orange (false) by hue: white has green ≈ red; orange has green ≈ 0.4 × red. */
const whiteAt = (s) => data[s + 1] / Math.max(data[s], 1) > (1 + ORANGE[1] / ORANGE[0]) / 2;

/** One keyed RGBA image of the crop; `ink` replaces the white. */
function keyed(ink) {
  const { left, top, size } = CROP;
  const out = Buffer.alloc(size * size * 4);
  const at = (x, y) => ((top + y) * W + (left + x)) * 3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = at(x, y);
      const m = Math.max(data[s], data[s + 1], data[s + 2]);
      if (m < NOISE) continue;
      // A dim pixel's hue is mostly JPEG noise: it belongs to the nearest solid shape.
      let isWhite = whiteAt(s);
      if (m < SOLID) {
        let best = Infinity;
        for (let dy = -REACH; dy <= REACH; dy++) {
          for (let dx = -REACH; dx <= REACH; dx++) {
            const d = dx * dx + dy * dy;
            if (d >= best || x + dx < 0 || y + dy < 0 || x + dx >= size || y + dy >= size) continue;
            const n = at(x + dx, y + dy);
            if (Math.max(data[n], data[n + 1], data[n + 2]) >= SOLID) {
              best = d;
              isWhite = whiteAt(n);
            }
          }
        }
      }
      const ref = isWhite ? Math.max(...WHITE) : Math.max(...ORANGE);
      const a = Math.min(255, Math.round((m / ref) * 255));
      const col = isWhite ? (ink ?? WHITE) : ORANGE;
      out.set([...col, a], (y * size + x) * 4);
    }
  }
  return sharp(out, { raw: { width: size, height: size, channels: 4 } });
}

const SIZE = 1024;
const save = (img, name) => img.resize(SIZE, SIZE, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toFile(join(BRAND, name));
await save(keyed(null), "logo-dark.png");
await save(keyed(INK), "logo-light.png");
console.log("wrote logo-dark.png and logo-light.png");
