import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-transparent text-[var(--foreground)] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-extrabold text-[var(--gold)] mb-4">404</h1>
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-[var(--muted)] max-w-md mb-6">
        The route you are looking for does not exist on NexusRail Commerce.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-xl bg-[var(--gold)] text-black font-bold text-sm hover:bg-[var(--gold-bright)] transition-colors"
      >
        Back to Home
      </Link>
    </main>
  );
}
