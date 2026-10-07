"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-xl p-10">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="my-4">The workspace could not be loaded.</p>
      <button onClick={reset} className="rounded-lg bg-teal-800 p-3 text-white">
        Retry
      </button>
    </main>
  );
}
