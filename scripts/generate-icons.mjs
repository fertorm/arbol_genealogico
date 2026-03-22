/**
 * Generate PWA icon PNG files from the SVG icon
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const svgBuffer = readFileSync(join(publicDir, 'icon.svg'));

const sizes = [192, 512];

for (const size of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, `icon-${size}x${size}.png`));
  console.log(`✅ Generated icon-${size}x${size}.png`);
}

// Also generate a maskable icon (with padding for safe zone)
// Maskable icons should have content within the inner 80% (safe zone)
const maskableSize = 512;
const svgMaskable = readFileSync(join(publicDir, 'icon.svg'))
  .toString()
  .replace('<rect width="512" height="512" rx="80" fill="#FFFFFF"/>',
            '<rect width="512" height="512" rx="0" fill="#F5F0E8"/>');

await sharp(Buffer.from(svgMaskable))
  .resize(maskableSize, maskableSize)
  .png()
  .toFile(join(publicDir, `icon-maskable-${maskableSize}x${maskableSize}.png`));
console.log(`✅ Generated icon-maskable-${maskableSize}x${maskableSize}.png`);

console.log('\n🎉 All icons generated successfully!');
