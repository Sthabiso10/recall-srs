import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-shell flex-col justify-center px-4 py-16 sm:px-6">
      <p className="label">404</p>
      <h1 className="mt-1.5 text-3xl font-semibold">Nothing scheduled here</h1>
      <p className="mt-3 max-w-md text-muted">
        This page does not exist, or it moved while you were away. The documentation index
        is the fastest way back.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/docs" className="btn btn-primary">
          Documentation
        </Link>
        <Link href="/" className="btn btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
