import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const storePath = join(tmpdir(), `escape-event-test-${randomUUID()}.json`)
process.env.GROUP_STORE_PATH = storePath

import {
   autoJoinGroup,
   createGroup,
   getEventSettings,
   joinGroupByCode,
   setEventMode,
} from '../../lib/group-store.js'
import { HttpError } from '../../lib/types.js'

afterAll(() => {
   rmSync(storePath, { force: true })
   delete process.env.ADMIN_PASSWORD
})

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

describe('Event-Modus', () => {
   it('Standard ist multi ohne Solo-Gruppe', async () => {
      await expect(getEventSettings()).resolves.toMatchObject({ mode: 'multi', soloCode: null })
   })

   it('unbekannter Modus → 400', async () => {
      await expectHttpError(setEventMode('party', null, null), 400)
   })

   it('unbekannte Solo-Gruppe → 404', async () => {
      await expectHttpError(setEventMode('solo', 'XXXXXX', null), 404)
   })

   it('solo ohne Code erstellt Event-Gruppe', async () => {
      const { event, group } = await setEventMode('solo', null, null, 'Event-Abend')
      expect(event.mode).toBe('solo')
      expect(event.soloCode).toMatch(/^[A-Z2-9]{6}$/)
      expect(group?.code).toBe(event.soloCode)
      expect(group?.name).toBe('Event-Abend')
   })

   it('solo blockt Erstellen neuer Gruppen (409)', async () => {
      await expectHttpError(createGroup('Schwarzfahrer'), 409)
   })

   it('solo: Auto-Join landet immer in Solo-Gruppe — ohne 3er-Deckel', async () => {
      const { soloCode } = await getEventSettings()
      const codes = new Set<string>()
      for (let i = 1; i <= 5; i += 1) {
         const group = await autoJoinGroup(`geraet-${i}`, 'AUTO')
         codes.add(group.code)
         expect(group.code).toBe(soloCode)
      }
      expect(codes.size).toBe(1)
      const solo = await autoJoinGroup('geraet-1', 'AUTO')
      expect(solo.memberCount).toBe(5)
   })

   it('solo: expliziter Beitritt ebenfalls ohne Deckel', async () => {
      const { soloCode } = await getEventSettings()
      const group = await joinGroupByCode(soloCode, 'extra-geraet')
      expect(group.memberCount).toBe(6)
   })

   it('bestehende Gruppe lässt sich zur Solo-Gruppe küren', async () => {
      await setEventMode('multi', null, null)
      const other = await createGroup('Favorit')
      const { event } = await setEventMode('solo', other.code, null)
      expect(event.soloCode).toBe(other.code)
      const joined = await autoJoinGroup('neues-geraet', 'AUTO')
      expect(joined.code).toBe(other.code)
   })

   it('zurück zu multi: Erstellen geht wieder', async () => {
      await setEventMode('multi', null, null)
      const group = await createGroup('Wieder frei')
      expect(group.code).toMatch(/^[A-Z2-9]{6}$/)
      await expect(getEventSettings()).resolves.toMatchObject({ mode: 'multi', soloCode: null })
   })

   it('mit ADMIN_PASSWORD: Umschalten braucht Token', async () => {
      process.env.ADMIN_PASSWORD = 'test-leitung-123'
      await expectHttpError(setEventMode('solo', null, null), 401)
      await expectHttpError(setEventMode('solo', null, 'falsch'), 401)
      const { event } = await setEventMode('solo', null, 'test-leitung-123')
      expect(event.mode).toBe('solo')
      await setEventMode('multi', null, 'test-leitung-123')
      delete process.env.ADMIN_PASSWORD
   })
})
