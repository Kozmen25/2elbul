import { SkeletonCard, SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function MarketLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-2 h-12 w-64 rounded-lg" />
      <SkeletonLine className="mb-8 h-5 w-96 rounded-md" />
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLine key={i} className="h-9 w-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </SkeletonShell>
  );
}
