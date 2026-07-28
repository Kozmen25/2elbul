import { SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function CompareLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-2 h-12 w-48 rounded-lg" />
      <SkeletonLine className="mb-8 h-5 w-72 rounded-md" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/9 bg-white p-5">
            <SkeletonLine className="mb-4 aspect-[4/3] w-full rounded-xl" />
            <SkeletonLine className="mb-3 h-6 w-3/4 rounded-md" />
            <SkeletonLine className="mb-2 h-4 w-1/3 rounded-md" />
            <SkeletonLine className="mb-4 h-8 w-1/2 rounded-lg" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <SkeletonLine key={j} className="h-4 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonShell>
  );
}
