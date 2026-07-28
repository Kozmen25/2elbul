import { SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function NotifLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-2 h-12 w-48 rounded-lg" />
      <SkeletonLine className="mb-8 h-5 w-64 rounded-md" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 rounded-2xl border border-black/8 bg-white px-5 py-4"
          >
            <SkeletonLine className="mt-0.5 size-6 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="mb-2 h-4 w-3/4 rounded-md" />
              <SkeletonLine className="mb-1 h-3 w-full rounded-md" />
              <SkeletonLine className="h-3 w-1/4 rounded-md" />
            </div>
            <SkeletonLine className="h-7 w-20 shrink-0 rounded-xl" />
          </div>
        ))}
      </div>
    </SkeletonShell>
  );
}
