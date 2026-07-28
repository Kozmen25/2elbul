import { mobileSuccess, mobileError } from "@/lib/mobile/response";
import { getAuthenticatedClient } from "@/lib/mobile/auth";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthenticatedClient();
  if (auth.error) return auth.error;

  const { id } = await params;

  // Verify the favorite belongs to the user
  const { data: existing, error: findError } = await auth.supabase
    .from("favorites")
    .select("id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (findError) {
    console.error("Mobile favorite lookup failed:", findError);
    return mobileError("Favori silinirken bir sorun oluştu.", 500);
  }

  if (!existing) {
    return mobileError("Favori bulunamadı.", 404);
  }

  const { error: deleteError } = await auth.supabase
    .from("favorites")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (deleteError) {
    console.error("Mobile favorite delete failed:", deleteError);
    return mobileError("Favori silinirken bir sorun oluştu.", 500);
  }

  return mobileSuccess({ deleted: true });
}
