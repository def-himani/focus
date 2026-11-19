import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

function Focus() {
  const [connection, setConnection] = useState<'checking' | 'ready' | 'offline'>('checking')
  useEffect(() => {
    const controller = new AbortController()
    async function checkHealth() {
      try {
        const response = await fetch('/api/health', { signal: controller.signal })
        const healthy = response.ok && (await response.json()).status === 'healthy'
        setConnection(healthy ? 'ready' : 'offline')
      } catch {
        if (!controller.signal.aborted) setConnection('offline')
      }
    }
    void checkHealth()
    return () => controller.abort()
  }, [])

  const messages = {
    checking: 'Connecting to the local API…',
    ready: 'Connected to the local API',
    offline: 'Local API unavailable. Start the server and reload.',
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-8">
      <h1 className="mb-6 text-6xl font-semibold tracking-tight">Focus</h1>
      <p role="status" className="flex items-center gap-3 text-stone-300">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${connection === 'ready' ? 'bg-teal-300' : 'bg-stone-400'}`} />
        {messages[connection]}
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Focus />)
