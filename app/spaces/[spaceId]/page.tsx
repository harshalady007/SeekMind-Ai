import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SpaceDetailView } from "@/components/spaces/space-detail-view";

export const metadata: Metadata = { title: "Space" };
export const dynamic = "force-dynamic";

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  if (!z.string().uuid().safeParse(spaceId).success) notFound();
  return <SpaceDetailView spaceId={spaceId} />;
}
