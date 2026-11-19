import { useCallback, useEffect, useRef, useState } from 'react'

// The server starts measuring only after the final beep. A hidden or delayed page cancels the start.
export function useCountIn(revision: number | undefined) {
  const [step, setStep] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = undefined
    setStep(0)
  }, [])
  useEffect(() => {
    const hide = () => {
      if (document.hidden) cancel()
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      cancel()
    }
  }, [revision, cancel])
  function begin(beep: (step: number) => void, start: () => void) {
    if (timer.current !== undefined) return
    const origin = Date.now()
    function tick(n: number) {
      const expected = origin + (3 - n) * 1000
      if (document.hidden || Math.abs(Date.now() - expected) > 650) return cancel()
      setStep(n)
      if (n === 0) {
        timer.current = undefined
        start()
        return
      }
      beep(n)
      timer.current = window.setTimeout(() => tick(n - 1), Math.max(0, expected + 1000 - Date.now()))
    }
    tick(3)
  }
  return { step, begin, cancel }
}
