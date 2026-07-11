import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { formatCurrencyTRY } from "@/lib/formatters";
import { formatOpportunityLevel } from "@/lib/opportunity-engine/helpers";
import { escapeSvgText, splitSvgTextLines } from "./helpers";
import type { InstagramReelDraft } from "./types";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

export async function renderInstagramReelVideoBuffer(draft: InstagramReelDraft) {
  const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "2elbul-ig-"));
  const coverPath = path.join(workingDir, "cover.png");
  const videoPath = path.join(workingDir, "reel.mp4");

  try {
    const coverBuffer = await renderInstagramReelCoverBuffer(draft);
    await fs.writeFile(coverPath, coverBuffer);
    await runFfmpeg([
      "-y",
      "-loop",
      "1",
      "-i",
      coverPath,
      "-t",
      "6",
      "-r",
      "30",
      "-vf",
      "scale=1080:1920,format=yuv420p",
      "-c:v",
      "libx264",
      "-movflags",
      "+faststart",
      videoPath,
    ]);

    return await fs.readFile(videoPath);
  } finally {
    await fs.rm(workingDir, { recursive: true, force: true });
  }
}

export async function renderInstagramReelCoverBuffer(draft: InstagramReelDraft) {
  const baseImage = await loadBaseImageBuffer(draft.coverImageUrl);
  const overlay = Buffer.from(buildInstagramReelOverlaySvg(draft));

  return sharp(baseImage)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "cover", position: "centre" })
    .modulate({ brightness: 0.78, saturation: 1.05 })
    .composite([{ input: overlay }])
    .png()
    .toBuffer();
}

async function loadBaseImageBuffer(imageUrl: string | null) {
  if (!imageUrl) {
    return createBlankCanvas();
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        accept: "image/*",
      },
    });

    if (!response.ok) return createBlankCanvas();
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return createBlankCanvas();
    return Buffer.from(arrayBuffer);
  } catch {
    return createBlankCanvas();
  }
}

async function createBlankCanvas() {
  return sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: {
        r: 9,
        g: 12,
        b: 18,
        alpha: 1,
      },
    },
  })
    .png()
    .toBuffer();
}

function buildInstagramReelOverlaySvg(draft: InstagramReelDraft) {
  const productLines = splitSvgTextLines(draft.productName, 23);
  const reasons = draft.reasons.slice(0, 2);
  const warnings = draft.warningSignals.slice(0, 1);
  const priceLine =
    draft.averagePrice != null && draft.minPrice != null
      ? `Ort. ${formatCurrencyTRY(draft.averagePrice)} • Dusuk ${formatCurrencyTRY(draft.minPrice)}`
      : "Yetersiz fiyat verisi";

  const infoLines = [
    `${draft.recommendationLabel} • ${formatOpportunityLevel(draft.opportunityLevel)}`,
    `Skor ${draft.opportunityScore}/100 • Risk ${formatOpportunityLevel(draft.riskLevel)}`,
    priceLine,
    `Analiz ${draft.sampleSize} ilan • ${draft.sourceCount} kaynak`,
    `Confidence ${formatOpportunityLevel(draft.confidenceLevel)}`,
    reasons[0] ? `Neden: ${reasons[0]}` : null,
    warnings[0] ? `Uyari: ${warnings[0]}` : null,
    `Guncelleme: ${draft.analysisGeneratedAt}`,
  ].filter((line): line is string => Boolean(line));

  const productText = productLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : 74;
      return `<tspan x="74" dy="${dy}">${escapeSvgText(line)}</tspan>`;
    })
    .join("");

  const infoText = infoLines
    .map((line, index) => {
      const y = 1320 + index * 66;
      return `
        <rect x="64" y="${y - 38}" width="952" height="50" rx="18" fill="rgba(255,255,255,0.08)" />
        <text x="88" y="${y - 4}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700">${escapeSvgText(
          line,
        )}</text>
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">
      <defs>
        <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#05070b" stop-opacity="0.58" />
          <stop offset="45%" stop-color="#05070b" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#05070b" stop-opacity="0.82" />
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff7a18" />
          <stop offset="100%" stop-color="#ffb347" />
        </linearGradient>
      </defs>
      <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#topShade)" />
      <rect x="64" y="68" width="260" height="54" rx="27" fill="url(#accent)" />
      <text x="94" y="103" fill="#0b0d12" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900" letter-spacing="0.5">GUNUN FIRSATI</text>
      <circle cx="920" cy="118" r="84" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
      <text x="920" y="112" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900">${draft.opportunityScore}</text>
      <text x="920" y="146" text-anchor="middle" fill="rgba(255,255,255,0.74)" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">Opportunity</text>
      <text x="74" y="248" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="900">
        ${productText}
      </text>
      <rect x="64" y="1110" width="952" height="92" rx="26" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
      <text x="92" y="1168" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800">${escapeSvgText(
        draft.recommendationDescription,
      )}</text>
      ${infoText}
      <text x="64" y="1844" fill="rgba(255,255,255,0.8)" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700">2ElBul.com</text>
    </svg>
  `;
}

async function runFfmpeg(args: string[]) {
  const binaryPath = ffmpegPath;
  if (!binaryPath) {
    throw new Error("ffmpeg-static binary bulunamadi.");
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: Error) => {
      reject(error);
    });

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `ffmpeg cikis kodu ${code ?? "unknown"} ile basarisiz oldu. ${stderr.slice(-2000)}`,
        ),
      );
    });
  });
}
