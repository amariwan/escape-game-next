import { afterEach, describe, expect, it } from 'vitest'
import {
   __closeRateLimitClient,
   __resetSolveRateLimits,
   checkSolveRateLimit,
   rateLimitBackend,
} from '../../lib/rate-limit.js'
import { HttpError } from '../../lib/types.js'

async function expectRateLimited(code: string, station: number): Promise<void> {
   try {
      await checkSolveRateLimit(code, station)
   } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(429)
      return
   }
   throw new Error('erwartet HttpError 429, aber kein Fehler')
}

afterEach(async () => {
   delete process.env.REDIS_URL
   await __resetSolveRateLimits()
   await __closeRateLimitClient()
})

describe('rate-limit memory-backend', () => {
   it('ohne REDIS_URL → memory, 12 frei, 13. blockiert', async () => {
      delete process.env.REDIS_URL
      expect(rateLimitBackend()).toBe('memory')
      const code = `M${Date.now().toString(36).toUpperCase()}`
      for (let i = 0; i < 12; i += 1) {
         await checkSolveRateLimit(code, 1)
      }
      await expectRateLimited(code, 1)
   })

   it('Zähler sind je Gruppe+Station getrennt', async () => {
      delete process.env.REDIS_URL
      const code = `S${Date.now().toString(36).toUpperCase()}`
      for (let i = 0; i < 12; i += 1) {
         await checkSolveRateLimit(code, 1)
      }
      await expectRateLimited(code, 1)
      // andere Station / andere Gruppe bleibt frei
      await checkSolveRateLimit(code, 2)
      await checkSolveRateLimit(`${code}X`, 1)
   })
})

describe('rate-limit redis-Ausfall', () => {
   it('toter Redis → fail-open, Spiel läuft weiter', async () => {
      process.env.REDIS_URL = 'redis://127.0.0.1:6399'
      expect(rateLimitBackend()).toBe('redis')
      const code = `F${Date.now().toString(36).toUpperCase()}`
      for (let i = 0; i < 5; i += 1) {
         await checkSolveRateLimit(code, 1)
      }
   }, 15000)
})

// Nur mit echtem Redis: TEST_LIVE_REDIS=1 REDIS_URL=redis://127.0.0.1:6379
// (Shell-URL sichern — afterEach räumt process.env nach jedem Test auf.)
const LIVE_REDIS_URL = process.env.REDIS_URL
describe.runIf(process.env.TEST_LIVE_REDIS === '1')('rate-limit live-redis', () => {
   it('12 frei, 13. blockiert — atomar über Redis', async () => {
      process.env.REDIS_URL = LIVE_REDIS_URL
      expect(rateLimitBackend()).toBe('redis')
      const code = `L${Date.now().toString(36).toUpperCase()}`
      for (let i = 0; i < 12; i += 1) {
         await checkSolveRateLimit(code, 3)
      }
      await expectRateLimited(code, 3)
   }, 15000)
})
