"use client";

import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignInPrompt() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <LockKeyhole className="mx-auto h-8 w-8 text-graphite-400" aria-hidden="true" />
      <h1 className="mt-3 font-display text-xl text-cream-50">Sign in required</h1>
      <p className="mt-2 text-sm text-graphite-300">
        Settings, persistent history and workspaces are tied to your account.
      </p>
      <Button
        variant="primary"
        className="mt-6"
        onClick={() => router.push("/auth/login?next=/settings")}
      >
        Sign in
      </Button>
    </div>
  );
}
