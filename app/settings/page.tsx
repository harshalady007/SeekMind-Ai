import type { Metadata } from "next";
import { getIdentity } from "@/lib/auth/session";
import { SettingsView } from "@/components/settings/settings-view";
import { SignInPrompt } from "@/components/settings/sign-in-prompt";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const identity = await getIdentity();
  if (!identity || identity.kind !== "user") {
    return <SignInPrompt />;
  }
  return <SettingsView email={identity.email} />;
}
