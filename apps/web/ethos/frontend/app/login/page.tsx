"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, LogIn, Mail, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/toaster";
import { guestLogin, getSession, getToken, login } from "@/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      return;
    }

    getSession()
      .then(() => router.replace("/"))
      .catch(() => undefined);
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setGuestLoading(true);
    try {
      await guestLogin();
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create guest session";
      setError(message);
    } finally {
      setGuestLoading(false);
    }
  };

  useEffect(() => {
    if (error) {
      setShowEmailForm(true);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-slate-900">
      <Card className="w-full max-w-md border-none bg-transparent shadow-none">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold">Welcome back to Ethos</CardTitle>
          <CardDescription>Sign in to continue your quests and conversations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              disabled={loading || guestLoading}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-left text-base font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="flex items-center gap-3">
                <Mail className="h-5 w-5" />
                Continue with email
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/signup?method=phone")}
              disabled={loading || guestLoading}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-left text-base font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="flex items-center gap-3">
                <Phone className="h-5 w-5" />
                Sign up with phone number
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleGuest}
              disabled={loading || guestLoading}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-left text-base font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="flex items-center gap-3">
                {guestLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Users className="h-5 w-5" />
                )}
                Continue as guest
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {(showEmailForm || error) && (
            <div className="mt-6 space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Authentication failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2 text-left">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={loading || guestLoading}
                  />
                </div>
                <div className="space-y-2 text-left">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={loading || guestLoading}
                  />
                </div>
                <Button className="w-full" type="submit" disabled={loading || guestLoading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Sign in
                </Button>
              </form>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Need an account?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Request access
            </Link>
          </p>
        </CardFooter>
      </Card>
      <Toaster />
    </div>
  );
}
