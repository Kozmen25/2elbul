import { redirect } from "next/navigation";

type LegacySearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

export default async function LegacySearchPage({
  searchParams,
}: LegacySearchPageProps) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  redirect(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
}
