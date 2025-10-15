import { env } from "@e-co/config";
import {
  createPromiseClient,
  type PromiseClient,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ActionsService } from "../../lib/proto/actions_connect";

export type ActionsClient = PromiseClient<typeof ActionsService>;

type ClientFactory = () => ActionsClient;

const resolveAgentUrl = () => env.agent.grpcUrl;

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
