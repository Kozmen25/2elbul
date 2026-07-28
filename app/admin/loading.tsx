import { SkeletonAdminShell } from "@/components/skeleton";

export default function AdminLoading() {
  return (
    <section className="min-h-[calc(100vh-145px)] p-4 sm:p-6 xl:p-8">
      <SkeletonAdminShell>
        <div className="h-64 animate-pulse rounded-2xl bg-black/6" />
      </SkeletonAdminShell>
    </section>
  );
}
