import { SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function ProductLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-8 h-4 w-64 rounded-md" />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SkeletonLine className="mb-4 aspect-[16/9] w-full rounded-2xl" />
          <SkeletonLine className="mb-3 h-8 w-3/4 rounded-lg" />
          <SkeletonLine className="mb-6 h-5 w-1/3 rounded-md" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonLine key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <SkeletonLine className="mb-4 h-48 w-full rounded-2xl" />
          <SkeletonLine className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </SkeletonShell>
  );
}
