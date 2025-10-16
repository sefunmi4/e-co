import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "@e-co/config";
import { io, type Socket } from "socket.io-client";

export type PresenceNamespace = "pods" | "guilds" | "rooms";

export interface PresenceMessage {
  namespace: PresenceNamespace;
  roomId: string;
  count: number;
}

export interface UsePresenceCountsOptions {
  /**
   * When true the caller will actively join the rooms they observe.
   * This increments the presence counter for those rooms until the hook unmounts.
   */
  join?: boolean;
}

const realtimePath = "/realtime";
const baseGatewayUrl = env.web.gatewayUrl.replace(/\/$/u, "");
const isBrowser = typeof window !== "undefined";
const shouldConnect = isBrowser && (env.web.enableSocketIo || env.web.enableSocket);

const namespaceClients: Partial<Record<PresenceNamespace, Socket>> = {};
const namespaceListenerCounts = new Map<PresenceNamespace, number>();
const namespaceCache = new Map<PresenceNamespace, Map<string, number>>();

const ensureCache = (namespace: PresenceNamespace) => {
  let cache = namespaceCache.get(namespace);
  if (!cache) {
    cache = new Map<string, number>();
    namespaceCache.set(namespace, cache);
  }
  return cache;
};

const getNamespaceClient = (namespace: PresenceNamespace) => {
  if (!shouldConnect) return undefined;
  let client = namespaceClients[namespace];
  if (!client) {
    client = io(`${baseGatewayUrl}/${namespace}`, {
      path: realtimePath,
      autoConnect: true,
      transports: ["websocket"],
    });
    client.on("connect_error", (error) => {
      console.warn(`Socket.IO namespace connection failed for ${namespace}`, error);
    });
    namespaceClients[namespace] = client;
  }
  return client;
};

const retainNamespace = (namespace: PresenceNamespace) => {
  const next = (namespaceListenerCounts.get(namespace) ?? 0) + 1;
  namespaceListenerCounts.set(namespace, next);
};

const releaseNamespace = (namespace: PresenceNamespace) => {
  const next = (namespaceListenerCounts.get(namespace) ?? 1) - 1;
  if (next <= 0) {
    namespaceListenerCounts.delete(namespace);
    const client = namespaceClients[namespace];
    if (client) {
      client.removeAllListeners();
      client.disconnect();
      delete namespaceClients[namespace];
    }
    namespaceCache.delete(namespace);
  } else {
    namespaceListenerCounts.set(namespace, next);
  }
};

const normaliseRoomIds = (ids: Iterable<string>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawId of ids) {
    const candidate = typeof rawId === "string" ? rawId.trim() : String(rawId ?? "").trim();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    result.push(candidate);
  }
  result.sort();
  return result;
};

const formatInitialCounts = (
  namespace: PresenceNamespace,
  roomIds: string[],
  previous: Record<string, number>,
) => {
  const cache = namespaceCache.get(namespace);
  if (!cache) {
    if (roomIds.length === 0 && Object.keys(previous).length === 0) {
      return previous;
    }
    const next: Record<string, number> = {};
    roomIds.forEach((id) => {
      next[id] = previous[id] ?? 0;
    });
    return next;
  }
  let changed = roomIds.length !== Object.keys(previous).length;
  const next: Record<string, number> = {};
  roomIds.forEach((id) => {
    const value = cache.get(id) ?? 0;
    next[id] = value;
    if (!changed && previous[id] !== value) {
      changed = true;
    }
  });
  return changed ? next : previous;
};

const usePresenceCounts = (
  namespace: PresenceNamespace,
  roomIds: Iterable<string>,
  options: UsePresenceCountsOptions = {},
) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const normalisedIds = useMemo(() => normaliseRoomIds(roomIds), [roomIds]);
  const idSetRef = useRef<Set<string>>(new Set());
  const joinRef = useRef<string[]>([]);
  const joinEnabledRef = useRef(false);

  useEffect(() => {
    idSetRef.current = new Set(normalisedIds);
    setCounts((prev) => formatInitialCounts(namespace, normalisedIds, prev));
  }, [namespace, normalisedIds]);

  useEffect(() => {
    if (!shouldConnect) {
      setCounts({});
      return;
    }
    const client = getNamespaceClient(namespace);
    if (!client) return;

    retainNamespace(namespace);

    const handlePresence = (payload: PresenceMessage) => {
      if (payload.namespace !== namespace) return;
      const cache = ensureCache(namespace);
      cache.set(payload.roomId, payload.count);
      if (idSetRef.current.size > 0 && !idSetRef.current.has(payload.roomId)) {
        return;
      }
      setCounts((prev) => {
        if (prev[payload.roomId] === payload.count) {
          return prev;
        }
        return { ...prev, [payload.roomId]: payload.count };
      });
    };

    client.on("presence", handlePresence);

    return () => {
      client.off("presence", handlePresence);
      releaseNamespace(namespace);
    };
  }, [namespace]);

  useEffect(() => {
    if (!shouldConnect) return;
    const client = getNamespaceClient(namespace);
    if (!client) return;

    const shouldJoin = options.join === true;
    const previouslyJoining = joinEnabledRef.current;

    if (previouslyJoining && !shouldJoin && joinRef.current.length > 0) {
      joinRef.current.forEach((roomId) => client.emit("leave", { roomId }));
      joinRef.current = [];
    }

    if (shouldJoin) {
      const previous = new Set(joinRef.current);
      const current = new Set(normalisedIds);
      const toAdd = normalisedIds.filter((id) => !previous.has(id));
      const toRemove = joinRef.current.filter((id) => !current.has(id));

      toAdd.forEach((roomId) => client.emit("join", { roomId }));
      toRemove.forEach((roomId) => client.emit("leave", { roomId }));

      joinRef.current = normalisedIds;
    }

    joinEnabledRef.current = shouldJoin;

    return () => {
      if (!shouldJoin || joinRef.current.length === 0) return;
      joinRef.current.forEach((roomId) => client.emit("leave", { roomId }));
      joinRef.current = [];
      joinEnabledRef.current = false;
    };
  }, [namespace, normalisedIds, options.join]);

  return counts;
};

export default usePresenceCounts;
