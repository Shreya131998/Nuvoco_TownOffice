import ComplaintForm from "./ComplaintForm";
import { loadReference } from "@/lib/sheets/store";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function Page() {
  const res = await loadReference();
  if (!res.ok) return <SetupNotice detail={res.detail} />;
  // The photo field always renders. With Cloudinary unset it renders disabled
  // and says why, rather than vanishing and looking like a missing feature.
  return (
    <ComplaintForm
      issueTypes={res.issueTypes}
      blocks={res.blocks}
      photos={isCloudinaryConfigured()}
    />
  );
}
