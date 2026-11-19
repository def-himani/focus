import { useEffect, useRef, useState } from 'react'
import type { Snapshot, TimerEvent } from './timer'

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

function chime(ctx: AudioContext, volume: number) {
  if (!volume) return
  for (const [delay, pitch] of [
    [0, 660],
    [0.18, 830],
    [0.38, 988],
  ]) {
    tone(ctx, pitch, (0.3 * volume) / 100, 0.95, delay)
  }
}

function speak(words: string, volume: number) {
  if (!volume) return 'Voice volume is muted.'
  try {
    const synth = window.speechSynthesis
    const voices = synth?.getVoices().filter((v) => v.localService)
    const voice = voices?.find((v) => v.lang.startsWith('en')) ?? voices?.[0]
    if (!voice) return 'No local system voice is available in this browser.'
    const cue = new SpeechSynthesisUtterance(words)
    cue.voice = voice
    cue.lang = voice.lang
    cue.volume = volume / 100
    synth.cancel()
    synth.speak(cue)
    return ''
  } catch {
    return 'Speech is unavailable in this browser.'
  }
}

export function useAudio(timer: Snapshot | undefined, event: TimerEvent | undefined) {
  const audio = useRef<AudioContext | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const playback = timer?.preferences.playback
  useEffect(() => {
    window.speechSynthesis?.getVoices()
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
    if (
      scheduled &&
      timer?.preferences.promptSound &&
      playback?.alertVolume &&
      audio.current?.state === 'running'
    )
      tone(audio.current, 660, (0.09 * playback.alertVolume) / 100, 0.25)
  }, [scheduled, timer?.preferences.promptSound])
  useEffect(() => {
    if (playback?.voiceVolume === 0) window.speechSynthesis?.cancel()
  }, [playback?.voiceVolume])
  const lastEvent = useRef<typeof event>(undefined)
  useEffect(() => {
    if (!event || lastEvent.current === event) return
    lastEvent.current = event
    if (Date.now() - event.cueAt > 5000) return
    if (event.spoken && playback) speak(event.spoken, playback.voiceVolume)
    if (!event.completion || !event.freshCompletion) return
    if (playback?.bell && audio.current?.state === 'running') chime(audio.current, playback.alertVolume)
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
  return {
    beep(step: number) {
      const ctx = audio.current
      const volume = playback?.alertVolume
      if (!ctx || !volume) return
      const at = Date.now()
      void ctx
        .resume()
        .then(() => {
          if (Date.now() - at < 400) tone(ctx, [880, 740, 622][step - 1], (0.23 * volume) / 100, 0.18)
        })
        .catch(() => {})
    },
    async testSound() {
      if (!playback?.alertVolume) return 'Alert volume is muted.'
      try {
        audio.current ??= new AudioContext()
        await audio.current.resume()
        chime(audio.current, playback.alertVolume)
        return 'Playing test sound.'
      } catch {
        return 'Sound is unavailable in this browser.'
      }
    },
    testVoice: () => speak('Focus voice test.', playback?.voiceVolume ?? 0) || 'Playing test voice.',
  }
}
