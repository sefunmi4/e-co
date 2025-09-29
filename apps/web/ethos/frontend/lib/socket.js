import { io } from "socket.io-client"

const gatewayUrl =
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080"

const socket = typeof window !== "undefined"
  ? io(gatewayUrl)
  : {
      on: () => void 0,
      off: () => void 0,
      emit: () => void 0,
    }

export default socket
