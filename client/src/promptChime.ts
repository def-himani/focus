import { useEffect, useRef } from 'react'
import type { Snapshot } from './timer'

export function usePromptChime(timer?: Snapshot) {
  const audio = useRef<AudioContext | null>(null)
  const enabled = timer?.preferences.promptSound
  useEffect(() => {
    if (!enabled || !window.AudioContext) return
    function unlock() {
      audio.current ??= new AudioContext()
      void audio.current.resume().catch(() => {})
    }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
      void audio.current?.close().catch(() => {})
      audio.current = null
    }
  }, [enabled])
  const scheduled = timer?.active?.checks.find((c) => c.answeredAt === null)?.scheduledAt
  useEffect(() => {
    const context = audio.current
    if (!scheduled || !enabled || context?.state !== 'running') return
    const tone = context.createOscillator(),
      volume = context.createGain()
    tone.frequency.value = 660
    volume.gain.setValueAtTime(0.06, context.currentTime)
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25)
    tone.connect(volume).connect(context.destination)
    tone.start()
    tone.stop(context.currentTime + 0.25)
  }, [scheduled, enabled])
}
