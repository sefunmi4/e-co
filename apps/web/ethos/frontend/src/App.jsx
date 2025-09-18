import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { useEffect } from 'react'
import { useToast } from "@/components/ui/use-toast"
import socket from "@/lib/socket"

function App() {
  const { toast } = useToast()

  useEffect(() => {
    socket.on('notification', n => {
      toast({ title: 'Notification', description: n.content })
    })
    socket.on('partyMessage', m => {
      toast({ title: `Party ${m.party_id}`, description: m.message })
    })
    return () => {
      socket.off('notification')
      socket.off('partyMessage')
    }
  }, [toast])

  return (
    <>
      <Pages />
      <Toaster />
    </>
  )
}

export default App