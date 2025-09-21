"use client";

import { useSessionStore } from "@/lib/stores/session";
import { FormEvent, useState } from "react";

export default function AuthBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, login, error } = useSessionStore((state) => ({
    status: state.status,
    login: state.login,
    error: state.error,
  }));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await login({ email, password });
  };

  if (status === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">Sign in to Ethos</h1>
          <p className="text-sm text-slate-400">
            Authenticate with your Ethos JWT to hydrate the Matrix-backed session via the gateway.
          </p>
        </div>
        <label className="block text-left text-sm font-medium text-slate-300">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white focus:border-brand-400 focus:outline-none"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-left text-sm font-medium text-slate-300">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white focus:border-brand-400 focus:outline-none"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-full bg-brand-500 py-2 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
