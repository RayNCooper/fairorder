import Link from "next/link";

export default function OrderNotFound() {
  return (
    <div className="min-h-dvh bg-[#FAFAF8]">
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center bg-stone-100">
            <span className="text-2xl text-stone-400">?</span>
          </div>
          <h1 className="text-xl font-extrabold text-stone-900">
            Bestellung nicht gefunden
          </h1>
          <p className="text-sm text-stone-500">
            Diese Bestellung existiert nicht oder der Link ist ungültig.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block bg-stone-900 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-stone-800"
          >
            Zur Startseite
          </Link>
        </div>
      </main>
    </div>
  );
}
