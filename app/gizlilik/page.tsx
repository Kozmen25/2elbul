export default function PrivacyPage() {
  return (
    <InfoPage title="Gizlilik">
      <p>
        2ElBul&apos;un bu MVP sürümü kullanıcı hesabı oluşturmaz. İlan gönderme
        formundaki ürün, fiyat, konum, kaynak ve bağlantı bilgileri onay süreci
        için Supabase veritabanında saklanır.
      </p>
      <p>
        Gönderilen ilanlar onaylanana kadar herkese açık arama sonuçlarında
        gösterilmez. İletişim talepleri için iletişim sayfasını kullanabilirsiniz.
      </p>
    </InfoPage>
  );
}

function InfoPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="container-shell min-h-[60vh] py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          {title}
        </h1>
        <div className="mt-6 grid gap-4 text-base leading-7 text-black/60">
          {children}
        </div>
      </div>
    </section>
  );
}
