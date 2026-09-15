import { expect, test } from '@playwright/test'

// Voller Spieler-Loop: Gruppe erstellen → Station 1 lösen → Station 2 offen.
test('Spieler löst Station 1 und schaltet Station 2 frei', async ({ page }) => {
   await page.goto('/')
   await page.getByLabel('Gruppen-Name').fill('E2E Team')
   await page.getByRole('button', { name: 'Neue Gruppe erstellen' }).click()
   await expect(page.getByText('Gruppe bereit')).toBeVisible()

   const code = (await page.locator('.title .accent').last().textContent())?.trim() ?? ''
   expect(code).toMatch(/^[A-Z2-9]{6}$/)

   await page.getByRole('link', { name: 'Teamgerät starten' }).click()
   await expect(page).toHaveURL(new RegExp(`/play/${code}`))

   // Intro → QR (Fallback-Button, Video-Autoplay ist flaky) → Stationen
   await page.getByRole('button', { name: /QR-Code öffnen/ }).click()
   await page.getByRole('button', { name: /Stationen öffnen/ }).click()

   await expect(page.getByText('Der manipulierte Bericht')).toBeVisible()
   await page.getByPlaceholder('___').fill('26')
   await page.getByRole('button', { name: 'Eingeben' }).click()
   // Erfolgsmeldung ist stabil (Polls überschreiben sie nicht mehr)
   await expect(page.getByText(/validiert/)).toBeVisible()
   await expect(page.getByRole('button', { name: '✓' })).toBeDisabled()

   // Station 2 per Sprungnavigation öffnen (Poll bestätigt Unlock)
   await page.getByRole('button', { name: 'Station 2', exact: true }).click()
   await expect(page.getByText('Das geschredderte Dokument')).toBeVisible()
})
