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
import { parse as parseToml } from 'toml';
import path from 'node:path';
import fs from 'node:fs/promises';

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

export interface WorldCard {
  id: string;
  name: string;
  summary: string;
  entry_scene: string;
  portals: string[];
}

export const searchWorldCards = async (
  query: string,
  limit = 6,
): Promise<WorldCard[]> => {
  const trimmed = query.trim();
  const gateway = process.env.ECO_API_URL ?? 'http://localhost:8080';
  if (trimmed) {
    try {
      const url = new URL('/query', gateway);
      url.searchParams.set('q', trimmed);
      url.searchParams.set('limit', String(limit));
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const payload = (await response.json()) as { results: WorldCard[] };
        return payload.results;
      }
    } catch (error) {
      console.warn('eco-api unavailable, falling back to local manifests', error);
    }
  }

  const entries = await fs.readdir(worldRoot, { withFileTypes: true });
  const matches: WorldCard[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(worldRoot, entry.name, 'ECO.toml');
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const manifest = parseToml(raw) as {
        name?: string;
        version?: string;
        entry_scene?: string;
        portals?: Array<{ target?: string }>;
        summary?: string;
      };
      const portals = (manifest.portals ?? [])
        .map((portal) => portal?.target)
        .filter((target): target is string => Boolean(target));
      const card: WorldCard = {
        id: entry.name,
        name: manifest.name ?? entry.name,
        summary:
          manifest.summary ??
          `${manifest.name ?? entry.name} v${manifest.version ?? '0.0.0'} with ${portals.length} portals`,
        entry_scene: manifest.entry_scene ?? '',
        portals,
      };
      if (!trimmed) {
        matches.push(card);
        continue;
      }
      const haystack = [
        card.name.toLowerCase(),
        card.summary.toLowerCase(),
        card.entry_scene.toLowerCase(),
        ...portals.map((p) => p.toLowerCase()),
      ];
      if (haystack.some((field) => field.includes(trimmed.toLowerCase()))) {
        matches.push(card);
      }
    } catch (error) {
      console.warn('Failed to load ECO manifest for search', manifestPath, error);
    }
  }

  matches.sort((a, b) => a.name.localeCompare(b.name));
  return matches.slice(0, limit);
};

const worldRoot = process.env.ECO_MANIFEST_ROOT ?? path.resolve(process.cwd(), 'examples/worlds');

export const readEcoManifest = async <T = Record<string, unknown>>(worldId: string): Promise<T> => {
  const manifestPath = path.join(worldRoot, worldId, 'ECO.toml');
  const content = await fs.readFile(manifestPath, 'utf-8');
  return parseToml(content) as T;
};

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
