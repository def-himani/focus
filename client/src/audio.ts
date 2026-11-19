import { useEffect, useRef, useState } from 'react'
import type { Snapshot } from './timer'

function tone(ctx: AudioContext, hz: number, gain: number, length: number, delay = 0) {
  const osc = ctx.createOscillator(),
    amp = ctx.createGain(),
    at = ctx.currentTime + delay
  osc.frequency.value = hz
  amp.gain.setValueAtTime(Math.max(0.0001, gain), at)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(amp).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + length)
  osc.onended = () => {
    osc.disconnect()
    amp.disconnect()
  }
}

export function useAudio(
  timer: Snapshot | undefined,
  event: { completion: string | null; coins: number } | undefined,
) {
  const audio = useRef<AudioContext | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const playback = timer?.preferences.playback
  useEffect(() => {
    function unlock() {
      if (!window.AudioContext) return
      try {
        audio.current ??= new AudioContext()
        void audio.current
          .resume()
          .then(() => setUnlocked(true))
          .catch(() => {})
      } catch {
        /* Visual alerts remain available. */
      }
    }
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
      void audio.current?.close().catch(() => {})
    }
  }, [])
  const scheduled = timer?.active?.checks.find((c) => c.answeredAt === null)?.scheduledAt
  useEffect(() => {
    if (scheduled && timer?.preferences.promptSound && audio.current?.state === 'running')
      tone(audio.current, 660, 0.06, 0.25)
  }, [scheduled, timer?.preferences.promptSound])
  const lastEvent = useRef<typeof event>(undefined)
  useEffect(() => {
    if (!event || lastEvent.current === event) return
    lastEvent.current = event
    if (!event.completion) return
    if (playback?.bell && audio.current?.state === 'running') {
      tone(audio.current, 660, 0.13, 0.7)
      tone(audio.current, 990, 0.07, 0.85, 0.09)
    }
    if (playback?.notifications && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Focus', {
          body: event.completion + ' countdown complete.',
          tag: 'focus-complete',
        })
      } catch {
        /* Some browsers only support service-worker notifications. */
      }
    }
  }, [event, playback])
  const running = timer?.status === 'running' && timer.mode === 'focus'
  useEffect(() => {
    const ctx = audio.current
    if (!unlocked || !ctx || !running || !playback?.ticking || !playback.tickVolume) return
    const id = setInterval(() => tone(ctx, 720, playback.tickVolume * 0.0004, 0.035), 1000)
    return () => clearInterval(id)
  }, [unlocked, running, playback?.ticking, playback?.tickVolume])
  useEffect(() => {
    const ctx = audio.current
    if (!unlocked || !ctx || !running || !playback?.rain || !playback.rainVolume) return
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    let previous = 0
    for (let i = 0; i < samples.length; i++) {
      previous = (previous + 0.16 * (Math.random() * 2 - 1)) / 1.05
      samples[i] = previous
    }
    const source = ctx.createBufferSource(),
      gain = ctx.createGain()
    source.buffer = buffer
    source.loop = true
    gain.gain.value = playback.rainVolume * 0.003
    source.connect(gain).connect(ctx.destination)
    source.start()
    return () => {
      source.stop()
      source.disconnect()
      gain.disconnect()
    }
  }, [unlocked, running, playback?.rain, playback?.rainVolume])
}
