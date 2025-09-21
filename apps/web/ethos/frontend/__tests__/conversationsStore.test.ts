import { beforeEach, describe, expect, it, vi } from "vitest";

var mockSendMessage: ReturnType<typeof vi.fn>;

vi.mock("@/lib/api/grpc", () => {
  mockSendMessage = vi.fn(async ({ conversationId, body }: { conversationId: string; body: string }) => ({
    message: {
      id: "generated",
      conversationId,
      senderId: "user-1",
      body,
      timestampMs: Date.now(),
    },
  }));

  return {
    createConversationsClient: () => ({
      sendMessage: mockSendMessage,
    }),
  };
});

import { resetConversationStore, useConversationStore } from "@/lib/stores/conversations";
import { useSessionStore } from "@/lib/stores/session";

class MockEventSource {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    mockEventSources.push(this);
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  close() {
    this.closed = true;
  }
}

const mockEventSources: MockEventSource[] = [];

(globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource as typeof EventSource;

describe("conversation store", () => {
  beforeEach(() => {
    resetConversationStore();
    mockSendMessage?.mockClear();
    mockEventSources.length = 0;
    (global.fetch as unknown) = vi.fn(async () =>
      new Response(
        JSON.stringify({
          conversations: [
            {
              id: "c1",
              topic: "Quest",
              participants: [
                { user_id: "user-1", display_name: "Scout" },
                { user_id: "user-2", display_name: "Strategist" },
              ],
              updated_at: Date.now(),
              messages: [
                {
                  id: "m1",
                  conversation_id: "c1",
                  sender_id: "user-1",
                  body: "Initial",
                  timestamp_ms: Date.now(),
                },
              ],
            },
          ],
          presence: [],
        }),
        { status: 200 },
      ),
    );
    useSessionStore.setState({
      status: "authenticated",
      session: {
        token: "token",
        user: { id: "user-1", email: "user@example.com" },
        matrix: { ready: true },
      },
    });
  });

  it("bootstraps conversations and responds to SSE events", async () => {
    await useConversationStore.getState().bootstrap();
    const state = useConversationStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].messages).toHaveLength(1);
    expect(mockEventSources).toHaveLength(1);

    mockEventSources[0].emit({
      type: "message",
      message: {
        id: "m2",
        conversation_id: "c1",
        sender_id: "user-2",
        body: "Overwatch",
        timestamp_ms: Date.now(),
      },
    });

    expect(useConversationStore.getState().conversations[0].messages).toHaveLength(2);
  });

  it("sends messages via the gRPC client", async () => {
    await useConversationStore.getState().bootstrap();
    await useConversationStore.getState().sendMessage("c1", "New message");
    expect(mockSendMessage).toHaveBeenCalledWith({ conversationId: "c1", body: "New message" });
  });
});
