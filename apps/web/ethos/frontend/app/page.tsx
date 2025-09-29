"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Pages from "@/pages/index";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { getSession, getToken, setToken } from "@/api/client";
import socket from "@/lib/socket";

export default function EthosApp() {
  const { toast } = useToast();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const ensureSession = async () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        await getSession();
        if (!cancelled) {
          setReady(true);
        }
      } catch (error) {
        setToken(null);
        if (!cancelled) {
          router.replace("/login");
        }
      }
    };

    ensureSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    socket.on("notification", (notification) => {
      toast({ title: "Notification", description: notification.content });
    });

    socket.on("partyMessage", (message) => {
      toast({ title: `Party ${message.party_id}`, description: message.message });
    });

    return () => {
      socket.off("notification");
      socket.off("partyMessage");
    };
  }, [ready, toast]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Pages />
      <Toaster />
    </>
  );
}
