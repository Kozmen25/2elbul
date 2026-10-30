import { NextRequest, NextResponse } from "next/server";
import { hasValidSecret } from "@/lib/auth/cron-auth";
import { runListingAvailabilityCheck } from "@/lib/listing-availability/run";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Opens the source pages of the listings checked longest ago and takes the
 * ones that are confirmed sold or removed off the site (see
 * lib/listing-availability). Runs before the alert and follow checks so those
 * never point users to a dead listing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET tanımlı değil." }, { status: 500 });
  }
  if (!hasValidSecret(request, secret)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz cron isteği." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase service-role bağlantısı yok." }, { status: 500 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await runListingAvailabilityCheck(supabase)) });
  } catch (error) {
    console.error("Listing availability cron failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 },
    );
  }
}
