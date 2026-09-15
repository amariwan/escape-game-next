import { loadStore, saveStore } from './store-backend'
import { ADMIN_ACTIONS, requireAdminToken } from './admin-auth'
import { checkSolveRateLimit } from './rate-limit'
import { FINAL_PASSWORD, SOLUTIONS, STATIONS } from './game-data/stations'
import { hintLevelsFor, normalizeInput } from './hints'
import {
   httpError,
   type ActivePhase,
   type EventMode,
   type EventSettings,
   type GameMode,
   type GroupPayload,
   type GroupRecord,
   type GroupSettings,
   type SolveResult,
   type StoredGroup,
   type StoreShape,
} from './types'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_MEMBERS = 3
const DEFAULT_DURATION_MINUTES = 60
const MAX_DATAURL_CHARS = 700_000

// Serialisiert alle Read-Modify-Write-Zyklen — ohne das verlieren
// parallele solve/update-Requests gegenseitig ihre Änderungen.
let writeQueue: Promise<unknown> = Promise.resolve()

function runExclusive<T>(op: () => Promise<T>): Promise<T> {
   const result = writeQueue.then(op)
   writeQueue = result.then(
      () => undefined,
      () => undefined,
   )
   return result
}

function makeCode(): string {
   let code = ''
   for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
   }
   return code
}

export function cleanCode(code: unknown): string {
   return String(code ?? '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 12)
}

function cleanName(name: unknown): string {
   return String(name ?? '').trim().slice(0, 60)
}

function now(): string {
   return new Date().toISOString()
}

function defaultUnlocked(): Record<number, boolean> {
   return { 1: true }
}

function defaultSettings(): GroupSettings {
   return {
      mode: 'linear',
      timerMinutes: DEFAULT_DURATION_MINUTES,
      startedAt: null,
      pausedAt: null,
      elapsedPauseMs: 0,
      finishedAt: null,
      revealFinale: false,
   }
}

function defaultHints(): Record<number, number> {
   return STATIONS.reduce<Record<number, number>>((acc, station) => {
      acc[station.n] = 0
      return acc
   }, {})
}

function defaultCounters(): Record<number, number> {
   return STATIONS.reduce<Record<number, number>>((acc, station) => {
      acc[station.n] = 0
      return acc
   }, {})
}

function cleanMemberId(memberId: unknown): string {
   return String(memberId ?? '')
      .replace(/[^a-z0-9-]/gi, '')
      .slice(0, 80)
}

// Hinweis-Stufen zentral in stations.js (hintLevelsFor).
export { hintLevelsFor }

function normalizeGroup(group: StoredGroup | undefined, code: string): GroupRecord {
   const activeStation = Number(group?.activeStation)
   const activePhase: ActivePhase = group?.activePhase === 'finale' ? 'finale' : 'play'
   return {
      code,
      name: group?.name ?? '',
      solved: group?.solved ?? {},
      unlocked: group?.unlocked ?? defaultUnlocked(),
      split: {
         assignments: (group?.split?.assignments && typeof group.split.assignments === 'object'
            ? Object.fromEntries(
                 Object.entries(group.split.assignments)
                    .map(([memberId, station]) => [cleanMemberId(memberId), Number(station)])
                    .filter(([, station]) => STATIONS.some((item) => item.n === station)),
              )
            : {}) as Record<string, number>,
      },
      hints: group?.hints ?? defaultHints(),
      attempts: group?.attempts ?? defaultCounters(),
      errors: group?.errors ?? defaultCounters(),
      uploads: group?.uploads ?? {},
      teamPhoto: group?.teamPhoto ?? null,
      settings: { ...defaultSettings(), ...(group?.settings ?? {}) },
      members: Array.isArray(group?.members) ? group.members : [],
      poolCode: group?.poolCode ?? code,
      activeStation:
         Number.isInteger(activeStation) && activeStation >= 1 && activeStation <= STATIONS.length
            ? activeStation
            : 1,
      activePhase,
      createdAt: group?.createdAt ?? now(),
      updatedAt: group?.updatedAt ?? now(),
   }
}

function stripHeavy(group: GroupPayload): GroupPayload {
   const clone: GroupPayload = { ...group, uploads: { ...group.uploads } }
   for (const [key, upload] of Object.entries(clone.uploads)) {
      const n = Number(key)
      if (upload && upload.dataUrl) clone.uploads[n] = { ...upload, dataUrl: null, hasImage: true }
   }
   if (clone.teamPhoto?.dataUrl) clone.teamPhoto = { ...clone.teamPhoto, dataUrl: null, hasImage: true }
   return clone
}

function groupPayload(group: GroupRecord, { heavy = true }: { heavy?: boolean } = {}): GroupPayload {
   const normalized = normalizeGroup(group, group.code)
   // Client sieht Buchstaben nur für gelöste Stationen, Passwort nur bei Freigabe.
   const letters: Record<number, string> = {}
   for (const key of Object.keys(normalized.solved)) {
      const n = Number(key)
      const entry = SOLUTIONS.find((s) => s.n === n)
      if (entry) letters[n] = entry.letter
   }
   const payload: GroupPayload = {
      ...normalized,
      memberCount: normalized.members.length,
      maxMembers: MAX_MEMBERS,
      stationCount: STATIONS.length,
      letters,
      finalWord: normalized.settings.revealFinale ? FINAL_PASSWORD : null,
   }
   return heavy ? payload : stripHeavy(payload)
}

function createGroupRecord(code: string, memberId: string | null = null, poolCode: string = code, name = ''): GroupRecord {
   return {
      code,
      name: cleanName(name),
      solved: {},
      unlocked: defaultUnlocked(),
      split: { assignments: {} },
      hints: defaultHints(),
      attempts: defaultCounters(),
      errors: defaultCounters(),
      uploads: {},
      teamPhoto: null,
      settings: defaultSettings(),
      members: memberId ? [memberId] : [],
      poolCode,
      activeStation: 1,
      activePhase: 'play',
      createdAt: now(),
      updatedAt: now(),
   }
}

function nextUnlocked(
   solved: Record<number, string>,
   mode: GameMode,
   current: Record<number, boolean> | null = null,
): Record<number, boolean> {
   if (mode === 'open') {
      return STATIONS.reduce<Record<number, boolean>>((acc, station) => {
         acc[station.n] = true
         return acc
      }, {})
   }

   // manual/split: nur Spielleitung (bzw. die Split-Zuteilung) schaltet
   // frei — Auto-Logik rührt nichts an.
   if (mode === 'manual' || mode === 'split') {
      return { 1: true, ...(current ?? {}) }
   }

   const highestSolved = STATIONS.reduce((max, station) => {
      return solved[station.n] !== undefined ? station.n : max
   }, 0)

   return STATIONS.reduce<Record<number, boolean>>((acc, station) => {
      acc[station.n] = station.n <= Math.min(highestSolved + 1, STATIONS.length)
      return acc
   }, {})
}

function checkFinished(group: GroupRecord): void {
   if (Object.keys(group.solved).length >= STATIONS.length) {
      group.settings.finishedAt = group.settings.finishedAt ?? now()
      group.settings.revealFinale = true
   }
}

// Brute-Force-Bremse lebt in lib/rate-limit.ts (Redis mit Memory-Fallback).
export { __resetSolveRateLimits } from './rate-limit'

/**
 * Split-Modus: jedes Mitglied bekommt genau eine Station (Aufstieg nach
 * Beitrittsreihenfolge, kleinste freie Stationsnummer zuerst).
 * Wirft 409, wenn keine freie Aufgabe mehr übrig ist.
 */
function assignSplit(group: GroupRecord, memberId: string): number {
   const id = cleanMemberId(memberId)
   if (!id) throw httpError(400, 'Mitglieds-ID fehlt')
   const existing = group.split.assignments[id]
   if (existing !== undefined) return existing
   const taken = new Set(Object.values(group.split.assignments))
   const free = STATIONS.find((s) => !taken.has(s.n))
   if (!free) throw httpError(409, 'Keine freie Aufgabe mehr — Split ist voll')
   group.split.assignments[id] = free.n
   group.unlocked[free.n] = true
   return free.n
}

/** Split-Finale: alle verteilten Aufgaben gelöst → Finale öffnet sich von selbst. */
function checkSplitFinished(group: GroupRecord): void {
   const assigned = Object.values(group.split.assignments)
   if (assigned.length === 0) return
   const allDone = assigned.every((n) => group.solved[n] !== undefined)
   if (allDone) {
      group.settings.finishedAt = group.settings.finishedAt ?? now()
      group.settings.revealFinale = true
      group.activePhase = 'finale'
   }
}

/** Team folgt gemeinsam: nach Solve auf die nächste offene, ungelöste Station. */
function advanceActive(group: GroupRecord): void {
   const next = STATIONS.find((s) => group.unlocked[s.n] && group.solved[s.n] === undefined)
   if (next) {
      group.activeStation = next.n
   } else if (Object.keys(group.solved).length >= STATIONS.length) {
      group.activePhase = 'finale'
   }
}

function requireStation(stationNumber: unknown): number {
   const n = Number(stationNumber)
   if (!STATIONS.some((item) => item.n === n)) throw httpError(400, 'Unbekannte Station')
   return n
}

function eventSettings(store: StoreShape): EventSettings {
   const mode: EventMode = store.event?.mode === 'solo' ? 'solo' : 'multi'
   const rawSolo = typeof store.event?.soloCode === 'string' ? cleanCode(store.event.soloCode) : ''
   return { mode, soloCode: rawSolo || null, updatedAt: store.event?.updatedAt ?? now() }
}

/** Aktueller Event-Modus (solo = ein Event, eine Gruppe; multi = viele Gruppen). */
export async function getEventSettings(): Promise<EventSettings> {
   const store = await loadStore()
   return eventSettings(store)
}

function newestGroupCode(store: StoreShape): string | null {
   let best: { code: string; createdAt: string } | null = null
   for (const [code, group] of Object.entries(store.groups)) {
      const createdAt = typeof group?.createdAt === 'string' ? group.createdAt : ''
      if (!best || createdAt.localeCompare(best.createdAt) > 0) best = { code, createdAt }
   }
   return best?.code ?? null
}

function makeUniqueCode(store: StoreShape): string {
   let code = makeCode()
   while (store.groups[code]) code = makeCode()
   return code
}

/**
 * Event-Modus umschalten (Spielleitung, per Admin-Token geschützt).
 * Solo ohne soloCode: nimmt die neueste Gruppe oder erstellt eine
 * (Name via `name` steuerbar). Gibt Modus + Solo-Gruppe zurück.
 */
export async function setEventMode(
   rawMode: unknown,
   rawSoloCode: unknown = null,
   adminToken: unknown = null,
   rawName: unknown = '',
): Promise<{ event: EventSettings; group: GroupPayload | null }> {
   const mode: EventMode = rawMode === 'solo' ? 'solo' : rawMode === 'multi' ? 'multi' : (() => { throw httpError(400, 'Unbekannter Event-Modus') })()
   requireAdminToken(adminToken)
   return runExclusive(async () => {
      const store = await loadStore()
      if (mode === 'multi') {
         const event: EventSettings = { mode, soloCode: null, updatedAt: now() }
         store.event = event
         await saveStore(store)
         return { event, group: null }
      }

      let soloCode = cleanCode(rawSoloCode)
      if (soloCode && !store.groups[soloCode]) throw httpError(404, 'Solo-Gruppe nicht gefunden')
      if (!soloCode) soloCode = newestGroupCode(store) ?? ''
      if (!soloCode) {
         soloCode = makeUniqueCode(store)
         store.groups[soloCode] = createGroupRecord(soloCode, null, soloCode, String(rawName ?? '') || 'Event-Gruppe')
      }
      const event: EventSettings = { mode, soloCode, updatedAt: now() }
      store.event = event
      await saveStore(store)
      return { event, group: groupPayload(normalizeGroup(store.groups[soloCode], soloCode)) }
   })
}

/** Solo-Gruppe auflösen — repariert verwaiste soloCode-Verweise (Gruppe gelöscht). */
function resolveSoloCode(store: StoreShape): string | null {
   const { soloCode } = eventSettings(store)
   if (soloCode && store.groups[soloCode]) return soloCode
   const fallback = newestGroupCode(store)
   if (fallback) {
      store.event = { mode: 'solo', soloCode: fallback, updatedAt: now() }
      return fallback
   }
   return null
}

export async function createGroup(name: unknown = ''): Promise<GroupPayload> {
   return runExclusive(async () => {
      const store = await loadStore()
      const event = eventSettings(store)
      if (event.mode === 'solo') {
         throw httpError(409, `Solo-Modus aktiv — alle Geräte spielen in Gruppe ${event.soloCode ?? 'der Event-Gruppe'}`)
      }
      const code = makeUniqueCode(store)

      store.groups[code] = createGroupRecord(code, null, code, String(name ?? ''))
      await saveStore(store)
      return groupPayload(store.groups[code] as GroupRecord)
   })
}

/** Lesend — erzeugt NIEMALS Gruppen (kein Junk durch Tippfehler/Polls). */
export async function getGroup(rawCode: unknown): Promise<GroupPayload | null> {
   const code = cleanCode(rawCode)
   if (!code) throw httpError(400, 'Gruppen-Code fehlt')
   const store = await loadStore()
   const group = store.groups[code]
   if (!group) return null
   return groupPayload(normalizeGroup(group, code))
}

export async function listGroups(): Promise<GroupPayload[]> {
   const store = await loadStore()
   return Object.values(store.groups)
      .map((group) => groupPayload(group as GroupRecord, { heavy: false }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function autoJoinGroup(rawMemberId: unknown, rawPoolCode: unknown = 'AUTO'): Promise<GroupPayload> {
   const memberId = cleanMemberId(rawMemberId)
   const poolCode = cleanCode(rawPoolCode) || 'AUTO'
   if (!memberId) throw httpError(400, 'Mitglieds-ID fehlt')

   return runExclusive(async () => {
      const store = await loadStore()

      // Solo-Modus: ein Event, eine Gruppe — jedes Gerät landet in der
      // Solo-Gruppe, ohne 3-Geräte-Deckel (gemeinsamer Fortschritt).
      if (eventSettings(store).mode === 'solo') {
         let soloCode = resolveSoloCode(store)
         if (!soloCode) {
            soloCode = makeUniqueCode(store)
            store.groups[soloCode] = createGroupRecord(soloCode, null, soloCode, 'Event-Gruppe')
            store.event = { mode: 'solo', soloCode, updatedAt: now() }
         }
         const group = normalizeGroup(store.groups[soloCode], soloCode)
         if (!group.members.includes(memberId)) {
            group.members.push(memberId)
            group.updatedAt = now()
         }
         // Split-Modus: späte Geräte bekommen beim Beitritt ihre Aufgabe.
         if (group.settings.mode === 'split') assignSplit(group, memberId)
         store.groups[soloCode] = group
         await saveStore(store)
         return groupPayload(group)
      }

      const entries = Object.entries(store.groups)
         .map(([code, group]) => [code, normalizeGroup(group, code)] as const)
         .filter(([, group]) => group.poolCode === poolCode)
         .sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt))

      for (const [, group] of entries) {
         if (group.members.includes(memberId)) {
            store.groups[group.code] = group
            await saveStore(store)
            return groupPayload(group)
         }
      }

      const openEntry = entries.find(([, group]) => group.members.length < MAX_MEMBERS)
      if (openEntry) {
         const [code, group] = openEntry
         group.members.push(memberId)
         group.updatedAt = now()
         if (group.settings.mode === 'split') assignSplit(group, memberId)
         store.groups[code] = group
         await saveStore(store)
         return groupPayload(group)
      }

      let code = makeCode()
      while (store.groups[code]) code = makeCode()

      store.groups[code] = createGroupRecord(code, memberId, poolCode)
      await saveStore(store)
      return groupPayload(store.groups[code] as GroupRecord)
   })
}

/** Expliziter Beitritt per Code (Direkt-Link) — zählt Mitglieder mit. */
export async function joinGroupByCode(rawCode: unknown, rawMemberId: unknown): Promise<GroupPayload> {
   const code = cleanCode(rawCode)
   const memberId = cleanMemberId(rawMemberId)
   if (!code) throw httpError(400, 'Gruppen-Code fehlt')
   if (!memberId) throw httpError(400, 'Mitglieds-ID fehlt')

   return runExclusive(async () => {
      const store: StoreShape = await loadStore()
      const group = normalizeGroup(store.groups[code], code)
      if (!group.members.includes(memberId)) {
         // Solo-Modus: kein Geräte-Deckel — alle spielen gemeinsam.
         if (eventSettings(store).mode !== 'solo' && group.members.length >= MAX_MEMBERS) {
            throw httpError(409, 'Gruppe ist voll (max. 3 Geräte)')
         }
         group.members.push(memberId)
         group.updatedAt = now()
         if (group.settings.mode === 'split') assignSplit(group, memberId)
      } else if (group.settings.mode === 'split') {
         // Re-Join ohne Zuweisung (z.B. nach Moduswechsel) heilen.
         assignSplit(group, memberId)
      }
      store.groups[code] = group
      await saveStore(store)
      return groupPayload(group)
   })
}

export async function resetGroup(rawCode: unknown, adminToken: unknown = null): Promise<GroupPayload> {
   const code = cleanCode(rawCode)
   if (!code) throw httpError(400, 'Gruppen-Code fehlt')
   requireAdminToken(adminToken)
   return runExclusive(async () => {
      const store = await loadStore()
      if (!store.groups[code]) throw httpError(404, 'Gruppe nicht gefunden')
      const previous = normalizeGroup(store.groups[code], code)
      store.groups[code] = {
         ...previous,
         solved: {},
         unlocked: defaultUnlocked(),
         split: { assignments: {} },
         hints: defaultHints(),
         attempts: defaultCounters(),
         errors: defaultCounters(),
         uploads: {},
         teamPhoto: null,
         activeStation: 1,
         activePhase: 'play',
         settings: {
            ...previous.settings,
            startedAt: null,
            pausedAt: null,
            elapsedPauseMs: 0,
            finishedAt: null,
            revealFinale: false,
         },
         updatedAt: now(),
      }
      await saveStore(store)
      return groupPayload(store.groups[code] as GroupRecord)
   })
}

export async function solveStation(
   rawCode: unknown,
   stationNumber: unknown,
   rawValue: unknown,
   rawMemberId: unknown = null,
): Promise<SolveResult> {
   const code = cleanCode(rawCode)
   if (!code) throw httpError(400, 'Gruppen-Code fehlt')
   const station = STATIONS.find((item) => item.n === Number(stationNumber))
   if (!station) throw httpError(400, 'Unbekannte Station')

   const value = normalizeInput(rawValue)
   if (value === '') throw httpError(400, 'Bitte Lösungszahl eingeben')

   return runExclusive(async () => {
      const store = await loadStore()
      if (!store.groups[code]) throw httpError(404, 'Gruppe nicht gefunden')
      const group = normalizeGroup(store.groups[code], code)
      const isSplit = group.settings.mode === 'split'

      // Split-Modus: nur die eigene zugeteilte Aufgabe ist lösbar.
      if (isSplit) {
         const memberId = cleanMemberId(rawMemberId)
         const mine = memberId ? group.split.assignments[memberId] : undefined
         if (mine === undefined) throw httpError(403, 'Keine Aufgabe zugeteilt — bitte neu beitreten')
         if (mine !== station.n) throw httpError(403, 'Das ist nicht deine Aufgabe')
      }

      // Bereits gelöst: idempotent, kein weiterer Versuchszähler.
      if (group.solved[station.n] !== undefined) {
         const alreadyValid = Number(normalizeInput(group.solved[station.n])) === station.solution
         return { group: groupPayload(group), valid: alreadyValid }
      }

      // Gesperrte Stationen lassen sich auch per Direkt-POST nicht lösen.
      if (!group.unlocked[station.n]) throw httpError(403, 'Station ist gesperrt')
      await checkSolveRateLimit(code, station.n)

      group.attempts[station.n] = Number(group.attempts[station.n] ?? 0) + 1
      if (Number(value) !== station.solution) {
         group.errors[station.n] = Number(group.errors[station.n] ?? 0) + 1
         group.updatedAt = now()
         store.groups[code] = group
         await saveStore(store)
         return { group: groupPayload(group), valid: false }
      }

      group.solved[station.n] = value
      if (isSplit) {
         checkSplitFinished(group)
      } else {
         group.unlocked = nextUnlocked(group.solved, group.settings.mode, group.unlocked)
         checkFinished(group)
         if (group.activeStation === station.n) advanceActive(group)
      }
      group.updatedAt = now()
      store.groups[code] = group
      await saveStore(store)

      return { group: groupPayload(group), valid: true }
   })
}

interface UpdateBody {
   mode?: unknown
   timerMinutes?: unknown
   name?: unknown
   command?: unknown
   minutes?: unknown
   station?: unknown
   phase?: unknown
   dataUrl?: unknown
   size?: unknown
   type?: unknown
   approved?: unknown
   reveal?: unknown
   adminToken?: unknown
}

export async function updateGroup(rawCode: unknown, action: string, body: UpdateBody = {}): Promise<GroupPayload> {
   const code = cleanCode(rawCode)
   if (!code) throw httpError(400, 'Gruppen-Code fehlt')
   if (ADMIN_ACTIONS.has(action)) requireAdminToken(body.adminToken)
   return runExclusive(async () => {
      const store = await loadStore()
      if (!store.groups[code]) throw httpError(404, 'Gruppe nicht gefunden')
      const group = normalizeGroup(store.groups[code], code)
      const stamp = now()

      if (action === 'settings') {
         const nextMode: GameMode = (['linear', 'open', 'manual', 'split'] as GameMode[]).includes(body.mode as GameMode)
            ? (body.mode as GameMode)
            : group.settings.mode
         const timerMinutes = Number(body.timerMinutes)
         group.settings = {
            ...group.settings,
            mode: nextMode,
            timerMinutes:
               Number.isFinite(timerMinutes) && timerMinutes >= 5 && timerMinutes <= 240
                  ? Math.round(timerMinutes)
                  : group.settings.timerMinutes,
         }
         group.unlocked = nextUnlocked(group.solved, group.settings.mode, group.unlocked)
         // Split-Einstieg: alle bisherigen Mitglieder bekommen sofort
         // automatisch je eine Aufgabe (Beitrittsreihenfolge → Station 1…k).
         if (nextMode === 'split') {
            for (const memberId of group.members) assignSplit(group, memberId)
         }
      }

      if (action === 'rename') {
         group.name = cleanName(body.name)
      }

      if (action === 'timer') {
         if (body.command === 'start') {
            group.settings.startedAt = stamp
            group.settings.pausedAt = null
            group.settings.elapsedPauseMs = 0
            group.settings.finishedAt = null
         } else if (body.command === 'pause') {
            if (group.settings.startedAt && !group.settings.pausedAt) {
               group.settings.pausedAt = stamp
            }
         } else if (body.command === 'resume') {
            if (group.settings.pausedAt) {
               group.settings.elapsedPauseMs += Date.now() - Date.parse(group.settings.pausedAt)
               group.settings.pausedAt = null
            }
         } else if (body.command === 'adjust') {
            // Bonus-/Strafminuten: verstellte Zeit landet in elapsedPauseMs —
            // positiv = geschenkte Zeit (Restzeit wächst), negativ = Abzug.
            const delta = Number(body.minutes)
            if (!Number.isFinite(delta) || Math.abs(delta) > 30) {
               throw httpError(400, 'Anpassung max. ±30 Minuten')
            }
            group.settings.elapsedPauseMs += Math.round(delta * 60000)
         } else if (body.command === 'finish') {
            group.settings.finishedAt = stamp
            group.settings.revealFinale = true
         } else {
            throw httpError(400, 'Unbekanntes Timer-Kommando')
         }
      }

      if (action === 'unlock') {
         const station = requireStation(body.station)
         group.unlocked[station] = true
      }

      if (action === 'lock') {
         const station = requireStation(body.station)
         if (station <= 1) throw httpError(400, 'Station 1 bleibt immer offen')
         group.unlocked[station] = false
      }

      if (action === 'hint') {
         const station = requireStation(body.station)
         const target = STATIONS.find((item) => item.n === station)
         const max = hintLevelsFor(target).length
         if (max === 0) throw httpError(400, 'Keine Hinweise für diese Station')
         const current = Number(group.hints[station] ?? 0)
         group.hints[station] = Math.min(current + 1, max)
      }

      if (action === 'upload') {
         const rawDataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : null
         const dataUrl =
            rawDataUrl && rawDataUrl.startsWith('data:image/') ? rawDataUrl : null
         if (rawDataUrl && rawDataUrl.startsWith('data:image/') && rawDataUrl.length > MAX_DATAURL_CHARS) {
            throw httpError(413, 'Bild zu groß — kleineres Foto wählen')
         }
         const size = Number(body.size ?? 0)
         if (body.station === 0 || body.station === '0') {
            // Teamfoto für die Nachbesprechung (keine Station, kein Solve).
            group.teamPhoto = {
               name: String(body.name ?? 'teamfoto').slice(0, 120),
               size: Number.isFinite(size) ? size : 0,
               type: String(body.type ?? ''),
               dataUrl,
               hasImage: Boolean(dataUrl),
               uploadedAt: stamp,
            }
         } else {
            const station = requireStation(body.station)
            group.uploads[station] = {
               name: String(body.name ?? 'upload').slice(0, 120),
               size: Number.isFinite(size) ? size : 0,
               type: String(body.type ?? ''),
               dataUrl,
               hasImage: Boolean(dataUrl),
               approved: false,
               uploadedAt: stamp,
            }
         }
      }

      if (action === 'approve-upload') {
         const station = requireStation(body.station)
         if (!group.uploads[station]) throw httpError(400, 'Kein Upload für diese Station')
         const approved = Boolean(body.approved)
         group.uploads[station] = { ...group.uploads[station], approved }
         // Freigabe durch Spielleitung löst Upload-Stationen (6/7) automatisch.
         const target = STATIONS.find((item) => item.n === station)
         if (approved && target?.kind === 'upload' && group.solved[station] === undefined) {
            group.solved[station] = String(target.solution)
            if (group.settings.mode === 'split') {
               checkSplitFinished(group)
            } else {
               group.unlocked = nextUnlocked(group.solved, group.settings.mode, group.unlocked)
               checkFinished(group)
               if (group.activeStation === station) advanceActive(group)
            }
         }
      }

      if (action === 'reveal-finale') {
         group.settings.revealFinale = Boolean(body.reveal)
      }

      if (action === 'navigate') {
         // Team-Navigation im Follow-Modus: alle Geräte teilen activeStation/activePhase.
         const phase = body.phase === 'finale' ? 'finale' : 'play'
         // Split: Das Finale öffnet sich nur automatisch (alle Aufgaben gelöst).
         if (phase === 'finale' && group.settings.mode === 'split' && !group.settings.revealFinale) {
            throw httpError(403, 'Finale öffnet sich automatisch, sobald alle Aufgaben gelöst sind')
         }
         if (phase === 'finale') {
            group.activePhase = 'finale'
         } else {
            const station = requireStation(body.station)
            if (!group.unlocked[station]) throw httpError(403, 'Station ist gesperrt')
            group.activeStation = station
            group.activePhase = 'play'
         }
      }

      group.updatedAt = stamp
      store.groups[code] = group
      await saveStore(store)
      return groupPayload(group)
   })
}
