import { SkeletonCard, SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function SearchLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-8 h-10 w-64 rounded-lg" />
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonLine key={i} className="h-9 w-20 rounded-xl" />
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
