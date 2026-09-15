import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

const storePath = join(tmpdir(), `escape-test-${randomUUID()}.json`)
process.env.GROUP_STORE_PATH = storePath

import { STATIONS } from '../../lib/game-data/stations.js'
import {
   autoJoinGroup,
   createGroup,
   getGroup,
   joinGroupByCode,
   resetGroup,
   solveStation,
   updateGroup,
} from '../../lib/group-store.js'
import { HttpError } from '../../lib/types.js'

afterAll(() => {
   rmSync(storePath, { force: true })
})

async function freshCode(name = ''): Promise<string> {
   const group = await createGroup(name)
   return group.code
}

function solutionFor(n: number): string {
   return String(STATIONS.find((s) => s.n === n)!.solution)
}

async function expectHttpError(promise: Promise<unknown>, status: number): Promise<void> {
   try {
      await promise
   } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(status)
      return
   }
   throw new Error(`erwartet HttpError ${status}, aber kein Fehler`)
}

describe('createGroup / getGroup', () => {
   it('erzeugt Codes mit Namen', async () => {
      const group = await createGroup('Team A')
      expect(group.code).toMatch(/^[A-Z2-9]{6}$/)
      expect(group.name).toBe('Team A')
      expect(group.unlocked[1]).toBe(true)
   })

   it('GET ist lesend: unbekannt → null, kein Junk', async () => {
      await expect(getGroup('ZZZZZZ')).resolves.toBeNull()
   })

   it('leerer Code → 400', async () => {
      await expectHttpError(getGroup(''), 400)
   })
})

describe('solveStation', () => {
   it('falsch → valid:false + Zähler', async () => {
      const code = await freshCode()
      const wrong = solutionFor(1) === '1' ? '2' : '1'
      const result = await solveStation(code, 1, wrong)
      expect(result.valid).toBe(false)
      expect(result.group.attempts[1]).toBe(1)
      expect(result.group.errors[1]).toBe(1)
      expect(result.group.solved[1]).toBeUndefined()
   })

   it('richtig → valid:true + linear Unlock', async () => {
      const code = await freshCode()
      const result = await solveStation(code, 1, solutionFor(1))
      expect(result.valid).toBe(true)
      expect(result.group.solved[1]).toBeDefined()
      expect(result.group.unlocked[2]).toBe(true)
      expect(result.group.unlocked[3]).toBeFalsy()
      expect(result.group.letters[1]).toBeTruthy()
      expect(result.group.finalWord).toBeNull()
   })

   it('leere Eingabe → 400 ohne Zähler', async () => {
      const code = await freshCode()
      await expectHttpError(solveStation(code, 1, '   '), 400)
      const group = await getGroup(code)
      expect(group!.attempts[1]).toBe(0)
   })

   it('unbekannte Station → 400, unbekannte Gruppe → 404', async () => {
      const code = await freshCode()
      await expectHttpError(solveStation(code, 99, '1'), 400)
      await expectHttpError(solveStation('QQQQQQ', 1, '1'), 404)
   })

   it('Re-Solve ist idempotent (kein Zähler)', async () => {
      const code = await freshCode()
      await solveStation(code, 1, solutionFor(1))
      const again = await solveStation(code, 1, solutionFor(1))
      expect(again.valid).toBe(true)
      expect(again.group.attempts[1]).toBe(1)
   })

   it('alle 20 → Finale offen', async () => {
      const code = await freshCode()
      for (const s of STATIONS) {
         const r = await solveStation(code, s.n, String(s.solution))
         expect(r.valid).toBe(true)
      }
      const group = await getGroup(code)
      expect(Object.keys(group!.solved)).toHaveLength(20)
      expect(group!.settings.revealFinale).toBe(true)
      expect(group!.settings.finishedAt).toBeTruthy()
      expect(group!.finalWord).toBe('ZUSAMMENSINDWIRSTARK')
      expect(Object.keys(group!.letters)).toHaveLength(20)
   })

   it('parallele Solves verlieren nichts (Mutex)', async () => {
      const code = await freshCode()
      const results = await Promise.all(STATIONS.map((s) => solveStation(code, s.n, String(s.solution))))
      expect(results.every((r) => r.valid)).toBe(true)
      const group = await getGroup(code)
      expect(Object.keys(group!.solved)).toHaveLength(20)
   })
})

describe('updateGroup', () => {
   it('settings: Modus + Timer', async () => {
      const code = await freshCode()
      let group = await updateGroup(code, 'settings', { mode: 'open' })
      expect(group.settings.mode).toBe('open')
      expect(group.unlocked[20]).toBe(true)
      group = await updateGroup(code, 'settings', { timerMinutes: 90 })
      expect(group.settings.timerMinutes).toBe(90)
      group = await updateGroup(code, 'settings', { timerMinutes: 9999 })
      expect(group.settings.timerMinutes).toBe(90)
   })

   it('timer: start/pause/resume/adjust/finish', async () => {
      const code = await freshCode()
      let group = await updateGroup(code, 'timer', { command: 'start' })
      expect(group.settings.startedAt).toBeTruthy()
      group = await updateGroup(code, 'timer', { command: 'pause' })
      expect(group.settings.pausedAt).toBeTruthy()
      group = await updateGroup(code, 'timer', { command: 'resume' })
      expect(group.settings.pausedAt).toBeNull()
      const before = group.settings.elapsedPauseMs
      group = await updateGroup(code, 'timer', { command: 'adjust', minutes: 5 })
      expect(group.settings.elapsedPauseMs).toBe(before + 300_000)
      await expectHttpError(updateGroup(code, 'timer', { command: 'adjust', minutes: 99 }), 400)
      await expectHttpError(updateGroup(code, 'timer', { command: 'warp' }), 400)
      group = await updateGroup(code, 'timer', { command: 'finish' })
      expect(group.settings.revealFinale).toBe(true)
   })

   it('unlock/lock mit Guards', async () => {
      const code = await freshCode()
      let group = await updateGroup(code, 'unlock', { station: 5 })
      expect(group.unlocked[5]).toBe(true)
      group = await updateGroup(code, 'lock', { station: 5 })
      expect(group.unlocked[5]).toBe(false)
      await expectHttpError(updateGroup(code, 'lock', { station: 1 }), 400)
      await expectHttpError(updateGroup(code, 'unlock', { station: 99 }), 400)
   })

   it('hint zählt bis Stufen-Maximum', async () => {
      const code = await freshCode()
      await updateGroup(code, 'hint', { station: 1 })
      await updateGroup(code, 'hint', { station: 1 })
      const group = await updateGroup(code, 'hint', { station: 1 })
      expect(group.hints[1]).toBe(3)
      const capped = await updateGroup(code, 'hint', { station: 1 })
      expect(capped.hints[1]).toBe(3)
      await expectHttpError(updateGroup(code, 'hint', { station: 99 }), 400)
   })

   it('upload zu groß → 413, ok → Metadaten, approve löst Upload-Station', async () => {
      const code = await freshCode()
      await expectHttpError(
         updateGroup(code, 'upload', { station: 6, dataUrl: `data:image/jpeg,${'A'.repeat(700_001)}` }),
         413,
      )
      let group = await updateGroup(code, 'upload', {
         station: 6,
         name: 'bruecke.jpg',
         size: 123,
         type: 'image/jpeg',
         dataUrl: 'data:image/jpeg,AAA',
      })
      expect(group.uploads[6].approved).toBe(false)
      expect(group.solved[6]).toBeUndefined()
      group = await updateGroup(code, 'approve-upload', { station: 6, approved: true })
      expect(group.uploads[6].approved).toBe(true)
      expect(group.solved[6]).toBeDefined()
      await expectHttpError(updateGroup(code, 'approve-upload', { station: 9, approved: true }), 400)
   })

   it('rename + reveal-finale', async () => {
      const code = await freshCode()
      let group = await updateGroup(code, 'rename', { name: '  Neues Team  ' })
      expect(group.name).toBe('Neues Team')
      group = await updateGroup(code, 'reveal-finale', { reveal: true })
      expect(group.settings.revealFinale).toBe(true)
      expect(group.finalWord).toBe('ZUSAMMENSINDWIRSTARK')
   })

   it('unbekannte Gruppe → 404', async () => {
      await expectHttpError(updateGroup('QQQQQQ', 'rename', { name: 'x' }), 404)
      await expectHttpError(resetGroup('QQQQQQ'), 404)
   })
})

describe('resetGroup', () => {
   it('leert Fortschritt, behält Namen', async () => {
      const code = await freshCode()
      await updateGroup(code, 'rename', { name: 'Keeper' })
      await solveStation(code, 1, solutionFor(1))
      const group = await resetGroup(code)
      expect(group.name).toBe('Keeper')
      expect(group.solved).toEqual({})
      expect(group.settings.revealFinale).toBe(false)
   })
})

describe('join', () => {
   it('joinGroupByCode registriert, 409 wenn voll', async () => {
      const code = await freshCode()
      let group = await joinGroupByCode(code, 'd1')
      expect(group.members).toEqual(['d1'])
      group = await joinGroupByCode(code, 'd1')
      expect(group.members).toEqual(['d1'])
      await joinGroupByCode(code, 'd2')
      await joinGroupByCode(code, 'd3')
      await expectHttpError(joinGroupByCode(code, 'd4'), 409)
   })

   it('autoJoin füllt Pool und läuft über', async () => {
      const pool = `P${Date.now().toString(36).toUpperCase()}`
      const first = await autoJoinGroup('m1', pool)
      const second = await autoJoinGroup('m2', pool)
      const third = await autoJoinGroup('m3', pool)
      expect(second.code).toBe(first.code)
      expect(third.code).toBe(first.code)
      const fourth = await autoJoinGroup('m4', pool)
      expect(fourth.code).not.toBe(first.code)
      expect(fourth.poolCode).toBe(pool)
      const again = await autoJoinGroup('m1', pool)
      expect(again.code).toBe(first.code)
      expect(again.members.filter((m) => m === 'm1')).toHaveLength(1)
   })
})

describe('anti-cheat: locked-solve + rate-limit', () => {
   it('gesperrte Station lässt sich nicht lösen → 403 ohne Zähler', async () => {
      const code = await freshCode()
      await expectHttpError(solveStation(code, 2, solutionFor(2)), 403)
      const group = await getGroup(code)
      expect(group!.attempts[2]).toBe(0)
      expect(group!.solved[2]).toBeUndefined()
   })

   it('mehr als 12 Versuche/Minute je Station → 429', async () => {
      const code = await freshCode()
      const wrong = solutionFor(1) === '1' ? '2' : '1'
      for (let i = 0; i < 12; i += 1) {
         const r = await solveStation(code, 1, wrong)
         expect(r.valid).toBe(false)
      }
      await expectHttpError(solveStation(code, 1, wrong), 429)
   })
})

describe('team-follow: activeStation/activePhase', () => {
   it('startet bei 1/play und wandert bei Solve weiter', async () => {
      const code = await freshCode()
      const created = await getGroup(code)
      expect(created!.activeStation).toBe(1)
      expect(created!.activePhase).toBe('play')
      const result = await solveStation(code, 1, solutionFor(1))
      expect(result.valid).toBe(true)
      expect(result.group.activeStation).toBe(2)
   })

   it('navigate setzt Team-Stand, gesperrt → 403', async () => {
      const code = await freshCode()
      await expectHttpError(updateGroup(code, 'navigate', { station: 5, phase: 'play' }), 403)
      let group = await updateGroup(code, 'navigate', { station: 1, phase: 'play' })
      expect(group.activeStation).toBe(1)
      expect(group.activePhase).toBe('play')
      group = await updateGroup(code, 'navigate', { station: 1, phase: 'finale' })
      expect(group.activePhase).toBe('finale')
   })

   it('alle 20 → activePhase finale', async () => {
      const code = await freshCode()
      for (const s of STATIONS) {
         await solveStation(code, s.n, String(s.solution))
      }
      const group = await getGroup(code)
      expect(group!.activePhase).toBe('finale')
   })

   it('reset stellt Team-Stand zurück', async () => {
      const code = await freshCode()
      await solveStation(code, 1, solutionFor(1))
      const group = await resetGroup(code)
      expect(group.activeStation).toBe(1)
      expect(group.activePhase).toBe('play')
   })
})

describe('admin-passwort', () => {
   it('ohne ADMIN_PASSWORD bleibt alles offen (dev/tests)', async () => {
      delete process.env.ADMIN_PASSWORD
      const code = await freshCode()
      const group = await updateGroup(code, 'rename', { name: 'offen' })
      expect(group.name).toBe('offen')
   })

   it('mit ADMIN_PASSWORD: Admin-Aktionen brauchen Token, Team-Aktionen nicht', async () => {
      process.env.ADMIN_PASSWORD = 'test-leitung-123'
      try {
         const code = await freshCode()
         await expectHttpError(updateGroup(code, 'rename', { name: 'x' }), 401)
         await expectHttpError(updateGroup(code, 'settings', { mode: 'open' }), 401)
         await expectHttpError(updateGroup(code, 'timer', { command: 'start' }), 401)
         await expectHttpError(updateGroup(code, 'unlock', { station: 3 }), 401)
         await expectHttpError(updateGroup(code, 'reveal-finale', { reveal: true }), 401)
         await expectHttpError(resetGroup(code), 401)
         await expectHttpError(resetGroup(code, 'falsch'), 401)

         // Team-Aktionen bleiben ohne Token möglich …
         const solved = await solveStation(code, 1, solutionFor(1))
         expect(solved.valid).toBe(true)
         const hinted = await updateGroup(code, 'hint', { station: 1 })
         expect(hinted.hints[1]).toBeGreaterThan(0)
         const moved = await updateGroup(code, 'navigate', { station: 2, phase: 'play' })
         expect(moved.activeStation).toBe(2)

         // … und mit Token geht Admin wieder.
         const renamed = await updateGroup(code, 'rename', { name: 'mit-token', adminToken: 'test-leitung-123' })
         expect(renamed.name).toBe('mit-token')
         const reset = await resetGroup(code, 'test-leitung-123')
         expect(reset.solved).toEqual({})
      } finally {
         delete process.env.ADMIN_PASSWORD
      }
   })
})
describe('unbekannte Gruppe', () => {
   beforeEach(async () => {
      // stellt sicher, dass kein Test versehentlich persistiert
   })

   it('getGroup(null-ish) → 400', async () => {
      await expectHttpError(getGroup(null), 400)
   })
})
