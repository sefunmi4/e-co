"use client";

import { useEffect } from "react";
import Pages from "@/pages/index";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import socket from "@/lib/socket";

export default function EthosApp() {
  const { toast } = useToast();

  useEffect(() => {
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
  }, [toast]);

  return (
    <>
      <Pages />
      <Toaster />
    </>
  );
}
