"use client";

import { create } from "zustand";
import type { StoreApi } from "zustand";
import {
  createPromiseClient,
  type Interceptor,
  type PromiseClient,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import type { PlainMessage } from "@bufbuild/protobuf";
import {
  Conversation,
  Message,
  Participant,
  PresenceEvent,
  PresenceState,
} from "../../lib/proto/ethos_pb";
import { ConversationsService } from "../../lib/proto/ethos_connect";

export interface EthosSession {
  token: string;
  userId: string;
  displayName: string;
}

export interface RosterEntry {
  userId: string;
  displayName: string;
  avatarUrl: string;
  presence: PresenceState;
  updatedAt: number;
}

export interface NormalizedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  timestamp: number;
}

export interface ConversationSummary {
  id: string;
  topic: string;
  participantIds: string[];
  lastUpdated: number;
}

type ConversationsClient = PromiseClient<typeof ConversationsService>;

type MessageStreamMap = Record<string, AbortController>;

export type EthosStatus = "idle" | "connecting" | "ready" | "error";

export interface EthosState {
  status: EthosStatus;
  session?: EthosSession;
  error?: string;
  client?: ConversationsClient;
  rooms: Record<string, ConversationSummary>;
  roster: Record<string, RosterEntry>;
  messageBuffers: Record<string, NormalizedMessage[]>;
  openRooms: string[];
  activeRoomId?: string;
  messageStreams: MessageStreamMap;
  presenceController?: AbortController;
  bootstrap: () => Promise<void>;
  connect: (session: EthosSession) => Promise<void>;
  disconnect: () => void;
  openConversation: (conversationId: string) => Promise<void>;
  closeConversation: (conversationId: string) => void;
  setActiveRoom: (conversationId: string) => void;
  sendMessage: (conversationId: string, body: string) => Promise<void>;
}

const resolveGatewayUrl = () =>
  process.env.NEXT_PUBLIC_ETHOS_GATEWAY ?? "http://localhost:8080";

const LOCAL_STORAGE_KEY = "ethos.session";

type ClientFactory = (token?: string) => ConversationsClient;

const buildClient = (token?: string): ConversationsClient => {
  const baseUrl = resolveGatewayUrl();
  const transport = createConnectTransport({
    baseUrl,
    useBinaryFormat: false,
  });
  const interceptors: Interceptor[] = [];
  if (token) {
    const auth: Interceptor = (next) => async (request) => {
      request.header.set("Authorization", `Bearer ${token}`);
      return next(request);
    };
    interceptors.push(auth);
  }

  return createPromiseClient(ConversationsService, transport, {
    interceptors,
  });
};

let clientFactory: ClientFactory = (token) => {
  if (typeof window !== "undefined") {
    const maybeFactory = (window as unknown as {
      __ETHOS_CLIENT_FACTORY__?: ClientFactory;
    }).__ETHOS_CLIENT_FACTORY__;
    if (maybeFactory) {
      return maybeFactory(token);
    }
  }
  return buildClient(token);
};

export const overrideConversationsClientFactory = (factory: ClientFactory) => {
  clientFactory = factory;
};

const coerceTimestamp = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
};

const normalizeParticipant = (
  participant: PlainMessage<Participant>,
): RosterEntry => ({
  userId: participant.userId ?? participant.user_id ?? "",
  displayName: participant.displayName ?? participant.display_name ?? "Guild Member",
  avatarUrl: participant.avatarUrl ?? participant.avatar_url ?? "",
  presence: PresenceState.STATE_OFFLINE,
  updatedAt: Date.now(),
});

const normalizeConversation = (
  conversation: PlainMessage<Conversation>,
): ConversationSummary => ({
  id: conversation.id ?? "",
  topic: conversation.topic ?? "Untitled Thread",
  participantIds: (conversation.participants ?? []).map(
    (participant) => participant.userId ?? participant.user_id ?? "",
  ),
  lastUpdated: coerceTimestamp(
    conversation.updatedAt ?? conversation.updated_at ?? Date.now(),
  ),
});

const normalizeMessage = (
  payload: PlainMessage<Message>,
): NormalizedMessage => ({
  id:
    payload.id ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`),
  conversationId:
    payload.conversationId ?? payload.conversation_id ?? "conversation",
  senderId: payload.senderId ?? payload.sender_id ?? "",
  body: payload.body ?? "",
  timestamp: coerceTimestamp(
    payload.timestampMs ?? payload.timestamp_ms ?? Date.now(),
  ),
});

const normalizePresence = (event: PlainMessage<PresenceEvent>) => ({
  userId: event.userId ?? event.user_id ?? "",
  state: event.state ?? PresenceState.PRESENCE_STATE_UNSPECIFIED,
  updatedAt: coerceTimestamp(event.updatedAt ?? event.updated_at ?? Date.now()),
});

const resolveSessionFromEnv = (): EthosSession | undefined => {
  if (typeof window !== "undefined") {
    const globalSession = (window as unknown as {
      __ETHOS_SESSION__?: EthosSession;
    }).__ETHOS_SESSION__;
    if (globalSession?.token) {
      return globalSession;
    }

    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as EthosSession;
        if (parsed?.token) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn("failed to parse stored session", error);
    }
  }

  const token = process.env.NEXT_PUBLIC_ETHOS_TOKEN;
  if (!token) return undefined;
  return {
    token,
    userId: process.env.NEXT_PUBLIC_ETHOS_USER_ID ?? "guest",
    displayName: process.env.NEXT_PUBLIC_ETHOS_DISPLAY_NAME ?? "Guest",
  };
};

const teardownStreams = (state: EthosState) => {
  Object.values(state.messageStreams).forEach((controller) => {
    controller.abort();
  });
  state.presenceController?.abort();
};

const beginPresenceStream = (
  client: ConversationsClient,
  userIds: string[],
  api: StoreApi<EthosState>,
) => {
  if (!userIds.length) return;
  const controller = new AbortController();
  api.setState({ presenceController: controller });
  (async () => {
    try {
      for await (const payload of client.streamPresence(
        { userIds },
        { signal: controller.signal },
      )) {
        if (!payload.event) continue;
        const presence = normalizePresence(payload.event);
        api.setState((prev) => ({
          roster: {
            ...prev.roster,
            [presence.userId]: {
              ...(prev.roster[presence.userId] ?? {
                userId: presence.userId,
                displayName: presence.userId,
                avatarUrl: "",
                presence: PresenceState.STATE_OFFLINE,
                updatedAt: Date.now(),
              }),
              presence: presence.state,
              updatedAt: presence.updatedAt,
            },
          },
        }));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.warn("presence stream terminated", error);
      }
    } finally {
      api.setState((prev) =>
        prev.presenceController === controller
          ? { presenceController: undefined }
          : prev,
      );
    }
  })();
};

const startMessageStream = (
  client: ConversationsClient,
  conversationId: string,
  api: StoreApi<EthosState>,
) => {
  const existing = api.getState().messageStreams[conversationId];
  if (existing) {
    return;
  }

  const controller = new AbortController();
  api.setState((prev) => ({
    messageStreams: { ...prev.messageStreams, [conversationId]: controller },
  }));

  (async () => {
    try {
      for await (const payload of client.streamMessages(
        { conversationId },
        { signal: controller.signal },
      )) {
        if (!payload.message) continue;
        const message = normalizeMessage(payload.message);
        api.setState((prev) => {
          const nextBuffer = [...(prev.messageBuffers[conversationId] ?? [])];
          nextBuffer.push(message);
          const nextRooms = {
            ...prev.rooms,
            [conversationId]: {
              ...prev.rooms[conversationId],
              lastUpdated: message.timestamp,
            },
          };
          return {
            messageBuffers: { ...prev.messageBuffers, [conversationId]: nextBuffer },
            rooms: nextRooms,
          };
        });
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.warn("message stream terminated", error);
      }
    } finally {
      api.setState((prev) => {
        const { [conversationId]: current, ...rest } = prev.messageStreams;
        if (current === controller) {
          return { messageStreams: rest };
        }
        return prev;
      });
    }
  })();
};

export const useEthosStore = create<EthosState>((set, get, api) => ({
  status: "idle",
  rooms: {},
  roster: {},
  messageBuffers: {},
  openRooms: [],
  messageStreams: {},
  async bootstrap() {
    if (get().status !== "idle" || get().session) return;
    const session = resolveSessionFromEnv();
    if (!session) return;
    await get().connect(session);
  },
  async connect(session) {
    if (!session.token) return;
    set({ status: "connecting", error: undefined });
    try {
      const client = clientFactory(session.token);
      const response = await client.listConversations({});
      const roster: Record<string, RosterEntry> = {};
      const rooms: Record<string, ConversationSummary> = {};
      const participantIds = new Set<string>();

      (response.conversations ?? []).forEach((rawConversation) => {
        const conversation = normalizeConversation(rawConversation);
        rooms[conversation.id] = conversation;
        (rawConversation.participants ?? []).forEach((participant) => {
          const normalized = normalizeParticipant(participant);
          if (normalized.userId) {
            roster[normalized.userId] = normalized;
            participantIds.add(normalized.userId);
          }
        });
      });

      const nextOpen = Object.keys(rooms).slice(0, 1);

      set({
        status: "ready",
        session,
        client,
        rooms,
        roster,
        openRooms: nextOpen,
        activeRoomId: nextOpen[0],
        messageBuffers: {},
      });

      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(session));
      }

      if (nextOpen[0]) {
        await get().openConversation(nextOpen[0]);
      }

      beginPresenceStream(client, Array.from(participantIds), api);
    } catch (error) {
      console.error("Failed to initialise Ethos session", error);
      set({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  disconnect() {
    teardownStreams(get());
    set({
      status: "idle",
      session: undefined,
      client: undefined,
      rooms: {},
      roster: {},
      messageBuffers: {},
      openRooms: [],
      activeRoomId: undefined,
      messageStreams: {},
      presenceController: undefined,
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  },
  async openConversation(conversationId) {
    const { client, rooms } = get();
    if (!client || !rooms[conversationId]) return;
    if (!get().openRooms.includes(conversationId)) {
      set((state) => ({ openRooms: [...state.openRooms, conversationId] }));
    }
    startMessageStream(client, conversationId, api);
    set({ activeRoomId: conversationId });
  },
  closeConversation(conversationId) {
    const stream = get().messageStreams[conversationId];
    stream?.abort();
    set((state) => {
      const nextOpen = state.openRooms.filter((id) => id !== conversationId);
      const nextActive =
        state.activeRoomId === conversationId ? nextOpen[0] : state.activeRoomId;
      const { [conversationId]: _, ...restStreams } = state.messageStreams;
      return {
        openRooms: nextOpen,
        activeRoomId: nextActive,
        messageStreams: restStreams,
      };
    });
  },
  setActiveRoom(conversationId) {
    if (!get().openRooms.includes(conversationId)) {
      void get().openConversation(conversationId);
    } else {
      set({ activeRoomId: conversationId });
    }
  },
  async sendMessage(conversationId, body) {
    const trimmed = body.trim();
    if (!trimmed) return;
    const { client } = get();
    if (!client) return;
    const response = await client.sendMessage({ conversationId, body: trimmed });
    if (response.message) {
      const message = normalizeMessage(response.message);
      set((state) => ({
        messageBuffers: {
          ...state.messageBuffers,
          [conversationId]: [
            ...(state.messageBuffers[conversationId] ?? []),
            message,
          ],
        },
      }));
    }
  },
}));

export const selectActiveConversation = (state: EthosState) =>
  state.activeRoomId ? state.rooms[state.activeRoomId] : undefined;

export const selectActiveMessages = (state: EthosState) =>
  state.activeRoomId
    ? state.messageBuffers[state.activeRoomId] ?? []
    : [];

export const selectRosterForConversation = (
  state: EthosState,
  conversationId: string,
) => {
  const conversation = state.rooms[conversationId];
  if (!conversation) return [] as RosterEntry[];
  return conversation.participantIds
    .map((id) => state.roster[id])
    .filter((entry): entry is RosterEntry => Boolean(entry));
};

