import { loadStore, saveStore } from './store-backend'
import { ADMIN_ACTIONS, requireAdminToken } from './admin-auth'
import { FINAL_PASSWORD, SOLUTIONS, STATIONS } from './game-data/stations'
import { hintLevelsFor, normalizeInput } from './hints'
import {
   httpError,
   type ActivePhase,
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

   // manual: nur Spielleitung schaltet frei — Auto-Logik rührt nichts an.
   if (mode === 'manual') {
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

// Brute-Force-Bremse: max. 12 Solve-Versuche pro 60 s je Gruppe+Station.
// In-Memory (Single-Server für die Veranstaltung) — kein Persist nötig.
const SOLVE_RATE_WINDOW_MS = 60_000
const SOLVE_RATE_MAX = 12
const solveAttemptTimes = new Map<string, number[]>()

function checkSolveRateLimit(code: string, station: number): void {
   const key = `${code}:${station}`
   const cutoff = Date.now() - SOLVE_RATE_WINDOW_MS
   const times = (solveAttemptTimes.get(key) ?? []).filter((t) => t > cutoff)
   if (times.length >= SOLVE_RATE_MAX) {
      throw httpError(429, 'Zu viele Versuche — kurz warten, dann erneut eingeben')
   }
   times.push(Date.now())
   solveAttemptTimes.set(key, times)
}

/** Nur für Tests — leert die Rate-Limit-Fenster. */
export function __resetSolveRateLimits(): void {
   solveAttemptTimes.clear()
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

export async function createGroup(name: unknown = ''): Promise<GroupPayload> {
   return runExclusive(async () => {
      const store = await loadStore()
      let code = makeCode()
      while (store.groups[code]) code = makeCode()

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
         if (group.members.length >= MAX_MEMBERS) throw httpError(409, 'Gruppe ist voll (max. 3 Geräte)')
         group.members.push(memberId)
         group.updatedAt = now()
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

      // Bereits gelöst: idempotent, kein weiterer Versuchszähler.
      if (group.solved[station.n] !== undefined) {
         const alreadyValid = Number(normalizeInput(group.solved[station.n])) === station.solution
         return { group: groupPayload(group), valid: alreadyValid }
      }

      // Gesperrte Stationen lassen sich auch per Direkt-POST nicht lösen.
      if (!group.unlocked[station.n]) throw httpError(403, 'Station ist gesperrt')
      checkSolveRateLimit(code, station.n)

      group.attempts[station.n] = Number(group.attempts[station.n] ?? 0) + 1
      if (Number(value) !== station.solution) {
         group.errors[station.n] = Number(group.errors[station.n] ?? 0) + 1
         group.updatedAt = now()
         store.groups[code] = group
         await saveStore(store)
         return { group: groupPayload(group), valid: false }
      }

      group.solved[station.n] = value
      group.unlocked = nextUnlocked(group.solved, group.settings.mode, group.unlocked)
      checkFinished(group)
      if (group.activeStation === station.n) advanceActive(group)
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
         const nextMode: GameMode = (['linear', 'open', 'manual'] as GameMode[]).includes(body.mode as GameMode)
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
            group.unlocked = nextUnlocked(group.solved, group.settings.mode, group.unlocked)
            checkFinished(group)
            if (group.activeStation === station) advanceActive(group)
         }
      }

      if (action === 'reveal-finale') {
         group.settings.revealFinale = Boolean(body.reveal)
      }

      if (action === 'navigate') {
         // Team-Navigation im Follow-Modus: alle Geräte teilen activeStation/activePhase.
         const phase = body.phase === 'finale' ? 'finale' : 'play'
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
