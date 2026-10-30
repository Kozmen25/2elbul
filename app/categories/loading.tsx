import { SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function CategoriesLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-3 h-10 w-56" />
      <SkeletonLine className="mb-6 h-5 w-96 max-w-full" />
      <SkeletonLine className="mb-6 h-16 w-full" />
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SkeletonLine className="hidden h-96 lg:block" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLine key={i} className="h-52" />
          ))}
        </div>
      </div>
    </SkeletonShell>
  );
}
