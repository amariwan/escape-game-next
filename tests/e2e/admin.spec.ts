import { expect, test } from '@playwright/test'

// Spielleitung: Timer starten, Modus wechseln, Stationen sperren/entsperren.
test('Admin steuert Timer, Modus und Freigaben', async ({ page, request }) => {
   const created = await request.post('/api/groups', { data: { name: 'E2E Admin' } })
   expect(created.ok()).toBe(true)
   const { code } = (await created.json()) as { code: string }

   await page.goto(`/admin/${code}`)
   await expect(page.locator('.topbar', { hasText: 'SPIELLEITUNG' })).toBeVisible()

   await page.getByRole('button', { name: 'Start', exact: true }).click()
   await expect(page.getByText(/Status: läuft/)).toBeVisible()

   await page.getByRole('button', { name: '90 Min' }).click()
   await expect(page.getByRole('button', { name: '90 Min' })).toBeVisible()

   // Station 5 ist linear gesperrt → freigeben → „offen"
   const card5 = page.locator('[data-slot="card"]', { hasText: 'Station 05' })
   await expect(card5.getByText('gesperrt')).toBeVisible()
   await card5.getByRole('button', { name: 'Freigeben' }).click()
   await expect(card5.getByText('offen')).toBeVisible()
   await card5.getByRole('button', { name: 'Sperren' }).click()
   await expect(card5.getByText('gesperrt')).toBeVisible()
})
