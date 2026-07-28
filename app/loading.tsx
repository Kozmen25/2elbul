import { SkeletonCard, SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function HomeLoading() {
  return (
    <section className="min-h-[calc(100vh-145px)] bg-[#fafaf8]">
      <div className="bg-gradient-to-b from-[#fff8f0] to-[#fafaf8] py-16 sm:py-24">
        <div className="container-shell">
          <div className="mx-auto max-w-2xl text-center">
            <SkeletonLine className="mx-auto mb-6 h-12 w-3/4 rounded-lg" />
            <SkeletonLine className="mx-auto mb-8 h-5 w-2/3 rounded-md" />
            <SkeletonLine className="mx-auto h-14 w-full max-w-xl rounded-xl" />
          </div>
        </div>
      </div>
      <div className="container-shell py-10">
        <SkeletonLine className="mb-6 h-7 w-48 rounded-md" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
