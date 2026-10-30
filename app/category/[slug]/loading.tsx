import { SkeletonLine, SkeletonShell } from "@/components/skeleton";

export default function CategoryLoading() {
  return (
    <SkeletonShell>
      <SkeletonLine className="mb-6 h-4 w-64" />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <SkeletonLine className="hidden h-96 lg:block" />
        <div className="grid gap-5">
          <SkeletonLine className="h-72 w-full" />
          <SkeletonLine className="h-48 w-full" />
        </div>
      </div>
    </SkeletonShell>
  );
}
