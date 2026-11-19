import { useState } from 'react'
import { DurationPicker } from './DurationPicker'
import type { Preferences, Playback } from './timer'

export function TimerSettings({
  prefs,
  configure,
  disabled,
  active,
}: {
  prefs?: Preferences
  configure: (p: Partial<Preferences>) => void
  disabled: boolean
  active: boolean
}) {
  return (
    <aside>
      <h2>Timer settings</h2>
      <fieldset className="settings" disabled={disabled}>
        <DurationPicker
          label="Focus"
          presets={[30, 40, 50, 60]}
          seconds={prefs?.focusSeconds ?? 2400}
          onChange={(focusSeconds) => configure({ focusSeconds })}
        />
        <DurationPicker
          label="Break"
          presets={[5, 10]}
          seconds={prefs?.breakSeconds ?? 300}
          onChange={(breakSeconds) => configure({ breakSeconds })}
        />
        <DurationPicker
          label="Check-in"
          presets={[0, 5, 10, 20]}
          seconds={prefs?.checkSeconds ?? 0}
          onChange={(checkSeconds) => configure({ checkSeconds })}
        />
        {active && <small>Duration changes apply to the next block.</small>}
        <div className="switches">
          {(
            [
              ['promptSound', 'Check-in chime'],
              ['loop', 'Repeat cycle'],
              ['autoBreak', 'Auto-start break'],
              ['autoFocus', 'Auto-start next focus'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="checkbox"
                role="switch"
                checked={Boolean(prefs?.[key])}
                disabled={key === 'autoFocus' && !prefs?.loop}
                onChange={(e) => configure({ [key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </fieldset>
    </aside>
  )
}

export function SoundSettings({
  settings,
  testSound,
  testVoice,
  change,
  disabled,
}: {
  settings: Playback
  testSound: () => Promise<string>
  testVoice: () => string
  change: (p: Partial<Playback>) => void
  disabled: boolean
}) {
  const [message, setMessage] = useState('')
  async function notify(enable: boolean) {
    if (!enable) {
      change({ notifications: false })
      return
    }
    try {
      if (!('Notification' in window) || (await Notification.requestPermission()) !== 'granted') {
        setMessage('Desktop notifications require permission in your browser.')
        return
      }
      setMessage('')
      change({ notifications: true })
    } catch {
      setMessage('Desktop notifications are unavailable in this browser.')
    }
  }
  return (
    <aside>
      <h2>Sound and appearance</h2>
      <fieldset disabled={disabled} className="settings">
        <label>
          Color palette{' '}
          <select value={settings.theme} onChange={(e) => change({ theme: e.target.value })}>
            <option value="forest">Forest</option>
            <option value="slate">Twilight</option>
            <option value="plum">Plum</option>
          </select>
        </label>
        <div className="switches">
          {(
            [
              ['preStart', 'Three-second count-in'],
              ['speakTransitions', 'Announce session and break transitions'],
              ['remindTen', 'Speak at 10 minutes remaining'],
              ['remindFive', 'Speak at 5 minutes remaining'],
              ['remindOne', 'Speak at 1 minute remaining'],
              ['bell', 'Completion bell'],
              ['notifications', 'Desktop notifications'],
              ['ticking', 'Ticking'],
              ['rain', 'Rainfall'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                role="switch"
                type="checkbox"
                checked={settings[key]}
                onChange={(e) =>
                  key === 'notifications'
                    ? void notify(e.target.checked)
                    : change({ [key]: e.target.checked })
                }
              />
            </label>
          ))}
        </div>
        {(['alertVolume', 'voiceVolume', 'tickVolume', 'rainVolume'] as const).map((key) => (
          <label key={key}>
            {{ alertVolume: 'Alert', voiceVolume: 'Voice', tickVolume: 'Tick', rainVolume: 'Rain' }[key]}{' '}
            volume{' '}
            <select value={settings[key]} onChange={(e) => change({ [key]: +e.target.value })}>
              {[...new Set([0, 10, 25, 30, 50, 75, 100, settings[key]])]
                .sort((a, b) => a - b)
                .map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
            </select>
          </label>
        ))}
        <div className="chips">
          <button onClick={async () => setMessage(await testSound())}>Test sound</button>
          <button onClick={() => setMessage(testVoice())}>Test voice</button>
        </div>
        <small>
          Spoken cues use a local system voice. Keep Focus open and your device awake for alerts.
        </small>
        {message && <small role="status">{message}</small>}
      </fieldset>
    </aside>
  )
}
