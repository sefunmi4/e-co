import { env } from "@e-co/config";
import { io } from "socket.io-client";

const gatewayUrl = env.web.gatewayUrl;

const isBrowser = typeof window !== "undefined";
const shouldConnect =
  isBrowser && (env.web.enableSocketIo || env.web.enableSocket);

const createNoopSocket = () => ({
  on: () => void 0,
  off: () => void 0,
  emit: () => void 0,
  connect: () => void 0,
  disconnect: () => void 0,
});

let socket = createNoopSocket();

if (shouldConnect) {
  try {
    const client = io(gatewayUrl, { autoConnect: false });
    client.on("connect_error", (error) => {
      console.warn(
        `Socket connection failed. Ensure the gateway at ${gatewayUrl} exposes a Socket.IO endpoint (set NEXT_PUBLIC_ENABLE_SOCKET_IO=false to silence this warning).`,
        error,
      );
    });
    client.connect();
    socket = client;
  } catch (error) {
    console.warn("Unable to initialise Socket.IO client", error);
    socket = createNoopSocket();
  }
}

export const socketEnabled = shouldConnect;

export default socket;
