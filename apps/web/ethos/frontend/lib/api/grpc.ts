import { createPromiseClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ConversationsService } from "@/lib/proto/ethos_connect";
import { useSessionStore } from "@/lib/stores/session";

export const createConversationsClient = () => {
  const transport = createConnectTransport({
    baseUrl: process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8080",
    useBinaryFormat: false,
  });

  const authInterceptor: Interceptor = (next) => async (request) => {
    const token = useSessionStore.getState().session?.token;
    if (token) {
      request.header.set("Authorization", `Bearer ${token}`);
    }
    return next(request);
  };

  return createPromiseClient(ConversationsService, transport, {
    interceptors: [authInterceptor],
  });
};
