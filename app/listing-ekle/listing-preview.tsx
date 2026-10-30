import { ImageIcon, MapPin, Store } from "lucide-react";
import { formatCurrencyTRY } from "@/lib/formatters";
import { parseTlPrice } from "@/lib/listing-submission/price";

export type PreviewData = {
  productName: string;
  title: string;
  price: string;
  condition: string;
  city: string;
  source: string;
  imageUrl: string | null;
};

/** The listing as it will look on the site, updated while the user types. */
export function ListingPreview({ data }: { data: PreviewData }) {
  const price = parseTlPrice(data.price);

  return (
    <article className="overflow-hidden rounded-2xl border border-black/9 bg-white" aria-label="İlan önizlemesi">
      <div className="relative aspect-[4/3] bg-[#f1f1ee]">
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, not a remote asset
          <img src={data.imageUrl} alt="Yüklediğin fotoğraf" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-black/20">
            <ImageIcon size={40} aria-hidden />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white">
          Önizleme
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs font-bold text-[#3B66E0]">{data.productName || "Ürün seçilmedi"}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-12 font-black leading-6">{data.title.trim() || "İlan başlığı"}</h3>
        <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#3B66E0]">
          {price !== null ? formatCurrencyTRY(price) : "—"}
        </p>
        {data.condition && <p className="mt-1 text-xs font-bold text-black/40">{data.condition}</p>}
        <div className="mt-4 grid gap-2 border-t border-black/7 pt-3 text-sm text-black/55">
          <p className="flex items-center gap-2">
            <MapPin size={15} aria-hidden /> {data.city || "Şehir"}
          </p>
          <p className="flex items-center gap-2">
            <Store size={15} aria-hidden /> {data.source || "Kaynak"}
          </p>
        </div>
      </div>
    </article>
  );
}
