import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const storePath = join(tmpdir(), `escape-split-test-${randomUUID()}.json`)
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

async function splitGroupWith(members: string[]): Promise<string> {
   const group = await createGroup('Split-Team')
   for (const memberId of members) await joinGroupByCode(group.code, memberId)
   await updateGroup(group.code, 'settings', { mode: 'split' })
   return group.code
}

describe('Split-Modus', () => {
   it('verteilt beim Umschalten je eine Station (Beitrittsreihenfolge)', async () => {
      const code = await splitGroupWith(['m-a', 'm-b', 'm-c'])
      const group = await getGroup(code)
      expect(group?.split.assignments).toMatchObject({ 'm-a': 1, 'm-b': 2, 'm-c': 3 })
      expect(group?.unlocked[1]).toBe(true)
      expect(group?.unlocked[2]).toBe(true)
      expect(group?.unlocked[3]).toBe(true)
   })

   it('späte Mitglieder bekommen die nächste freie Station', async () => {
      const code = await splitGroupWith(['m-a', 'm-b'])
      // Platz für m-c schaffen geht nur via autoJoin-Pool — direkt per joinByCode:
      await joinGroupByCode(code, 'm-c')
      const group = await getGroup(code)
      expect(group?.split.assignments['m-c']).toBe(3)
   })

   it('fremde Station → 403, fehlende Zuweisung → 403', async () => {
      const code = await splitGroupWith(['m-a', 'm-b'])
      await expectHttpError(solveStation(code, 2, solutionFor(2), 'm-a'), 403)
      await expectHttpError(solveStation(code, 1, solutionFor(1)), 403)
      await expectHttpError(solveStation(code, 1, solutionFor(1), 'fremd'), 403)
   })

   it('eigene Aufgabe lösbar; alle fertig → Auto-Finale', async () => {
      const code = await splitGroupWith(['m-a', 'm-b', 'm-c'])
      // Vorzeitiges Finale per Navigation ist blockiert.
      await expectHttpError(updateGroup(code, 'navigate', { phase: 'finale' }), 403)

      for (const [memberId, station] of [['m-a', 1], ['m-b', 2]] as const) {
         const result = await solveStation(code, station, solutionFor(station), memberId)
         expect(result.valid).toBe(true)
         expect(result.group.settings.revealFinale).toBe(false)
      }
      const last = await solveStation(code, 3, solutionFor(3), 'm-c')
      expect(last.valid).toBe(true)
      expect(last.group.settings.revealFinale).toBe(true)
      expect(last.group.settings.finishedAt).toBeTruthy()
      expect(last.group.activePhase).toBe('finale')
   })

   it('falsche Eingabe auf eigener Station zählt normal', async () => {
      const code = await splitGroupWith(['m-a'])
      const wrong = solutionFor(1) === '1' ? '2' : '1'
      const result = await solveStation(code, 1, wrong, 'm-a')
      expect(result.valid).toBe(false)
      expect(result.group.attempts[1]).toBe(1)
   })

   it('Re-Join nach Moduswechsel heilt fehlende Zuweisung', async () => {
      const created = await createGroup('Nachzuegler')
      await joinGroupByCode(created.code, 'm-spaet')
      await updateGroup(created.code, 'settings', { mode: 'split' })
      // Assignment kam über settings-Wechsel; zweiter Join bleibt idempotent.
      const rejoined = await joinGroupByCode(created.code, 'm-spaet')
      expect(rejoined.split.assignments['m-spaet']).toBe(1)
   })

   it('Reset löscht Zuweisungen', async () => {
      const code = await splitGroupWith(['m-a'])
      await resetGroup(code)
      const group = await getGroup(code)
      expect(group?.split.assignments).toEqual({})
      expect(group?.settings.mode).toBe('split')
   })

   it('Auto-Join vergibt Aufgaben an neue Geräte', async () => {
      const created = await createGroup('Pool-Split')
      await autoJoinGroup('pool-1', created.code)
      await autoJoinGroup('pool-2', created.code)
      await updateGroup(created.code, 'settings', { mode: 'split' })
      const joined = await autoJoinGroup('pool-3', created.code)
      expect(joined.split.assignments['pool-3']).toBe(3)
   })
})
