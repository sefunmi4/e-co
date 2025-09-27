"use client";

import { useSessionStore } from "@/lib/stores/session";
import { FormEvent, useState } from "react";

export default function AuthBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, login, register, error } = useSessionStore((state) => ({
    status: state.status,
    login: state.login,
    register: state.register,
    error: state.error,
  }));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const isRegister = mode === "register";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isRegister) {
      await register({ email, password, displayName });
    } else {
      await login({ email, password });
    }
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
        <div className="space-y-2 text-center md:text-left">
          <h1 className="text-2xl font-semibold text-white">
            {isRegister ? "Create your Ethos account" : "Sign in to Ethos"}
          </h1>
          <p className="text-sm text-slate-400">
            Use your Ethos credentials to access the Matrix-backed guild experience, or create a new account to get started.
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
        {isRegister ? (
          <label className="block text-left text-sm font-medium text-slate-300">
            Display name
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white focus:border-brand-400 focus:outline-none"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How should other operatives refer to you?"
            />
          </label>
        ) : null}
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
          {status === "loading"
            ? isRegister
              ? "Creating account…"
              : "Signing in…"
            : isRegister
              ? "Create account"
              : "Sign in"}
        </button>
        <p className="text-center text-xs text-slate-400">
          {isRegister ? "Already have an account?" : "New to Ethos?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
            }}
            className="font-semibold text-brand-300 hover:text-brand-200"
          >
            {isRegister ? "Sign in" : "Create one"}
          </button>
        </p>
      </form>
    </div>
  );
}
