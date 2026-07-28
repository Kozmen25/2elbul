export function SkeletonCard() {
  return (
    <article className="flex flex-col rounded-2xl border border-black/9 bg-white p-5">
      <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-black/6" />
      <div className="mt-4 mb-2 h-4 w-1/3 animate-pulse rounded-md bg-black/6" />
      <div className="h-5 w-2/3 animate-pulse rounded-md bg-black/6" />
      <div className="mt-4 h-8 w-1/2 animate-pulse rounded-lg bg-black/6" />
      <div className="mt-5 grid gap-2.5">
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-black/6" />
        <div className="h-4 w-1/4 animate-pulse rounded-md bg-black/6" />
        <div className="h-4 w-1/2 animate-pulse rounded-md bg-black/6" />
      </div>
      <div className="mt-5 h-11 w-full animate-pulse rounded-xl bg-black/6" />
    </article>
  );
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-black/6 ${className}`}
    />
  );
}

export function SkeletonShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8] py-10 sm:py-14">
      <div className="container-shell">{children}</div>
    </section>
  );
}

export function SkeletonAdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-black/6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/6" />
        ))}
      </div>
      {children}
    </div>
  );
}
