import { ShieldCheck, Search, BarChart3, Bell, GitCompareArrows } from "lucide-react";

const tips = [
  {
    icon: BarChart3,
    title: "Fiyat geçmişini inceleyin",
    description:
      "2ElBul, her ürün için fiyat geçmişi sunar. Bir ilanın güncel fiyatının geçmiş ortalamalarla uyumlu olup olmadığını kontrol edin. Piyasa ortalamasının çok altındaki ilanlar riskli olabilir.",
  },
  {
    icon: Search,
    title: "Fiyat karşılaştırması yapın",
    description:
      "Aynı ürünü farklı kaynaklardaki ilanlarla karşılaştırın. 2ElBul, Sahibinden, GetMobil, EasyCep ve diğer platformlardaki ilanları tek ekranda gösterir, böylece en iyi fırsatı kaçırmazsınız.",
  },
  {
    icon: Bell,
    title: "Fiyat düşünce haberdar olun",
    description:
      "İlgilendiğiniz ürün için fiyat alarmı kurun. Hedef fiyatınıza düşünce anında bildirim alın. Sahibinden'den farklı olarak, 2ElBul'da tüm bu özellikler ücretsizdir.",
  },
  {
    icon: GitCompareArrows,
    title: "Ürün eşleştirme ile güvenilir kaynaklar",
    description:
      "2ElBul, aynı ürünü farklı platformlardaki ilanlarla akıllıca eşleştirir. Böylece bir ürün hakkında ne kadar çok veri varsa kararınız o kadar güvenilir olur.",
  },
];

export function SafeShoppingBanner() {
  return (
    <section className="rounded-3xl border border-emerald-600/15 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.04)] sm:p-8">
      <div className="flex items-end gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <ShieldCheck size={21} />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Güvenli alışveriş
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">
            Güvenli Alışveriş İpuçları
          </h2>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-black/55">
        2ElBul, ikinci el alışverişinizi daha güvenli ve şeffaf hale getirmek
        için tasarlandı. Sahibinden&apos;de karşılaştığınız dolandırıcılık, gizli
        ücretler ve yanıltıcı ilan sorunlarına karşı sizi koruyacak
        özelliklerimiz:
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {tips.map((tip) => (
          <div
            key={tip.title}
            className="rounded-2xl border border-emerald-600/10 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                <tip.icon size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black">{tip.title}</h3>
                <p className="mt-1 text-xs leading-5 text-black/50">
                  {tip.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-emerald-600/15 bg-emerald-50/50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.07em] text-emerald-700">
          Neden 2ElBul?
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          <li className="flex items-center gap-2 text-sm text-black/60">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            İlan vermek tamamen ücretsiz
          </li>
          <li className="flex items-center gap-2 text-sm text-black/60">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Şeffaf fiyat geçmişi ve karşılaştırma
          </li>
          <li className="flex items-center gap-2 text-sm text-black/60">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Kaydedilmiş arama ve anlık bildirim
          </li>
          <li className="flex items-center gap-2 text-sm text-black/60">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Çapraz platform ürün eşleştirme
          </li>
        </ul>
      </div>
    </section>
  );
}
