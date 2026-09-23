import ResolveForm from "./ResolveForm";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { toPublicComplaint } from "@/lib/public-complaint";
import { getBlocks, getByToken } from "@/lib/sheets/store";
import { normaliseToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/**
 * No login: the token is the key, so this page is mostly a shell around the
 * client form, which looks complaints up itself as the technician types.
 *
 * ?token= prefills it — the resident can hand over a link rather than have the
 * technician retype the code — and that case is resolved HERE, on the server,
 * rather than in an effect after mount. One less round trip, and the
 * technician's first paint already shows the complaint.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const raw = (await searchParams).token ?? "";
  const token = raw ? normaliseToken(raw) : null;
  const [found, blocks] = await Promise.all([
    token ? getByToken(token) : null,
    getBlocks(),
  ]);

  return (
    <ResolveForm
      initialToken={token ?? raw}
      initialComplaint={found ? toPublicComplaint(found) : null}
      blocks={blocks}
      photos={isCloudinaryConfigured()}
    />
  );
}
