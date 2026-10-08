import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-nexus-dark text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-extrabold text-rail-emerald mb-4">404</h1>
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-gray-400 max-w-md mb-6">
        The route you are looking for does not exist on NexusRail Commerce.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-xl bg-rail-emerald text-nexus-dark font-bold text-sm hover:opacity-90 transition-opacity"
      >
        Back to Home
      </Link>
    </main>
  );
}
