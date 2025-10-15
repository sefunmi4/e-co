"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PublishedPodError({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-indigo-100">
      <div className="space-y-4 rounded-xl border border-red-500/40 bg-red-950/60 px-6 py-5 text-center shadow-2xl">
        <h1 className="text-lg font-semibold">Unable to load published pod</h1>
        <p className="text-sm text-red-200/80" data-testid="published-pod-error">
          {error.message || 'An unexpected error occurred while contacting the gateway.'}
        </p>
        <button
          type="button"
          className="rounded-md border border-red-400/50 bg-red-600/70 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-500"
          onClick={() => reset()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

