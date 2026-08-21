// Slice the reference sheet ("2 ELBUL ORIGINAL AICONS", 1024x1024, 4x4 grid)
// into 16 individual avatar blacks. Writes 260x260 black-on-transparent crops
// and a 4x4 contact sheet for visual verification.
import sharp from "sharp";

const SRC = "C:/Users/LÜFER/Downloads/Adsız tasarım (1).png";
const BASE = "C:/Users/LÜFER/Downloads/RestoreLens/RestoreLens/2elbul";
const OUT = `${BASE}/_work/aiicons`;

// 4x4 grid. Each cell is 1024/4 = 256px. The gutter scan showed the grid is
// not perfectly flush (a <4px white frame around each cell), so bleed each
// crop 3px into the neighbor and rely on the gutter's recorded color to cover
// seams. Verified by the probe: corners ≈ [0,0,0], gutter ≈ [231,231,231].
const CELL = 256;
const BLEED = 3;
const TAPER = 2; // shrink toward center to remove any residual neighbor artifact

const meta = await sharp(SRC).metadata();
if (meta.width !== 1024 || meta.height !== 1024) {
  throw new Error(`expected 1024x1024, got ${meta.width}x${meta.height}`);
}

for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 4; c++) {
    const left = c * CELL + BLEED + TAPER;
    const top = r * CELL + BLEED + TAPER;
    const size = CELL - BLEED * 2 - TAPER * 2;
    const id = `ai${r}${c}`;
    await sharp(SRC)
      .extract({ left, top, width: size, height: size })
      .resize(260, 260, { fit: "cover" })
      .toFile(`${OUT}/${id}.png`);
  }
}

// contact sheet, 4x4, white gutters, labeled
const colovers = [];
const W = 272, H = 272, GAP = 8, LABEL = 22;
const pad = 4;
const cellW = W - pad * 2, cellH = H - pad * 2;
const sheetW = cellW * 4 + GAP * 3;
const sheetH = cellH * 4 + GAP * 3 + LABEL;

const layers = [];
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 4; c++) {
    const id = `ai${r}${c}`;
    layers.push({
      input: `${OUT}/${id}.png`,
      left: pad + c * (cellW + GAP),
      top: pad + r * (cellH + GAP),
    });
  }
}
await sharp({
  create: { width: sheetW, height: sheetH, channels: 3, background: { r: 255, g: 255, b: 255 } },
})
  .composite(layers)
  .png()
  .toFile(`${OUT}/contact.png`);
console.log("wrote 16 crops + contact.png");
