export default function ContactPage() {
  return (
    <section className="container-shell min-h-[60vh] py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          İletişim
        </h1>
        <div className="mt-6 rounded-2xl border border-black/8 bg-[#fafaf8] p-5 text-base leading-7 text-black/60 sm:p-7">
          <p>
            Görüş, öneri ve iş birliği talepleri için:
          </p>
          <a
            href="mailto:iletisim@2elbul.com"
            className="mt-2 inline-block font-bold text-[#ff6b00] hover:underline"
          >
            iletisim@2elbul.com
          </a>
        </div>
      </div>
    </section>
  );
}
