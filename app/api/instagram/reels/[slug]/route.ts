import { NextRequest, NextResponse } from "next/server";
import {
  buildInstagramReelDraftForSlug,
  renderInstagramReelVideoBuffer,
} from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: { slug: string } | Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await Promise.resolve(context.params);
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();

  if (!normalizedSlug || !/^[a-z0-9-]+$/.test(normalizedSlug)) {
    return NextResponse.json(
      { ok: false, error: "Gecersiz urun slug'i." },
      { status: 400 },
    );
  }

  const draft = await buildInstagramReelDraftForSlug(normalizedSlug);
  if (!draft) {
    return NextResponse.json(
      { ok: false, error: "Bu ürün için reel verisi oluşturulamadı." },
      { status: 404 },
    );
  }

  const videoBuffer = await renderInstagramReelVideoBuffer(draft);

  return new Response(videoBuffer, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBuffer.length),
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
