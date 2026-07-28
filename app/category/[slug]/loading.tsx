import { SkeletonCard, SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function CategoryLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-2 h-10 w-48 rounded-lg" />
      <SkeletonLine className="mb-8 h-5 w-64 rounded-md" />
      <SkeletonLine className="mb-6 h-4 w-96 rounded-md" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </SkeletonShell>
  );
}
