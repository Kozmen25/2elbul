import { NextResponse } from "next/server";
import { importListings } from "@/lib/import/import-listings";
import type {
  ImportSource,
  RawImportListing,
} from "@/lib/import/types";

const supportedSources = new Set<ImportSource>([
  "Sahibinden",
  "Letgo",
  "Facebook Marketplace",
  "EasyCep",
  "Getmobil",
  "Yenilenmiş Market",
  "Teknosa Yenilenmiş",
  "Hepsiburada Yenilenmiş",
  "MediaMarkt Yenilenmiş",
]);

export async function POST(request: Request) {
  const configuredApiKey = process.env.IMPORT_API_KEY?.trim();
  const authorization = request.headers.get("authorization");

  if (
    !configuredApiKey ||
    authorization !== `Bearer ${configuredApiKey}`
  ) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Geçerli bir JSON gövdesi gönderin." },
      { status: 400 },
    );
  }

  if (!isImportPayload(body)) {
    return NextResponse.json(
      {
        error:
          "source ve en fazla 100 kayıttan oluşan records dizisi gereklidir.",
      },
      { status: 400 },
    );
  }

  if (!supportedSources.has(body.source)) {
    return NextResponse.json(
      { error: "Desteklenmeyen kaynak." },
      { status: 400 },
    );
  }

  try {
    const result = await importListings(body.source, body.records);
    return NextResponse.json(result, {
      status: result.failed > 0 ? 207 : 200,
    });
  } catch (error) {
    console.error("Listing import failed:", error);
    return NextResponse.json(
      { error: "Aktarım başlatılamadı." },
      { status: 500 },
    );
  }
}

function isImportPayload(
  value: unknown,
): value is { source: ImportSource; records: RawImportListing[] } {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;

  return (
    typeof payload.source === "string" &&
    Array.isArray(payload.records) &&
    payload.records.length > 0 &&
    payload.records.length <= 100 &&
    payload.records.every(
      (record) => Boolean(record) && typeof record === "object",
    )
  );
}
