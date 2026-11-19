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
  await expect(page.getByText('Still studying?', { exact: true })).toBeVisible()
  await expect(page.getByText('Review your focus time', { exact: true })).toBeVisible({ timeout: 10000 })
  await button('Mixed').click()
  await page.getByLabel('Most recent off-task minutes').fill('0.05')
  await button('Save classification').click()
  await page.getByRole('button', { name: /Make up/ }).click()
  await expect(page.getByText('Review your focus time', { exact: true })).toBeVisible()
  await button('All focused').click()
  await expect(button('Start focus')).toBeEnabled()
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
  await page.reload()
  await button('Pause stopwatch').click()
  await expect(button('Pomodoro')).toBeDisabled()
  await button('Resume stopwatch').click()
  await button('Stop and save').click()
  await expect(page.getByLabel('Category')).toContainText('General Activity')
  await page.getByLabel('Category').selectOption('new')
  await page.getByLabel('New activity name').fill('Walk')
  await page.getByLabel('Notes', { exact: true }).fill('Walked outside')
  await button('Save category and notes').click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await button('History').click()
  await page.locator('summary').filter({ hasText: 'Walk' }).click()
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Walked outside')
  await page.getByLabel('Category').selectOption('0')
  await button('Save category and notes').click()
  await expect(page.locator('summary').filter({ hasText: 'Uncategorized' })).toBeVisible()
  await button('Statistics').click()
  await expect(page.getByText('Stopwatch measured')).toBeVisible()
  expect((await (await request.get('/api/garden')).json()).balance).toBe(wallet.balance)
})
