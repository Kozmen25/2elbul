import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AddListingWizard } from "./add-listing-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İlan ekle | 2ElBul",
  robots: { index: false, follow: false },
};

export default async function AddListingPage() {
  // Listings belong to their submitter, so adding one requires an account.
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!data.user) redirect("/giris?next=/listing-ekle");

  return <AddListingWizard />;
}
