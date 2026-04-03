import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'assets', 'images');

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="230" fill="#1A3260"/>
  <text x="512" y="640" font-size="580" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif" fill="white">💰</text>
</svg>`;

const splashSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#1A3260"/>
  <text x="512" y="640" font-size="580" text-anchor="middle" font-family="Segoe UI Emoji,Apple Color Emoji,Noto Color Emoji,sans-serif" fill="white">💰</text>
</svg>`;

async function generate() {
  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(out, 'icon.png'));
  console.log('✓ icon.png');
  await sharp(Buffer.from(splashSvg)).png().toFile(path.join(out, 'splash-icon.png'));
  console.log('✓ splash-icon.png');
  await sharp(Buffer.from(iconSvg)).resize(48, 48).png().toFile(path.join(out, 'favicon.png'));
  console.log('✓ favicon.png');
  // Android adaptive icon foreground
  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(out, 'android-icon-foreground.png'));
  console.log('✓ android-icon-foreground.png');
  // Android adaptive icon background
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 26, g: 50, b: 96, alpha: 1 } }
  }).png().toFile(path.join(out, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png');
  // Monochrome (same as foreground)
  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(out, 'android-icon-monochrome.png'));
  console.log('✓ android-icon-monochrome.png');
  console.log('\nAll icons generated!');
}

generate().catch(console.error);
