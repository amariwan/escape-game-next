import { expect, test } from '@playwright/test'

// GET erzeugt keine Gruppen: zweimal 404, kein Junk im Store.
test('GET auf unbekannten Code bleibt 404 (kein Auto-Create)', async ({ request }) => {
   const code = `ZZ${Date.now().toString(36).toUpperCase().slice(-4)}`
   for (let i = 0; i < 2; i += 1) {
      const check = await request.get(`/api/groups/${code}`)
      expect(check.status()).toBe(404)
   }
})

// Direkt-Link = expliziter Beitritt: Gerät wird registriert, Spiel startet.
test('Direkt-Link registriert Gerät und zeigt Intro', async ({ page, request }) => {
   const code = `ZZ${Date.now().toString(36).toUpperCase().slice(-4)}`
   await page.goto(`/play/${code}`)
   await expect(page.getByText('Willkommen im')).toBeVisible()

   const check = await request.get(`/api/groups/${code}`)
   expect(check.status()).toBe(200)
   const group = (await check.json()) as { memberCount: number }
   expect(group.memberCount).toBe(1)
})

// Scoreboard listet erstellte Gruppen.
test('Scoreboard zeigt Gruppen', async ({ page, request }) => {
   await request.post('/api/groups', { data: { name: 'E2E Score' } })
   await page.goto('/scoreboard')
   await expect(page.getByText('E2E Score').first()).toBeVisible()
})
