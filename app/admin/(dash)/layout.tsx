import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SetupNotice } from "@/components/SetupNotice";
import { isAdmin } from "@/lib/auth";
import { isConfigured } from "@/lib/sheets/store";

export const dynamic = "force-dynamic";

/**
 * The auth gate for every dashboard PAGE. /admin/login sits outside this route
 * group, which is what stops the redirect looping.
 *
 * Route handlers are NOT covered by a layout — every admin API route calls
 * isAdmin() itself.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  if (!isConfigured()) return <SetupNotice />;

  return (
    <div className="flex min-h-full flex-col bg-bg lg:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
