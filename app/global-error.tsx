"use client";

/**
 * Catches errors thrown by the root layout itself (e.g. invalid environment
 * configuration at request time). Must render its own <html>/<body>.
 * Production redacts server error messages, so this page points operators at
 * /api/health, which reports the full configuration problem.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#101114",
          color: "#f1ede3",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <p style={{ color: "#ffb224", fontFamily: "monospace", fontSize: "0.85rem" }}>
            DeepFind
          </p>
          <h1 style={{ fontSize: "1.5rem", margin: "0.5rem 0" }}>
            The server could not start this page
          </h1>
          <p style={{ color: "#9aa1b1", fontSize: "0.95rem", lineHeight: 1.6 }}>
            This usually means the deployment&apos;s environment variables are incomplete
            — check <code>/api/health</code> for the exact configuration problem, and
            compare with <code>.env.example</code>.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.6rem 1.4rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#ffb224",
              color: "#101114",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
