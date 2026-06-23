import { AdminNav } from "@/components/admin-nav";
import { requireAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdminUser();

  return (
    <div className="admin-shell min-h-screen bg-[#f5f5f2] lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <AdminNav email={user.email ?? "Admin"} />
      <div className="min-w-0 overflow-x-hidden">
        <div className="mx-auto w-full max-w-full p-4 sm:p-6 lg:max-w-[calc(100vw-260px)] lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
