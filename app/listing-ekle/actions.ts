"use server";

import { randomUUID } from "node:crypto";
import { detectImageType, IMAGE_EXTENSIONS } from "@/lib/image-signature";
import {
  MAX_SUBMISSIONS_PER_DAY,
  validateListingSubmission,
  type ListingFieldErrors,
  type ListingSubmissionInput,
} from "@/lib/listing-submission/validation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type SubmitListingResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: ListingFieldErrors };

const IMAGE_BUCKET = "listing-images";
/** The wizard shrinks photos before upload; anything larger than this is refused. */
const MAX_IMAGE_BYTES = 1_500_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const fail = (message: string, fieldErrors?: ListingFieldErrors): SubmitListingResult => ({
  ok: false,
  message,
  ...(fieldErrors ? { fieldErrors } : {}),
});

function readInput(formData: FormData): ListingSubmissionInput {
  const text = (name: string) => String(formData.get(name) ?? "");
  return {
    productId: text("product_id"),
    title: text("title"),
    price: text("price"),
    city: text("city"),
    source: text("source"),
    condition: text("condition"),
    url: text("url"),
  };
}

export async function submitListing(formData: FormData): Promise<SubmitListingResult> {
  const validation = validateListingSubmission(readInput(formData));
  if (!validation.ok) return fail("Formdaki eksikleri düzeltin.", validation.errors);
  const listing = validation.value;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("Supabase bağlantısı yapılandırılmamış.");

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return fail("İlan eklemek için giriş yapmalısınız.");

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", listing.productId)
    .maybeSingle();
  if (productError) {
    console.error("Supabase product lookup failed:", productError);
    return fail("Ürün doğrulanamadı. Lütfen tekrar deneyin.");
  }
  if (!product) return fail("Seçilen ürün bulunamadı.", { productId: "Ürünü listeden yeniden seçin." });

  // Same link sent before (by anyone, in any status)? Looked up with the
  // service role because row-level security hides other users' pending rows.
  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data: existing } = await admin.from("listings").select("id").eq("url", listing.url).limit(1);
    if ((existing ?? []).length > 0) {
      return fail("Bu ilan zaten sistemde var.", { url: "Bu bağlantı daha önce gönderilmiş." });
    }
  }

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count: recentCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gte("created_at", since);
  if ((recentCount ?? 0) >= MAX_SUBMISSIONS_PER_DAY) {
    return fail(`24 saat içinde en fazla ${MAX_SUBMISSIONS_PER_DAY} ilan gönderebilirsin. Onaylananlardan sonra tekrar deneyebilirsin.`);
  }

  const upload = await uploadImage(supabase, user.id, formData.get("image"));
  if (!upload.ok) return fail(upload.message);

  // Always pending and tied to the submitter: row-level security only accepts
  // inserts of this shape, and "İlanlarım" lists listings by user_id.
  const { error: insertError } = await supabase.from("listings").insert({
    product_id: listing.productId,
    title: listing.title,
    price: listing.price,
    city: listing.city,
    source: listing.source,
    url: listing.url,
    condition: listing.condition,
    image_url: upload.url,
    status: "pending",
    user_id: user.id,
  });

  if (insertError) {
    console.error("Supabase listing insert failed:", insertError);
    if (upload.path) await supabase.storage.from(IMAGE_BUCKET).remove([upload.path]);
    return fail("İlan kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.");
  }

  return {
    ok: true,
    message: "İlanın alındı. Onaylandıktan sonra yayınlanacak; durumunu Hesabım sayfasında görebilirsin.",
  };
}

type UploadResult = { ok: true; url: string | null; path: string | null } | { ok: false; message: string };

async function uploadImage(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  file: FormDataEntryValue | null,
): Promise<UploadResult> {
  if (!(file instanceof File) || file.size === 0) return { ok: true, url: null, path: null };

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return { ok: false, message: "Fotoğraf PNG, JPEG ya da WebP olmalı." };

  const path = `${userId}/${randomUUID()}.${IMAGE_EXTENSIONS[type]}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (error) {
    console.error("Listing image upload failed:", error);
    return { ok: false, message: "Fotoğraf yüklenemedi. Lütfen tekrar deneyin." };
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}
