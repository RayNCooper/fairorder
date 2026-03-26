export default function OrderLoading() {
  return (
    <div className="min-h-dvh bg-[#FAFAF8]">
      <header className="border-b border-stone-200 bg-white px-4 py-6 text-center">
        <div className="mx-auto h-7 w-48 animate-pulse bg-stone-200" />
      </header>
      <main className="mx-auto max-w-md px-4 py-8">
        <div className="space-y-6">
          {/* Status badge skeleton */}
          <div className="border-l-3 border-stone-300 bg-white p-4">
            <div className="h-4 w-32 animate-pulse bg-stone-200" />
            <div className="mt-2 h-3 w-48 animate-pulse bg-stone-100" />
          </div>

          {/* Order number skeleton */}
          <div className="h-8 w-24 animate-pulse bg-stone-200" />

          {/* Item rows skeleton */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-40 animate-pulse bg-stone-200" />
              <div className="h-4 w-16 animate-pulse bg-stone-200" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-32 animate-pulse bg-stone-200" />
              <div className="h-4 w-16 animate-pulse bg-stone-200" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-36 animate-pulse bg-stone-200" />
              <div className="h-4 w-16 animate-pulse bg-stone-200" />
            </div>
          </div>

          {/* Total skeleton */}
          <div className="border-t border-stone-200 pt-3">
            <div className="flex justify-between">
              <div className="h-5 w-16 animate-pulse bg-stone-200" />
              <div className="h-5 w-20 animate-pulse bg-stone-200" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
