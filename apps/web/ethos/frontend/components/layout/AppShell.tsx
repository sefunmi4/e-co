"use client";

import { useSessionStore } from "@/lib/stores/session";
import clsx from "clsx";
import Link from "next/link";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { session, logout } = useSessionStore((state) => ({
    session: state.session,
    logout: state.logout,
  }));

  return (
    <div className="grid h-screen grid-rows-[auto,1fr] bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 px-8 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold">
            Ethos Guilds
          </Link>
          <span
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-semibold",
              session?.matrix?.ready
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-slate-700/40 text-slate-300"
            )}
          >
            {session?.matrix?.ready ? "Matrix linked" : "Offline"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="font-medium text-slate-100">{session?.user.displayName ?? "Anonymous"}</p>
            <p className="text-xs text-slate-400">{session?.user.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="overflow-hidden">{children}</main>
    </div>
  );
}
