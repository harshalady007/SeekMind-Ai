import type { Metadata } from "next";
import { SpacesView } from "@/components/spaces/spaces-view";

export const metadata: Metadata = { title: "Spaces" };
export const dynamic = "force-dynamic";

export default function SpacesPage() {
  return <SpacesView />;
}
