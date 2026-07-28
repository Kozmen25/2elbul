import { SkeletonCard, SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function AccountLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-8 h-10 w-48 rounded-lg" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/9 bg-white p-5">
            <SkeletonLine className="mb-4 h-6 w-1/2 rounded-md" />
            {Array.from({ length: 3 }).map((_, j) => (
              <SkeletonLine key={j} className="mb-3 h-16 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </SkeletonShell>
  );
}
