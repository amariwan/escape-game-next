import { describe, expect, it } from 'vitest'
import { elapsedMs, formatMMSS, remainingLabel, remainingMs, timerStatus } from '../../lib/time.js'
import type { GroupSettings } from '../../lib/types.js'

function settings(over: Partial<GroupSettings> = {}): GroupSettings {
   return {
      mode: 'linear',
      timerMinutes: 60,
      startedAt: null,
      pausedAt: null,
      elapsedPauseMs: 0,
      finishedAt: null,
      revealFinale: false,
      ...over,
   }
}

const T0 = Date.parse('2026-01-01T10:00:00.000Z')

describe('elapsedMs', () => {
   it('null vor Start', () => {
      expect(elapsedMs(settings(), T0)).toBeNull()
   })

   it('läuft ab startedAt', () => {
      const s = settings({ startedAt: new Date(T0).toISOString() })
      expect(elapsedMs(s, T0 + 90_000)).toBe(90_000)
   })

   it('Bonus (positives elapsedPauseMs) verlängert', () => {
      const s = settings({ startedAt: new Date(T0).toISOString(), elapsedPauseMs: 5 * 60_000 })
      expect(elapsedMs(s, T0 + 90_000)).toBe(0)
      expect(elapsedMs(s, T0 + 400_000)).toBe(100_000)
   })

   it('friert bei Pause und Finish ein', () => {
      const s = settings({
         startedAt: new Date(T0).toISOString(),
         pausedAt: new Date(T0 + 60_000).toISOString(),
      })
      expect(elapsedMs(s, T0 + 600_000)).toBe(60_000)
      const f = settings({
         startedAt: new Date(T0).toISOString(),
         finishedAt: new Date(T0 + 120_000).toISOString(),
      })
      expect(elapsedMs(f, T0 + 600_000)).toBe(120_000)
   })
})

describe('remainingMs / remainingLabel', () => {
   it('volles Budget vor Start', () => {
      expect(remainingLabel(settings(), T0)).toBe('60:00')
      expect(remainingMs(settings(), T0)).toBeNull()
   })

   it('zählt runter', () => {
      const s = settings({ startedAt: new Date(T0).toISOString() })
      expect(remainingLabel(s, T0 + 90_000)).toBe('58:30')
   })

   it('nie negativ', () => {
      const s = settings({ startedAt: new Date(T0).toISOString() })
      expect(remainingMs(s, T0 + 10 * 3_600_000)).toBe(0)
   })
})

describe('formatMMSS / timerStatus', () => {
   it('formatiert Minuten:Sekunden', () => {
      expect(formatMMSS(90_000)).toBe('01:30')
      expect(formatMMSS(0)).toBe('00:00')
   })

   it('Statusworte', () => {
      expect(timerStatus(settings())).toBe('nicht gestartet')
      expect(timerStatus(settings({ startedAt: new Date(T0).toISOString() }))).toBe('läuft')
      expect(
         timerStatus(
            settings({ startedAt: new Date(T0).toISOString(), pausedAt: new Date(T0 + 1).toISOString() }),
         ),
      ).toBe('pausiert')
   })
})
