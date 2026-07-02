"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isConfigError = error.message.includes("environment configuration");
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-danger" aria-hidden="true" />
      <h1 className="mt-3 font-display text-2xl text-cream-50">
        {isConfigError ? "Configuration problem" : "Something went wrong"}
      </h1>
      <p className="mt-3 text-sm text-graphite-300">
        {isConfigError
          ? "The server environment is misconfigured. Check the server logs and .env.example for the required variables."
          : "An unexpected error occurred. Your threads are safe — try again."}
      </p>
      {!isConfigError && (
        <Button variant="primary" className="mt-6" onClick={reset}>
          Try again
        </Button>
      )}
    </div>
  );
}
