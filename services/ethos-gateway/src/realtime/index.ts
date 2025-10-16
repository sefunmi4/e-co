import { createServer, type Server as HttpServer } from "http";
import { fileURLToPath } from "url";
import { Server, type Namespace, type ServerOptions, type Socket } from "socket.io";

import { registerBridgeMiddleware } from "./bridge";

export type RealtimeNamespace = "pods" | "guilds" | "rooms";

export interface PresencePayload {
  namespace: RealtimeNamespace;
  roomId: string;
  count: number;
}

export interface JoinPayload {
  roomId?: string;
  room?: string;
  rooms?: string | string[];
}

export interface RealtimeServerOptions {
  /** Optional Socket.IO path (defaults to `/realtime`). */
  path?: string;
  /** Additional Socket.IO server options. */
  serverOptions?: Partial<ServerOptions>;
}

type SocketWithState = Socket & { data: { memberships?: Set<string> } };

type RoomMembershipMap = Map<string, Set<string>>;

type ExtractableRooms = string | string[] | JoinPayload | JoinPayload[] | undefined;

const DEFAULT_PATH = "/realtime";
const NAMESPACES: RealtimeNamespace[] = ["pods", "guilds", "rooms"];

const normaliseRoomId = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "object") {
    if ("roomId" in value) {
      return normaliseRoomId((value as JoinPayload).roomId);
    }
    if ("room" in value) {
      return normaliseRoomId((value as JoinPayload).room);
    }
  }
  return null;
};

const extractRooms = (input: ExtractableRooms): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    const rooms: string[] = [];
    input.forEach((entry) => {
      rooms.push(...extractRooms(entry));
    });
    return rooms;
  }
  if (typeof input === "string" || typeof input === "number" || typeof input === "bigint") {
    const room = normaliseRoomId(input);
    return room ? [room] : [];
  }
  const payload = input as JoinPayload;
  const rooms: string[] = [];
  const directRoom = normaliseRoomId(payload.room ?? payload.roomId);
  if (directRoom) {
    rooms.push(directRoom);
  }
  if (payload.rooms) {
    rooms.push(...extractRooms(payload.rooms));
  }
  return rooms;
};

const getMembershipSet = (socket: SocketWithState): Set<string> => {
  if (!socket.data.memberships) {
    socket.data.memberships = new Set<string>();
  }
  return socket.data.memberships;
};

const sendSnapshot = (
  socket: Socket,
  namespace: RealtimeNamespace,
  membership: RoomMembershipMap,
) => {
  membership.forEach((members, roomId) => {
    const payload: PresencePayload = {
      namespace,
      roomId,
      count: members.size,
    };
    socket.emit("presence", payload);
  });
};

const broadcastPresence = (
  namespace: Namespace,
  namespaceName: RealtimeNamespace,
  roomId: string,
  membership: RoomMembershipMap,
) => {
  const payload: PresencePayload = {
    namespace: namespaceName,
    roomId,
    count: membership.get(roomId)?.size ?? 0,
  };
  namespace.emit("presence", payload);
};

const joinRooms = (
  namespace: Namespace,
  namespaceName: RealtimeNamespace,
  socket: SocketWithState,
  membership: RoomMembershipMap,
  rooms: string[],
) => {
  if (!rooms.length) return;
  const trackedRooms = getMembershipSet(socket);

  rooms.forEach((roomId) => {
    if (!roomId || trackedRooms.has(roomId)) {
      return;
    }
    trackedRooms.add(roomId);
    let members = membership.get(roomId);
    if (!members) {
      members = new Set<string>();
      membership.set(roomId, members);
    }
    members.add(socket.id);
    socket.join(roomId);
    broadcastPresence(namespace, namespaceName, roomId, membership);
  });
};

const leaveRooms = (
  namespace: Namespace,
  namespaceName: RealtimeNamespace,
  socket: SocketWithState,
  membership: RoomMembershipMap,
  rooms: string[],
) => {
  if (!rooms.length) return;
  const trackedRooms = getMembershipSet(socket);

  rooms.forEach((roomId) => {
    if (!roomId || !trackedRooms.delete(roomId)) {
      return;
    }
    const members = membership.get(roomId);
    if (members) {
      members.delete(socket.id);
      if (members.size === 0) {
        membership.delete(roomId);
      }
    }
    socket.leave(roomId);
    broadcastPresence(namespace, namespaceName, roomId, membership);
  });
};

const configureNamespace = (namespace: Namespace, namespaceName: RealtimeNamespace) => {
  const membership: RoomMembershipMap = new Map();

  namespace.on("connection", (rawSocket) => {
    const socket = rawSocket as SocketWithState;

    const handshakeRooms = extractRooms(
      (socket.handshake.auth as ExtractableRooms) ??
        (socket.handshake.query as ExtractableRooms),
    );
    if (handshakeRooms.length > 0) {
      joinRooms(namespace, namespaceName, socket, membership, handshakeRooms);
    }

    sendSnapshot(socket, namespaceName, membership);

    socket.on("join", (payload: ExtractableRooms) => {
      const rooms = extractRooms(payload);
      joinRooms(namespace, namespaceName, socket, membership, rooms);
    });

    socket.on("leave", (payload: ExtractableRooms) => {
      const rooms = extractRooms(payload);
      leaveRooms(namespace, namespaceName, socket, membership, rooms);
    });

    socket.on("disconnecting", () => {
      const rooms = Array.from(getMembershipSet(socket));
      leaveRooms(namespace, namespaceName, socket, membership, rooms);
    });
  });
};

export const bootstrapRealtime = (
  httpServer: HttpServer,
  options: RealtimeServerOptions = {},
) => {
  const { path = DEFAULT_PATH, serverOptions = {} } = options;
  const io = new Server(httpServer, { path, ...serverOptions });

  NAMESPACES.forEach((namespaceName) => {
    const namespace = io.of(`/${namespaceName}`);
    registerBridgeMiddleware(namespace, {
      namespaceName,
      logger: console,
    });
    configureNamespace(namespace, namespaceName);
  });

  return io;
};

const isDirectExecution = (): boolean => {
  if (typeof import.meta === "undefined") {
    return false;
  }
  const currentPath = fileURLToPath(import.meta.url);
  const entryPath = process.argv[1];
  if (!entryPath) return false;
  return entryPath === currentPath || entryPath === currentPath.replace(/\.ts$/u, ".js");
};

if (isDirectExecution()) {
  const port = Number.parseInt(process.env.REALTIME_PORT ?? process.env.PORT ?? "8082", 10);
  const server = createServer();
  bootstrapRealtime(server);
  server.listen(port, () => {
    console.log(`Realtime server listening on port ${port}`);
  });
}
