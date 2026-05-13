/**
 * Generate AKAN PWA icons on the brand orange background.
 *
 * Composites the transparent logo onto a #af4408 canvas at multiple sizes:
 *   - akan-icon-192.png   — Android home screen ("any" purpose)
 *   - akan-icon-512.png   — Android splash ("any" purpose)
 *   - akan-icon-192-maskable.png  — Android adaptive icon (logo inside safe zone)
 *   - akan-icon-512-maskable.png  — same, larger
 *   - apple-touch-icon.png (180×180) — iOS home screen
 *   - favicon-16.png, favicon-32.png — browser tab favicons
 *
 * Usage:   node scripts/generate-pwa-icons.mjs
 * Source:  public/akan-logo.png  (any size; resized as needed)
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'akan-logo.png');

// Brand orange — matches manifest theme_color
const BG = { r: 0xaf, g: 0x44, b: 0x08, alpha: 1 };

// "any" purpose icons fill ~88% of canvas (small padding so logo isn't edge-glued)
// "maskable" icons fill ~70% of canvas so OS masks (circle/squircle) don't crop
const SIZES = [
  { out: 'akan-icon-192.png', canvas: 192, logoScale: 0.88, padTransparent: false },
  { out: 'akan-icon-512.png', canvas: 512, logoScale: 0.88, padTransparent: false },
  { out: 'akan-icon-192-maskable.png', canvas: 192, logoScale: 0.70, padTransparent: false },
  { out: 'akan-icon-512-maskable.png', canvas: 512, logoScale: 0.70, padTransparent: false },
  { out: 'apple-touch-icon.png', canvas: 180, logoScale: 0.88, padTransparent: false },
  // Favicons stay logo-only on transparent — they appear inside tiny tab strips
  { out: 'favicon-32.png', canvas: 32, logoScale: 1.0, padTransparent: true },
  { out: 'favicon-16.png', canvas: 16, logoScale: 1.0, padTransparent: true },
];

if (!fs.existsSync(SOURCE_LOGO)) {
  console.error(`Source logo not found: ${SOURCE_LOGO}`);
  process.exit(1);
}

console.log(`Source: ${SOURCE_LOGO}`);
console.log(`Output: ${PUBLIC_DIR}`);
console.log(`Background: rgb(${BG.r}, ${BG.g}, ${BG.b}) [#af4408]`);
console.log();

for (const spec of SIZES) {
  const { out, canvas, logoScale, padTransparent } = spec;
  const logoSize = Math.round(canvas * logoScale);
  const offset = Math.round((canvas - logoSize) / 2);

  // Resize logo (keep transparency)
  const logo = await sharp(SOURCE_LOGO)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Create background canvas — either brand color or transparent
  const bgInput = padTransparent
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : BG;

  const output = path.join(PUBLIC_DIR, out);
  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: bgInput,
    },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toFile(output);

  console.log(`  wrote  ${out.padEnd(34)} ${canvas}×${canvas}  logo@${logoSize}px  bg=${padTransparent ? 'transparent' : '#af4408'}`);
}

console.log('\nDone.');
