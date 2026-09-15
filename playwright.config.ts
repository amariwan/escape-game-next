import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// E2E läuft gegen einen isolierten Store — echte data/groups.json bleibt sauber.
const here = path.dirname(fileURLToPath(import.meta.url))
const storePath = path.join(here, 'test-results', 'e2e-store', 'groups.json')

export default defineConfig({
   testDir: './tests/e2e',
   fullyParallel: false,
   retries: 0,
   reporter: 'list',
   use: {
      baseURL: 'http://localhost:5200',
      trace: 'retain-on-failure',
   },
   // Kalte Turbopack-Compiles beim ersten Treffer brauchen Luft.
   timeout: 60_000,
   expect: { timeout: 15_000 },
   projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
   webServer: {
      command: 'npm run dev',
      url: 'http://localhost:5200',
      reuseExistingServer: !process.env.CI,
      env: { GROUP_STORE_PATH: storePath },
      timeout: 120_000,
   },
})
