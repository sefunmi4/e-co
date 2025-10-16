import type { Namespace, Socket } from "socket.io";

import { BurstLimiter } from "./burstLimiter";
import type { BridgeLimitScope } from "./burstLimiter";
import type { BridgeControlsConfig } from "./config";
import { loadBridgeControlsFromEnv } from "./config";
import type { BridgeFlagClient } from "./featureFlags";
import { createBridgeFlagClient } from "./featureFlags";

export interface BridgeTelemetryEvent {
  type: "throttled" | "disabled";
  namespace: string;
  event: string;
  roomId: string | null;
  userId: string;
  scope?: BridgeLimitScope;
  limit?: number;
  remaining?: number;
  resetAt?: number;
}

export type BridgeTelemetryCallback = (event: BridgeTelemetryEvent) => void;

export interface BridgeMiddlewareOptions {
  namespaceName: string;
  controls?: BridgeControlsConfig;
  flagClient?: BridgeFlagClient;
  telemetry?: BridgeTelemetryCallback;
  logger?: Pick<Console, "info" | "warn" | "debug" | "error">;
}

const DEFAULT_EXCLUDED_EVENTS = new Set([
  "disconnect",
  "disconnecting",
  "error",
  "connect",
  "connect_error",
]);

const normaliseId = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return `${value}`;
  }
  return null;
};

const extractUserId = (socket: Socket): string => {
  const authUserId = normaliseId((socket.handshake.auth as Record<string, unknown>)?.userId);
  if (authUserId) return authUserId;
  const queryUserId = normaliseId((socket.handshake.query as Record<string, unknown>)?.userId);
  if (queryUserId) return queryUserId;
  return socket.id;
};

const extractRoomIds = (packet: unknown[]): string[] => {
  const rooms = new Set<string>();
  const pushRoom = (candidate: unknown) => {
    const roomId = normaliseId(candidate);
    if (roomId) rooms.add(roomId);
  };

  const inspect = (value: unknown) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
      pushRoom(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => inspect(entry));
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if ("roomId" in record) {
        pushRoom(record.roomId);
      }
      if ("room" in record) {
        pushRoom(record.room);
      }
      if ("rooms" in record) {
        inspect(record.rooms);
      }
    }
  };

  packet.forEach((arg) => inspect(arg));
  return [...rooms];
};

const shouldCheckEvent = (
  event: string,
  controls: BridgeControlsConfig,
): boolean => {
  if (controls.trackedEvents && controls.trackedEvents.length > 0) {
    return controls.trackedEvents.includes(event);
  }
  if (controls.excludedEvents && controls.excludedEvents.length > 0) {
    return !controls.excludedEvents.includes(event);
  }
  return !DEFAULT_EXCLUDED_EVENTS.has(event);
};

const emitTelemetry = (
  telemetry: BridgeTelemetryCallback | undefined,
  logger: Pick<Console, "info" | "warn" | "debug" | "error"> | undefined,
  event: BridgeTelemetryEvent,
) => {
  telemetry?.(event);
  const targetLogger = event.type === "throttled" ? logger?.warn : logger?.info;
  targetLogger?.(
    `bridge event ${event.type} in namespace=${event.namespace} event=${event.event} user=${event.userId} room=${event.roomId ?? "n/a"}`,
    {
      scope: event.scope,
      limit: event.limit,
      remaining: event.remaining,
      resetAt: event.resetAt,
    },
  );
};

const createLimiter = (controls: BridgeControlsConfig): BurstLimiter => {
  return new BurstLimiter(controls);
};

const attachSocketMiddleware = (
  socket: Socket,
  namespaceName: string,
  controls: BridgeControlsConfig,
  limiter: BurstLimiter,
  telemetry?: BridgeTelemetryCallback,
  logger?: Pick<Console, "info" | "warn" | "debug" | "error">,
) => {
  const userId = extractUserId(socket);

  socket.use((packet, next) => {
    const [eventNameRaw, ...args] = packet;
    const eventName = typeof eventNameRaw === "string" ? eventNameRaw : "";

    if (!controls.enabled) {
      emitTelemetry(telemetry, logger, {
        type: "disabled",
        namespace: namespaceName,
        event: eventName,
        roomId: null,
        userId,
      });
      const error: Error & { data?: Record<string, unknown> } = new Error("bridge disabled");
      error.data = { code: "bridge_disabled" };
      next(error);
      return;
    }

    if (!shouldCheckEvent(eventName, controls)) {
      next();
      return;
    }

    const rooms = extractRoomIds(args);
    if (rooms.length === 0) {
      next();
      return;
    }

    for (const roomId of rooms) {
      const decision = limiter.check(userId, roomId);
      if (!decision.allowed) {
        const payload: BridgeTelemetryEvent = {
          type: "throttled",
          namespace: namespaceName,
          event: eventName,
          roomId,
          userId,
          scope: decision.scope,
          limit: decision.limit,
          remaining: decision.remaining,
          resetAt: decision.resetAt,
        };
        emitTelemetry(telemetry, logger, payload);
        const error: Error & { data?: Record<string, unknown> } = new Error(
          "bridge request throttled",
        );
        error.data = {
          code: "bridge_throttled",
          scope: decision.scope,
          limit: decision.limit,
          remaining: decision.remaining,
          resetAt: decision.resetAt,
        };
        next(error);
        return;
      }
    }

    next();
  });
};

export const registerBridgeMiddleware = (
  namespace: Namespace,
  options: BridgeMiddlewareOptions,
): void => {
  const controls = options.controls ?? loadBridgeControlsFromEnv();
  const flagClient = options.flagClient ?? createBridgeFlagClient({
    defaultEnabled: controls.enabled,
    flagFile: controls.flagFile,
    logger: options.logger,
  });

  const mergedControls: BridgeControlsConfig = {
    ...controls,
    enabled: flagClient.isBridgeEnabled(),
  };

  const limiter = createLimiter(mergedControls);

  flagClient.onChange((enabled) => {
    mergedControls.enabled = enabled;
    options.logger?.info?.(
      `bridge flag toggled namespace=${options.namespaceName} enabled=${enabled}`,
    );
  });

  namespace.on("connection", (socket) => {
    attachSocketMiddleware(
      socket,
      options.namespaceName,
      mergedControls,
      limiter,
      options.telemetry,
      options.logger,
    );
  });
};
