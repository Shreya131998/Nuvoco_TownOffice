import { PageHeader } from "@/components/dashboard/PageHeader";
import ExportForm from "./ExportForm";

export const dynamic = "force-dynamic";

export default function ExportPage() {
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <PageHeader
        title="Export to Excel"
        subtitle="One workbook: a sheet of complaints, and a sheet of visits joined to them by token."
      />
      <ExportForm />
    </div>
  );
}
