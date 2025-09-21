import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6 text-center">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-4xl font-bold text-white sm:text-5xl">
          Ethos: coordinate guilds, quests, and conversations.
        </h1>
        <p className="text-lg text-slate-300">
          The new Ethos web experience is powered by a Next.js app that speaks protobufs to a Rust gateway and Matrix rooms. Sign in to join live quests and asynchronous strategy sessions.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/chat"
            className="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-400"
          >
            Enter the Hub
          </Link>
          <a
            href="https://matrix.org"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-brand-200 hover:text-brand-100"
          >
            Learn about Matrix federation →
          </a>
        </div>
      </div>
    </main>
  );
}
