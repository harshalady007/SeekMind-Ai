import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { getEnv } from "@/lib/config/env";
import { getIdentity } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: {
    default: "DeepFind — grounded answers from the live web",
    template: "%s · DeepFind",
  },
  description:
    "DeepFind is an AI answer engine: ask a question, it searches the web and writes a cited, verifiable answer.",
};

export const viewport: Viewport = {
  themeColor: "#101114",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const env = getEnv();
  const identity = await getIdentity();

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="df-grid-texture min-h-dvh">
        <AppShell
          demoMode={env.DEMO_MODE}
          supabaseAuth={env.SUPABASE_ENABLED && !env.DEMO_MODE}
          identity={
            identity?.kind === "user"
              ? { kind: "user", email: identity.email }
              : { kind: "anonymous", email: null }
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
