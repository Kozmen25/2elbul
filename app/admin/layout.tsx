import { AdminNav } from "@/components/admin-nav";
import { requireAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdminUser();

  return (
    <div className="admin-shell min-h-screen bg-[#f5f5f2] lg:flex">
      <AdminNav email={user.email ?? "Admin"} />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="w-full max-w-full min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
