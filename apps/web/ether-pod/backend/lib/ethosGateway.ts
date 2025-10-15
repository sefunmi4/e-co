import { createPromiseClient, type Interceptor } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import type { PromiseClient } from '@connectrpc/connect';
import { ConversationsService } from '../../lib/proto/ethos_connect';
import {
  ListConversationsResponse,
  Message,
  StreamMessagesResponse,
} from '../../lib/proto/ethos_pb';
import type { PlainMessage } from '@bufbuild/protobuf';

type ConversationsClient = PromiseClient<typeof ConversationsService>;

const resolveGateway = () =>
  process.env.ETHOS_GATEWAY ?? process.env.NEXT_PUBLIC_ETHOS_GATEWAY ?? 'http://localhost:8080';

const buildClient = (token?: string): ConversationsClient => {
  const transport = createConnectTransport({
    baseUrl: resolveGateway(),
    useBinaryFormat: false,
  });
  const interceptors: Interceptor[] = [];
  if (token) {
    const auth: Interceptor = (next) => async (request) => {
      request.header.set('Authorization', `Bearer ${token}`);
      return next(request);
    };
    interceptors.push(auth);
  }
  return createPromiseClient(ConversationsService, transport, { interceptors });
};

export const createGatewayClient = (token?: string) => buildClient(token);

export const listConversations = async (token?: string): Promise<PlainMessage<ListConversationsResponse>> => {
  const client = buildClient(token);
  return client.listConversations({});
};

export const sendGatewayMessage = async (
  token: string,
  conversationId: string,
  body: string,
): Promise<PlainMessage<Message>> => {
  const client = buildClient(token);
  const response = await client.sendMessage({ conversationId, body });
  return response.message ?? Message.create();
};

export const streamGatewayMessages = (
  token: string,
  conversationId: string,
  signal?: AbortSignal,
): AsyncIterable<PlainMessage<StreamMessagesResponse>> => {
  const client = buildClient(token);
  return client.streamMessages({ conversationId }, { signal });
};

export { readEcoManifest, searchWorldCards, type WorldCard } from './worldManifests';

export interface SymbolCastAction {
  worldId?: string;
  portalTarget: string;
  payload?: Record<string, unknown>;
}

export const relaySymbolCastAction = async (action: SymbolCastAction) => {
  const endpoint =
    process.env.SYMBOLCAST_GATEWAY ?? `${resolveGateway().replace(/\/$/, '')}/symbolcast`; // best-effort default
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action),
  });
  if (!response.ok) {
    throw new Error(`SymbolCast relay failed with status ${response.status}`);
  }
};
