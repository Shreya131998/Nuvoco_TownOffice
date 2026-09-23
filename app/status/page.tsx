import StatusLookup from "./StatusLookup";
import { getBlocks } from "@/lib/sheets/store";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ token }, blocks] = await Promise.all([searchParams, getBlocks()]);
  return <StatusLookup initialToken={token ?? ""} blocks={blocks} />;
}
