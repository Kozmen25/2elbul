import {
  AlertTriangle,
  Boxes,
  Database,
  FileSearch,
  PackageSearch,
  ShieldCheck,
} from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminStatCard } from "@/components/admin-ui";
import {
  getPublicDemoListingReasons,
  getPublicDemoProductReasons,
} from "@/lib/public-data-cleanup";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string | number;
  name: string | null;
  slug?: string | null;
  created_at?: string | null;
};

type ListingRow = {
  id: string | number;
  product_id: string | number | null;
  title: string | null;
  price: string | number | null;
  source: string | null;
  url: string | null;
  created_at: string | null;
};

type Candidate = {
  id: string;
  type: string;
  title: string;
  source: string;
  price: number | null;
  createdAt: string | null;
  reasons: string[];
};

const formatPrice = (price: number | null) =>
  price === null
    ? "—"
    : new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
      }).format(price);

const formatDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(date))
    : "—";

export default async function AdminDataCleanupPage() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return (
      <>
        <AdminPageHeader
          eyebrow="Yayın öncesi"
          title="Veri Temizliği"
          description="Demo ve test kayıtlarını güvenli dry-run modunda tespit edin."
        />
        <AdminEmpty>
          Supabase service role bağlantısı yapılandırılmadığı için veri taraması yapılamıyor.
        </AdminEmpty>
      </>
    );
  }

  const [productsResult, listingsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("listings")
      .select("id, product_id, title, price, source, url, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const products = (productsResult.data ?? []) as ProductRow[];
  const listings = (listingsResult.data ?? []) as ListingRow[];
  const productNames = new Map(
    products.map((product) => [String(product.id), product.name ?? ""]),
  );

  const productCandidates: Candidate[] = products
    .flatMap((product) => {
      const reasons = getPublicDemoProductReasons(product.name);
      if (!reasons.length) return [];
      return [{
        id: String(product.id),
        type: "Ürün" as const,
        title: product.name ?? "Adsız ürün",
        source: "products",
        price: null,
        createdAt: product.created_at ?? null,
        reasons,
      }];
    })
    ;

  const listingCandidates: Candidate[] = listings
    .flatMap((listing) => {
      const reasons = getPublicDemoListingReasons({
        title: listing.title,
        productName: listing.product_id
          ? productNames.get(String(listing.product_id))
          : "",
        source: listing.source,
        url: listing.url,
      });
      if (!reasons.length) return [];
      const price = Number(listing.price);
      return [{
        id: String(listing.id),
        type: "İlan" as const,
        title: listing.title ?? "Adsız ilan",
        source: listing.source ?? "Bilinmiyor",
        price: Number.isFinite(price) ? price : null,
        createdAt: listing.created_at ?? null,
        reasons,
      }];
    })
    ;

  const candidates = [...productCandidates, ...listingCandidates].sort(
    (a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type, "tr-TR");
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    },
  );
  const suspiciousSourceCount = listingCandidates.filter((candidate) =>
    candidate.reasons.some((reason) => reason.includes("Şüpheli kaynak")),
  ).length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Yayın öncesi"
        title="Veri Temizliği"
        description="Public yüzeyden filtrelenen demo/test kayıtları burada dry-run olarak listelenir. Bu sayfa veri silmez."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Demo/test ürün"
          value={productCandidates.length}
          icon={Boxes}
        />
        <AdminStatCard
          label="Demo/test ilan"
          value={listingCandidates.length}
          icon={PackageSearch}
        />
        <AdminStatCard
          label="Şüpheli kaynak"
          value={suspiciousSourceCount}
          icon={AlertTriangle}
        />
        <AdminStatCard
          label="Toplam aday"
          value={candidates.length}
          icon={Database}
        />
      </div>

      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-800">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} />
          <div>
            <p className="font-black">Dry-run modu aktif</p>
            <p className="mt-1">
              Bu sürüm yalnızca aday kayıtları listeler. Yanlışlıkla gerçek veri
              silinmemesi için toplu silme veya tekil silme işlemi eklenmedi.
            </p>
          </div>
        </div>
      </div>

      {productsResult.error || listingsResult.error ? (
        <AdminEmpty>
          Veri temizliği sorgusunda hata oluştu. Ürün hatası:{" "}
          {productsResult.error?.message ?? "yok"} / İlan hatası:{" "}
          {listingsResult.error?.message ?? "yok"}
        </AdminEmpty>
      ) : candidates.length === 0 ? (
        <AdminEmpty>
          Public filtrelere takılan demo/test kayıt bulunmadı. Veri yüzeyi temiz görünüyor.
        </AdminEmpty>
      ) : (
        <section className="min-w-0 rounded-2xl border border-black/8 bg-white shadow-[0_12px_35px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 border-b border-black/8 p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-[#fff1e7] text-[#ff6b00]">
              <FileSearch size={20} />
            </span>
            <div>
              <h2 className="font-black">Silinmeye aday kayıtlar</h2>
              <p className="text-sm text-black/45">
                Aşağıdaki kayıtlar public filtre mantığına takıldı.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-[#fafaf8] text-xs font-black uppercase tracking-[0.08em] text-black/45">
                <tr>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Başlık / Ad</th>
                  <th className="px-4 py-3">Kaynak</th>
                  <th className="px-4 py-3">Fiyat</th>
                  <th className="px-4 py-3">Oluşturulma</th>
                  <th className="px-4 py-3">Sebep</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/7">
                {candidates.map((candidate) => (
                  <tr key={`${candidate.type}-${candidate.id}`}>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-xs font-black text-[#d95700]">
                        {candidate.type}
                      </span>
                    </td>
                    <td className="max-w-[280px] break-words px-4 py-4 font-bold">
                      {candidate.title}
                      <p className="mt-1 text-xs font-normal text-black/35">
                        ID: {candidate.id}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-black/55">{candidate.source}</td>
                    <td className="px-4 py-4 font-black">
                      {formatPrice(candidate.price)}
                    </td>
                    <td className="px-4 py-4 text-black/55">
                      {formatDate(candidate.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {candidate.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
