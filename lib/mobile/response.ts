import { NextResponse } from "next/server";
import type { MobileApiResponse } from "@/lib/mobile/types";

export const dynamic = "force-dynamic";

export function mobileSuccess<T>(data: T, status = 200): NextResponse<MobileApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function mobileError(error: string, status = 400): NextResponse<MobileApiResponse<never>> {
  return NextResponse.json({ ok: false, error }, { status });
}
