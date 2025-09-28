import { io } from "socket.io-client"

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

const socket = typeof window !== "undefined"
  ? io(apiUrl)
  : {
      on: () => void 0,
      off: () => void 0,
      emit: () => void 0,
    }

export default socket
