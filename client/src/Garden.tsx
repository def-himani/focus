import { useCallback, useEffect, useRef, useState } from 'react'

type Plant = { key: string; name: string; price: number; art: string }
type GardenState = {
  balance: number
  progress: number
  catalog: Plant[]
  plants: { plantKey: string; slot: number }[]
}

function Artwork({ plant }: { plant: Plant }) {
  return (
    <span className="plant-art" role="img" aria-label={plant.name}>
      <img src={'/plants/' + plant.art + '.png'} alt="" />
      {plant.key === 'flowering-cactus' && (
        <img className="cactus-flower" src="/plants/blossom.png" alt="" />
      )}
    </span>
  )
}

export function Garden({ revision }: { revision?: number }) {
  const [state, setState] = useState<GardenState>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const purchase = useRef<{ key: string; plantKey: string } | undefined>(undefined)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const seq = ++sequence.current
    try {
      const response = await fetch('/api/garden')
      if (!response.ok) throw Error()
      const garden = await response.json()
      if (sequence.current === seq) setState(garden)
    } catch {
      if (sequence.current === seq) setMessage('Could not load the garden.')
    }
  }, [])
  useEffect(() => {
    void load()
    return () => {
      sequence.current++
    }
  }, [load, revision])
  useEffect(() => {
    const channel = new BroadcastChannel('focus-garden')
    channel.onmessage = load
    window.addEventListener('focus', load)
    return () => {
      channel.close()
      window.removeEventListener('focus', load)
    }
  }, [load])
  async function buy(plant: Plant) {
    if (busy) return
    setBusy(true)
    if (purchase.current?.plantKey !== plant.key)
      purchase.current = { key: crypto.randomUUID(), plantKey: plant.key }
    try {
      const response = await fetch('/api/garden/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchase.current),
      })
      if (!response.ok) throw Error(await response.json())
      const garden: GardenState = await response.json()
      sequence.current++
      setState(garden)
      purchase.current = undefined
      setMessage(plant.name + ' planted.')
      const channel = new BroadcastChannel('focus-garden')
      channel.postMessage('purchase')
      channel.close()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Purchase could not be confirmed.')
      void load()
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="garden-heading">
        <h1>Succulent garden</h1>
        {state && (
          <span className="wallet">
            <i aria-hidden="true">◉</i> {state.balance} {state.balance === 1 ? 'coin' : 'coins'}
          </span>
        )}
      </div>
      <p role="status">{message}</p>
      {!state ? (
        <button onClick={load}>Reload garden</button>
      ) : (
        <>
          <section aria-label="Planted collection" className="conservatory">
            <div className="garden-sky" aria-hidden="true">
              <i />
              <b />
            </div>
            <div className="plant-bed">
              {state.plants.map((owned) => {
                const plant = state.catalog.find((p) => p.key === owned.plantKey)!
                return (
                  <div className="planted" key={owned.slot}>
                    <Artwork plant={plant} />
                  </div>
                )
              })}
            </div>
            {!state.plants.length && <p className="empty-bed">Your first plant will appear here.</p>}
          </section>
          <div className="shop-heading">
            <h2>Plant shop</h2>
            <small>{Math.floor(state.progress * 100)}% toward your next coin</small>
          </div>
          <div className="shop">
            {state.catalog.map((p) => (
              <article key={p.key}>
                <Artwork plant={p} />
                <h3>{p.name}</h3>
                <button
                  disabled={busy || state.balance < p.price}
                  onClick={() => void buy(p)}
                  aria-label={'Buy ' + p.name + ' for ' + p.price + (p.price === 1 ? ' coin' : ' coins')}
                >
                  Plant · {p.price} {p.price === 1 ? 'coin' : 'coins'}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}
