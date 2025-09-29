"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { logout } from "@/api/client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const performLogout = async () => {
      await logout();
      if (active) {
        router.replace("/login");
      }
    };

    void performLogout();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Signing you out…</p>
      </div>
    </div>
  );
}
