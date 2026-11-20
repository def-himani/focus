import { test, expect, type APIRequestContext } from '@playwright/test'

async function configure(request: APIRequestContext, seconds: number, checkSeconds = 0) {
  const timer = await (await request.get('/api/timer')).json()
  const response = await request.post('/api/timer/settings', {
    data: {
      revision: timer.revision,
      preferences: {
        ...timer.preferences,
        focusSeconds: seconds,
        checkSeconds,
        loop: false,
        autoBreak: false,
      },
    },
  })
  expect(response.ok()).toBeTruthy()
}

test('verified work buys a local plant once and survives reopening', async ({ page, request }) => {
  await configure(request, 2)
  const external: string[] = []
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') {
      external.push(route.request().url())
      return route.abort()
    }
    return route.continue()
  })
  const before = await (await request.get('/api/garden')).json()
  await page.goto('/')
  await page.getByRole('button', { name: 'Start focus', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'countdown complete' })).toContainText(
    '+2 coins',
  )
  await page.getByRole('button', { name: 'Garden', exact: true }).click()
  const plant = page.getByRole('button', { name: 'Buy Desert cactus for 1 coin' })
  await plant.click()
  await expect(page.getByText('Desert cactus planted.')).toBeVisible()
  await expect(page.locator('.planted')).toHaveCount(before.plants.length + 1)
  await page.reload()
  await page.getByRole('button', { name: 'Garden', exact: true }).click()
  await expect(page.locator('.wallet')).toContainText(String(before.balance + 1))
  await expect(page.locator('.planted img').first()).toBeVisible()
  expect(
    await page
      .locator('.shop img')
      .evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0)),
  ).toBe(true)
  expect(external).toEqual([])
})

test('settings persist, full screen preserves a quick start and its subject', async ({
  page,
  request,
}) => {
  await configure(request, 2400)
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Color palette').selectOption('plum')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'plum')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'plum')
  await page.getByLabel('Subject', { exact: true }).fill('Botanical sketches')
  await page.getByRole('button', { name: 'Just start — 2 min' }).click()
  await page.getByRole('button', { name: 'Full screen', exact: true }).click()
  await expect(page.locator('.timer-card.expanded')).toBeVisible()
  await page.getByRole('button', { name: 'Continue to 40:00 total' }).click()
  await page.getByRole('button', { name: 'Exit full screen' }).click()
  await page.getByRole('button', { name: 'Stop & save' }).click()
  await expect(page.getByRole('cell', { name: 'Botanical sketches', exact: true }).first()).toBeVisible()
})

test('a linked task, mixed review and make-up flow into history and daily reports', async ({
  page,
  request,
}) => {
  await configure(request, 5, 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await button('To-Dos').click()
  await page.getByLabel('To-do title').fill('Read Book ABC')
  await page.getByLabel('Estimated effort (minutes, optional)').fill('900')
  await button('Add to-do').click()
  await expect(page.getByText('Read Book ABC', { exact: true })).toBeVisible()
  await button('Focus').click()
  await expect(page.locator('.overlay')).toContainText('Read Book ABC')
  await page.getByLabel('Subject', { exact: true }).fill('Read Book ABC · To-do')
  await page.getByLabel('Session title').fill('Chapter one')
  await button('Start focus').click()
  await button('Full screen').click()
  await expect(page.locator('.expanded').getByRole('dialog', { name: 'Still focusing?' })).toBeVisible()
  await expect(page.getByText('Still focusing?', { exact: true })).toBeVisible()
  await expect(page.getByText('Review your focus time', { exact: true })).toBeVisible({ timeout: 10000 })
  await button('Mixed').click()
  await page.getByLabel('Most recent off-task minutes').fill('0.05')
  await button('Save classification').click()
  await page.getByRole('button', { name: /Make up/ }).click()
  await expect(page.getByText('Review your focus time', { exact: true })).toBeVisible()
  await button('Focused throughout').click()
  await expect(button('Start focus')).toBeEnabled()
  await button('Exit full screen').click()
  await button('History').click()
  await expect(page.getByRole('cell', { name: 'Chapter one', exact: true })).toBeVisible()
  await button('Statistics').click()
  await page.getByRole('combobox', { name: 'Report', exact: true }).selectOption('study')
  await expect(page.getByRole('cell', { name: 'Chapter one', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('ambience and completion alerts follow saved preferences and browser permission', async ({
  page,
  request,
}) => {
  await configure(request, 3)
  // Capture browser API calls without requiring an OS notification center or speaker.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Notification', {
      value: class {
        static permission = 'default'
        static async requestPermission() {
          this.permission = sessionStorage.getItem('grant') ?? 'denied'
          return this.permission
        }
        constructor(_title: string, options: NotificationOptions) {
          document.documentElement.dataset.alertBody = options.body
        }
      },
    })
    const createOscillator = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      const element = document.documentElement
      element.dataset.tones = String(Number(element.dataset.tones ?? 0) + 1)
      return createOscillator.call(this)
    }
    const createSource = AudioContext.prototype.createBufferSource
    AudioContext.prototype.createBufferSource = function () {
      document.documentElement.dataset.rain = 'started'
      return createSource.call(this)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const notifications = page.getByRole('switch', { name: 'Desktop notifications' })
  await notifications.click()
  await expect(page.getByText('Desktop notifications require permission in your browser.')).toBeVisible()
  await expect(notifications).not.toBeChecked()
  await page.evaluate(() => sessionStorage.setItem('grant', 'granted'))
  await notifications.click()
  await expect(notifications).toBeChecked()
  for (const name of ['Ticking', 'Rainfall']) {
    await page.getByRole('switch', { name }).click()
    await expect(page.getByRole('switch', { name })).toBeChecked()
  }
  await page.getByLabel('Rain volume').selectOption('50')
  await expect(page.getByLabel('Rain volume')).toHaveValue('50')
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  await page.getByRole('button', { name: 'Start focus', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-rain', 'started')
  await expect(page.locator('html')).toHaveAttribute('data-alert-body', /focus countdown complete/i)
  await expect
    .poll(() => page.locator('html').getAttribute('data-tones').then(Number))
    .toBeGreaterThanOrEqual(3)
  await page.reload()
  await page.getByText('Sound and appearance', { exact: true }).first().click()
  await expect(page.getByRole('switch', { name: 'Ticking' })).toBeChecked()
  await expect(page.getByLabel('Rain volume')).toHaveValue('50')
})

test('stopwatch survives reload and saves a recategorizable entry outside verified focus', async ({
  page,
  request,
}) => {
  const wallet = await (await request.get('/api/garden')).json()
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await page.goto('/')
  await button('Stopwatch').click()
  await button('Start stopwatch').click()
  await expect(page.getByRole('timer')).toHaveText('00:01')
  await button('Full screen').click()
  await expect(page.locator('.expanded .overlay')).toBeVisible()
  await button('Exit full screen').click()
  await page.reload()
  await button('Pause stopwatch').click()
  await expect(button('Pomodoro')).toBeDisabled()
  await button('Resume stopwatch').click()
  await button('Full screen').click()
  await button('Stop and save').click()
  await expect(page.locator('.timer-card.expanded')).toHaveCount(0)
  await page.getByLabel('Distracted time (optional, minutes)').fill('0.01')
  await expect(page.getByLabel('Category')).toContainText('General Activity')
  await page.getByLabel('Category').selectOption('new')
  await page.getByLabel('New activity name').fill('Walk')
  await page.getByLabel('Notes', { exact: true }).fill('Walked outside')
  await button('Save entry').click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await button('History').click()
  await page.locator('summary').filter({ hasText: 'Walk' }).click()
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Walked outside')
  await page.getByLabel('Category').selectOption('0')
  await button('Save entry').click()
  await expect(page.locator('summary').filter({ hasText: 'Uncategorized' })).toBeVisible()
  await button('Statistics').click()
  await expect(page.getByText('Stopwatch activity')).toBeVisible()
  expect((await (await request.get('/api/garden')).json()).balance).toBe(wallet.balance)
})

test('inline editing, reusable activities, keyboard subject search and full-screen overlay', async ({
  page,
}) => {
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await page.goto('/')
  await button('To-Dos').click()
  await page.getByLabel('To-do title').fill('Review notes')
  await button('Add to-do').click()
  const row = page.locator('.subject-row').filter({ hasText: 'Review notes' })
  await row.getByRole('button', { name: 'Edit', exact: true }).click()
  const editor = page.getByRole('form', { name: 'Edit Review notes', exact: true })
  await editor.getByLabel('To-do title').fill('Review field notes')
  await editor.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('.subject-row').filter({ hasText: 'Review field notes' })).toBeVisible()
  await page.getByLabel('Activity name').fill('Watercolors')
  await button('Add activity').click()
  await expect(page.locator('.subject-row').filter({ hasText: 'Watercolors' })).toBeVisible()
  await button('Focus').click()
  const subject = page.getByRole('combobox', { name: 'Subject', exact: true })
  await subject.fill('waterc')
  await expect(page.getByRole('option', { name: /Watercolors/ })).toBeVisible()
  await subject.press('ArrowDown')
  await subject.press('Enter')
  await expect(subject).toHaveValue('Watercolors · Activity')
  await page.setViewportSize({ width: 390, height: 820 })
  await button('Full screen').click()
  const overlay = page.locator('.expanded .overlay')
  await expect(overlay).toContainText('Review field notes')
  const panel = await overlay.boundingBox(),
    dial = await page.getByRole('timer').boundingBox()
  expect(panel!.x).toBeGreaterThan(170)
  expect(panel!.y + panel!.height).toBeLessThan(dial!.y)
  await button('Exit full screen').click()
})

test('three beeps precede measurement, canceled starts are discarded, and voice uses only a local voice', async ({
  page,
  request,
}) => {
  await configure(request, 2)
  await page.addInitScript(() => {
    const html = () => document.documentElement.dataset
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [
          { localService: false, lang: 'en-US', name: 'Online' },
          { localService: true, lang: 'en-US', name: 'Local' },
        ],
        cancel: () => {},
        speak: (u: SpeechSynthesisUtterance) => {
          html().speech = u.text + '/' + u.voice?.name + '/' + u.volume
        },
      },
    })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        constructor(public text: string) {}
      },
    })
    const create = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      html().tones = String(Number(html().tones ?? 0) + 1)
      return create.call(this)
    }
  })
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await page.goto('/')
  await button('Settings').click()
  for (const name of ['Three-second count-in', 'Announce session and break transitions']) {
    const toggle = page.getByRole('switch', { name })
    await toggle.click()
    await expect(toggle).toBeChecked()
  }
  await page.getByLabel('Voice volume').selectOption('50')
  await expect(page.getByLabel('Voice volume')).toHaveValue('50')
  await button('Test voice').click()
  await expect(page.locator('html')).toHaveAttribute('data-speech', 'Focus voice test./Local/0.5')
  await page.getByLabel('Alert volume').selectOption('0')
  await expect(page.getByLabel('Alert volume')).toHaveValue('0')
  await button('Test sound').click()
  await expect(page.getByText('Alert volume is muted.')).toBeVisible()
  await page.getByLabel('Alert volume').selectOption('75')
  await expect(page.getByLabel('Alert volume')).toHaveValue('75')
  await button('Focus').click()
  await button('Start focus').click()
  await button('Cancel start').click()
  expect((await (await request.get('/api/timer')).json()).active).toBeNull()
  const count = Number(await page.locator('html').getAttribute('data-tones'))
  await button('Start focus').click()
  await expect(page.getByText('Starting in 1')).toBeVisible()
  expect((await (await request.get('/api/timer')).json()).active).toBeNull()
  expect(Number(await page.locator('html').getAttribute('data-tones'))).toBe(count + 3)
  await expect(button('Pause')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-speech', 'Focus session complete./Local/0.5')
  const last = (await (await request.get('/api/timer')).json()).history[0]
  expect(last.effectiveMs).toBe(2000)
})

test('sound settings handle missing local speech and notifications', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined })
    Reflect.deleteProperty(window, 'Notification')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Test voice' }).click()
  await expect(page.getByText('No local system voice is available in this browser.')).toBeVisible()
  const notifications = page.getByRole('switch', { name: 'Desktop notifications' })
  if (await notifications.isChecked()) {
    await notifications.click()
    await expect(notifications).not.toBeChecked()
  }
  await notifications.click()
  await expect(page.getByText('Desktop notifications require permission in your browser.')).toBeVisible()
  await expect(notifications).not.toBeChecked()
})

test('Study Day controls, cancel, weekly and monthly drill-down, timeline and saved entry disposal', async ({
  page,
  request,
}) => {
  await configure(request, 600)
  const snap = await (await request.get('/api/timer')).json()
  await request.post('/api/timer/settings', {
    data: {
      revision: snap.revision,
      preferences: { ...snap.preferences, playback: { ...snap.preferences.playback, preStart: false } },
    },
  })
  await page.goto('/')
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  const done = button('Done for the Day')
  if (
    (await (await request.get('/api/journal')).json()).days.some(
      (d: { end: number | null }) => d.end === null,
    )
  ) {
    page.once('dialog', (d) => d.accept())
    await done.click()
  }
  await button('Start Day').click()
  await expect(done).toBeVisible()
  await button('Start focus').click()
  await button('Full screen').click()
  await expect(button('Exit full screen')).toBeVisible()
  // Native confirmation dialogs can exit browser full-screen mode.
  await page.evaluate(() => {
    const confirm = window.confirm
    window.confirm = (message) => {
      window.confirm = confirm
      return message.startsWith('Discard this Pomodoro?')
    }
  })
  await button('Cancel & Discard').click()
  await expect(button('Start focus')).toBeEnabled()
  await button('Exit full screen').click()
  await expect(page.locator('.timer-card.expanded, .timer-card:fullscreen')).toHaveCount(0)
  await page.getByLabel('Subject', { exact: true }).fill('Log practice')
  await page.getByLabel('Session title').fill('Trace intervals')
  await button('Start focus').click()
  await button('Pause').click()
  await button('Resume').click()
  await button('Stop & save').click()
  await expect(page.getByRole('cell', { name: 'Trace intervals', exact: true })).toBeVisible()
  await button('Activity Log').click()
  const row = page.locator('.log-week tbody tr').filter({ hasText: 'Log practice' })
  await expect(row).toBeVisible()
  await row.locator('td button').click()
  const dayDetails = page.getByRole('region', { name: 'Day details' })
  await expect(dayDetails).toContainText('Trace intervals')
  const studyDate = await dayDetails.getByRole('heading', { level: 2 }).innerText()
  await button('Monthly').click()
  const cell = page.locator('.month-grid').getByRole('button', { name: studyDate, exact: true })
  await cell.click()
  await page.getByRole('button', { name: /Trace intervals · View entry/ }).click()
  await expect(page.getByRole('heading', { name: 'Session history' })).toBeVisible()
  const detail = page
    .locator('details[open]')
    .filter({ has: page.getByRole('heading', { name: 'Recorded intervals' }) })
  await detail.locator('.interactive-timeline button').first().focus()
  await expect(detail.locator('[aria-live="polite"]')).toContainText('focus')
  page.once('dialog', (d) => d.accept())
  await detail.getByRole('button', { name: 'Discard entry' }).click()
  await expect(detail).toHaveCount(0)
  await button('Activity Log').click()
  await expect(row).toHaveCount(0)
})

test('task cards support completion, archive, restoration and deliberate deletion', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'To-Dos', exact: true }).click()
  await page.getByLabel('To-do title').fill('Test card controls')
  await page.getByRole('button', { name: 'Add to-do' }).click()
  const card = page.locator('article').filter({ hasText: 'Test card controls' })
  await card.getByRole('checkbox', { name: 'Complete' }).click()
  await expect(card.getByRole('checkbox', { name: 'Reopen' })).toBeChecked()
  await card.getByRole('checkbox', { name: 'Reopen' }).click()
  await expect(card.getByRole('checkbox', { name: 'Complete' })).toBeVisible()
  await card.locator('summary').click()
  await card.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(card.getByRole('checkbox')).toHaveCount(0)
  await page.getByText('Archived to-dos and activities', { exact: true }).click()
  await card.locator('summary').click()
  await card.getByRole('button', { name: 'Restore' }).click()
  await expect(card.getByRole('checkbox', { name: 'Complete' })).toBeVisible()
  await card.locator('summary').click()
  page.once('dialog', (d) => d.accept())
  await card.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(card).toHaveCount(0)
})
