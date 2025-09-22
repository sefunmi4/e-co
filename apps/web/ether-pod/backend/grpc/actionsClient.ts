import {
  createPromiseClient,
  type PromiseClient,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ActionsService } from "../../lib/proto/actions_connect";

export type ActionsClient = PromiseClient<typeof ActionsService>;

type ClientFactory = () => ActionsClient;

const resolveAgentUrl = () =>
  process.env.NEXT_PUBLIC_AGENT_GRPC_URL ?? "http://127.0.0.1:50051";

let factory: ClientFactory = () => {
  const baseUrl = resolveAgentUrl();
  const transport = createConnectTransport({
    baseUrl,
    useBinaryFormat: false,
  });
  return createPromiseClient(ActionsService, transport);
};

export const overrideActionsClientFactory = (next: ClientFactory) => {
  factory = next;
};

export const resetActionsClientFactory = () => {
  factory = () => {
    const baseUrl = resolveAgentUrl();
    const transport = createConnectTransport({
      baseUrl,
      useBinaryFormat: false,
    });
    return createPromiseClient(ActionsService, transport);
  };
};

export const createActionsClient = (): ActionsClient => factory();
