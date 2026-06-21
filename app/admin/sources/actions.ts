"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type SourceInput = {
  id?: number;
  name: string;
  slug: string;
  baseUrl: string;
  type: string;
};

export type SourceActionResult = {
  ok: boolean;
  message: string;
};

export async function createSource(
  input: SourceInput,
): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();

  const validated = validateSource(input);
  if (!validated.ok) return validated;

  const { error } = await supabase.from("sources").insert({
    name: input.name.trim(),
    slug: normalizeSlug(input.slug),
    base_url: normalizeOptionalUrl(input.baseUrl),
    type: input.type.trim() || "marketplace",
  });

  if (error) {
    console.error("Admin source create failed:", error);
    return { ok: false, message: `Kaynak eklenemedi: ${error.message}` };
  }

  revalidateSources();
  return { ok: true, message: "Kaynak eklendi." };
}

export async function updateSource(
  input: SourceInput,
): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();

  const validated = validateSource(input);
  if (!validated.ok) return validated;
  if (!Number.isInteger(input.id)) {
    return { ok: false, message: "Geçersiz kaynak kimliği." };
  }

  const { error } = await supabase
    .from("sources")
    .update({
      name: input.name.trim(),
      slug: normalizeSlug(input.slug),
      base_url: normalizeOptionalUrl(input.baseUrl),
      type: input.type.trim() || "marketplace",
    })
    .eq("id", input.id!);

  if (error) {
    console.error("Admin source update failed:", error);
    return { ok: false, message: `Kaynak güncellenemedi: ${error.message}` };
  }

  revalidateSources();
  return { ok: true, message: "Kaynak güncellendi." };
}

export async function toggleSource(
  id: number,
  isActive: boolean,
): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();
  if (!Number.isInteger(id)) {
    return { ok: false, message: "Geçersiz kaynak kimliği." };
  }

  const { error } = await supabase
    .from("sources")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("Admin source toggle failed:", error);
    return { ok: false, message: `Durum değiştirilemedi: ${error.message}` };
  }

  revalidateSources();
  return {
    ok: true,
    message: isActive ? "Kaynak aktifleştirildi." : "Kaynak pasifleştirildi.",
  };
}

export async function deleteSource(id: number): Promise<SourceActionResult> {
  await requireAdminUser("/admin/sources");
  const supabase = createSupabaseAdminClient();
  if (!supabase) return missingAdminClient();
  if (!Number.isInteger(id)) {
    return { ok: false, message: "Geçersiz kaynak kimliği." };
  }

  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) {
    console.error("Admin source delete failed:", error);
    return { ok: false, message: `Kaynak silinemedi: ${error.message}` };
  }

  revalidateSources();
  return { ok: true, message: "Kaynak silindi." };
}

function validateSource(input: SourceInput): SourceActionResult {
  const name = input.name.trim();
  const slug = normalizeSlug(input.slug);
  const type = input.type.trim();

  if (!name || !slug || !type) {
    return { ok: false, message: "Ad, slug ve kaynak tipi zorunludur." };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      message: "Slug yalnızca küçük harf, sayı ve tire içerebilir.",
    };
  }
  if (input.baseUrl.trim()) {
    try {
      const url = new URL(input.baseUrl.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return { ok: false, message: "Kaynak linki geçerli bir URL olmalıdır." };
    }
  }
  return { ok: true, message: "" };
}

function normalizeSlug(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function normalizeOptionalUrl(value: string) {
  return value.trim() || null;
}

function missingAdminClient(): SourceActionResult {
  return {
    ok: false,
    message: "Supabase service-role bağlantısı yapılandırılmamış.",
  };
}

function revalidateSources() {
  revalidatePath("/admin/sources");
  revalidatePath("/admin/bot-runs");
}
