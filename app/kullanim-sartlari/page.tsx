export default function TermsPage() {
  return (
    <section className="container-shell min-h-[60vh] py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          Kullanım Şartları
        </h1>
        <div className="mt-6 grid gap-4 text-base leading-7 text-black/60">
          <p>
            2ElBul, farklı kaynaklardaki örnek ilanları karşılaştırmak amacıyla
            hazırlanmış bir fiyat rehberidir.
          </p>
          <p>
            Fiyat değerlendirmeleri bilgilendirme amaçlıdır. Alım veya satım
            kararı vermeden önce ilan detaylarını ve satıcı bilgilerini kontrol
            etmek kullanıcının sorumluluğundadır.
          </p>
        </div>
      </div>
    </section>
  );
}
