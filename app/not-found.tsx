import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-mono text-sm text-amber-glow">404</p>
      <h1 className="mt-2 font-display text-2xl text-cream-50">Nothing surfaced here</h1>
      <p className="mt-3 text-sm text-graphite-300">
        The page you&apos;re looking for doesn&apos;t exist, or the link has expired.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center rounded-xl bg-amber-glow px-5 text-sm font-semibold text-graphite-950 hover:bg-amber-soft"
      >
        Back to search
      </Link>
    </div>
  );
}
