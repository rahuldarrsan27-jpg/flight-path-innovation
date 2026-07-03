/**
 * Regenerate FPI Aviation logo marks + favicons from the master lockup.
 *
 *   npm i -D jimp@0.22.12
 *   node brand/generate-icons.js
 *
 * Input : brand/logo-source.jpeg  (full stacked lockup, dark+blue on near-white)
 * Output: public/assets/logo-mark.png        (original colours, transparent)
 *         public/assets/logo-mark-light.png  (charcoal->white, blue kept — for the dark site)
 *         public/{favicon-16,favicon-32,apple-touch-icon,icon-192,icon-512}.png
 *
 * It auto-detects the monogram (top ink band, split from the wordmark by the white
 * gap), soft-keys the near-white background to transparent, and for the "light"
 * variant recolours the charcoal strokes to near-white while preserving the blue.
 */
const Jimp = require('jimp');
const path = require('path');

const SRC = path.join(__dirname, 'logo-source.jpeg');
const PUB = path.join(__dirname, '..', 'public');
const ASSETS = path.join(PUB, 'assets');
const NAVY = 0x0b1622ff; // icon background — reads on light and dark browser tabs

const isBlue = (r, g, b) => b > 130 && b - r > 30 && b - g > 20;
function alphaFor(r, g, b) {
  const w = Math.min(r, g, b);
  if (w >= 240) return 0;
  if (w <= 205) return 255;
  return Math.round((240 - w) / (240 - 205) * 255);
}

Jimp.read(SRC).then(async (img) => {
  const W = img.bitmap.width, H = img.bitmap.height, d = img.bitmap.data;
  const ink = (x, y) => { const i = (y * W + x) << 2; return Math.min(d[i], d[i + 1], d[i + 2]) < 235; };

  const rowInk = new Array(H).fill(0);
  for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) if (ink(x, y)) c++; rowInk[y] = c; }
  const thr = Math.max(4, W * 0.004);
  const bands = []; let start = -1, gap = 0;
  for (let y = 0; y < H; y++) {
    if (rowInk[y] > thr) { if (start < 0) start = y; gap = 0; }
    else if (start >= 0) { if (++gap > 15) { bands.push([start, y - gap]); start = -1; gap = 0; } }
  }
  if (start >= 0) bands.push([start, H - 1]);
  bands.sort((a, b) => a[0] - b[0]);
  const [my0, my1] = bands[0]; // top band = monogram

  let mx0 = W, mx1 = 0;
  for (let y = my0; y <= my1; y++) for (let x = 0; x < W; x++) if (ink(x, y)) { if (x < mx0) mx0 = x; if (x > mx1) mx1 = x; }
  const pad = Math.round((my1 - my0) * 0.06);
  mx0 = Math.max(0, mx0 - pad); mx1 = Math.min(W - 1, mx1 + pad);
  const cy0 = Math.max(0, my0 - pad), cy1 = Math.min(H - 1, my1 + pad);
  const cw = mx1 - mx0 + 1, ch = cy1 - cy0 + 1;

  const mono = img.clone().crop(mx0, cy0, cw, ch);

  const orig = mono.clone();
  orig.scan(0, 0, cw, ch, function (x, y, i) {
    const dd = this.bitmap.data; dd[i + 3] = alphaFor(dd[i], dd[i + 1], dd[i + 2]);
  });

  const light = mono.clone();
  light.scan(0, 0, cw, ch, function (x, y, i) {
    const dd = this.bitmap.data; const r = dd[i], g = dd[i + 1], b = dd[i + 2];
    dd[i + 3] = alphaFor(r, g, b);
    if (!isBlue(r, g, b)) { dd[i] = 238; dd[i + 1] = 242; dd[i + 2] = 246; }
  });

  await orig.clone().resize(Jimp.AUTO, 200).writeAsync(path.join(ASSETS, 'logo-mark.png'));
  await light.clone().resize(Jimp.AUTO, 200).writeAsync(path.join(ASSETS, 'logo-mark-light.png'));

  const sizes = { 'favicon-16.png': 16, 'favicon-32.png': 32, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
  for (const [name, S] of Object.entries(sizes)) {
    const canvas = new Jimp(S, S, NAVY);
    const scale = (S * 0.70) / Math.max(cw, ch);
    const mw = Math.round(cw * scale), mh = Math.round(ch * scale);
    canvas.composite(light.clone().resize(mw, mh), Math.round((S - mw) / 2), Math.round((S - mh) / 2));
    await canvas.writeAsync(path.join(PUB, name));
  }
  console.log('Regenerated logo marks + favicons.');
}).catch(e => { console.error(e); process.exit(1); });
