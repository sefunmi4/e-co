import { io } from "socket.io-client";

const env = typeof process !== "undefined" ? process.env ?? {} : {};

const gatewayUrl =
  env.NEXT_PUBLIC_GATEWAY_URL ||
  env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

const isBrowser = typeof window !== "undefined";
const shouldConnect =
  isBrowser &&
  (env.NEXT_PUBLIC_ENABLE_SOCKET_IO === "true" ||
    env.NEXT_PUBLIC_ENABLE_SOCKET === "true");

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
