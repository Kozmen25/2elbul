// 2ElBul preset avatar generator.
// Preset URLs stay stable; assets now embed the extracted AICONS crops.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SET = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u"];
const ART = {
  a: "ai00",
  b: "ai01",
  c: "ai02",
  d: "ai03",
  e: "ai10",
  f: "ai11",
  g: "ai12",
  h: "ai13",
  i: "ai20",
  j: "ai21",
  k: "ai22",
  l: "ai23",
  m: "ai30",
  n: "ai31",
  o: "ai32",
  p: "ai33",
  r: "ai00",
  s: "ai01",
  t: "ai22",
  u: "ai33",
};

// Turkish character labels — proper orthography, characterful, non-generic.
const LABELS = {
  a: "Şimşek", b: "Kuzey", c: "Atlas", d: "Melis", e: "Vadi", f: "Aliya",
  g: "Serdar", h: "Deniz", i: "Zümra", j: "Emre", k: "Mert", l: "Bora",
  m: "Ayşe", n: "Vega", o: "Cem", p: "Zeynep", r: "İpek", s: "Kerem",
  t: "Defne", u: "Rüzgar",
};

const ROOT = "C:/Users/LÜFER/Downloads/RestoreLens/RestoreLens/2elbul";
const OUT = `${ROOT}/public/avatars`;
const SRC = `${ROOT}/_work/aiicons`;
const SIZE = 256;
const FRAME = 18;
const RADIUS = 40;

mkdirSync(OUT, { recursive: true });

function svgEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function imageDataUri(id) {
  const file = `${SRC}/${id}.png`;
  const base64 = readFileSync(file).toString("base64");
  return `data:image/png;base64,${base64}`;
}

for (const id of SET) {
  const artId = ART[id];
  const href = imageDataUri(artId);
  const label = svgEscape(LABELS[id]);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="${label} — 2ElBul avatar">
  <defs>
    <clipPath id="clip-${id}">
      <rect x="${FRAME}" y="${FRAME}" width="${SIZE - FRAME * 2}" height="${SIZE - FRAME * 2}" rx="${RADIUS}"/>
    </clipPath>
  </defs>
  <rect x="${FRAME}" y="${FRAME}" width="${SIZE - FRAME * 2}" height="${SIZE - FRAME * 2}" rx="${RADIUS}" fill="#f7f2ea"/>
  <g clip-path="url(#clip-${id})">
    <image href="${href}" x="${FRAME}" y="${FRAME}" width="${SIZE - FRAME * 2}" height="${SIZE - FRAME * 2}" preserveAspectRatio="xMidYMid slice"/>
  </g>
</svg>`;
  writeFileSync(`${OUT}/preset-${id}.svg`, svg + "\n");
}

console.log(`wrote ${SET.length} preset SVGs`);
