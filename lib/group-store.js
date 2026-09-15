import { loadStore, saveStore } from './store-backend.js'
import { STATIONS, hintLevelsFor, normalizeInput } from './game-data/stations.js'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_MEMBERS = 3
const DEFAULT_DURATION_MINUTES = 60
const MAX_DATAURL_CHARS = 700_000

let writeQueue = Promise.resolve()

async function readStore() {
   return loadStore()
}

async function writeStore(store) {
   writeQueue = writeQueue.then(() => saveStore(store))
   await writeQueue
}

function makeCode() {
   let code = ''
   for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
   }
   return code
}

function cleanCode(code) {
   return String(code ?? '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 12)
}

function cleanName(name) {
   return String(name ?? '').trim().slice(0, 60)
}

function now() {
   return new Date().toISOString()
}

function defaultUnlocked() {
   return { 1: true }
}

function defaultSettings() {
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

function defaultHints() {
   return STATIONS.reduce((acc, station) => {
      acc[station.n] = 0
      return acc
   }, {})
}

function defaultCounters() {
   return STATIONS.reduce((acc, station) => {
      acc[station.n] = 0
      return acc
   }, {})
}

function cleanMemberId(memberId) {
   return String(memberId ?? '')
      .replace(/[^a-z0-9-]/gi, '')
      .slice(0, 80)
}

// Hinweis-Stufen zentral in stations.js (hintLevelsFor).
export { hintLevelsFor }

function normalizeGroup(group, code) {
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
      createdAt: group?.createdAt ?? now(),
      updatedAt: group?.updatedAt ?? now(),
   }
}

function stripHeavy(group) {
   const clone = { ...group, uploads: { ...group.uploads } }
   for (const [key, upload] of Object.entries(clone.uploads)) {
      if (upload && upload.dataUrl) clone.uploads[key] = { ...upload, dataUrl: null, hasImage: true }
   }
   if (clone.teamPhoto?.dataUrl) clone.teamPhoto = { ...clone.teamPhoto, dataUrl: null, hasImage: true }
   return clone
}

function groupPayload(group, { heavy = true } = {}) {
   const normalized = normalizeGroup(group, group.code)
   const payload = {
      ...normalized,
      memberCount: normalized.members.length,
      maxMembers: MAX_MEMBERS,
      stationCount: STATIONS.length,
   }
   return heavy ? payload : stripHeavy(payload)
}

function createGroupRecord(code, memberId = null, poolCode = code, name = '') {
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
      createdAt: now(),
      updatedAt: now(),
   }
}

function nextUnlocked(solved, mode, current = null) {
   if (mode === 'open') {
      return STATIONS.reduce((acc, station) => {
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

   return STATIONS.reduce((acc, station) => {
      acc[station.n] = station.n <= Math.min(highestSolved + 1, STATIONS.length)
      return acc
   }, {})
}

function checkFinished(group) {
   if (Object.keys(group.solved).length >= STATIONS.length) {
      group.settings.finishedAt = group.settings.finishedAt ?? now()
      group.settings.revealFinale = true
   }
}

export async function createGroup(name = '') {
   const store = await readStore()
   let code = makeCode()
   while (store.groups[code]) code = makeCode()

   store.groups[code] = createGroupRecord(code, null, code, name)

   await writeStore(store)
   return groupPayload(store.groups[code])
}

export async function getOrCreateGroup(rawCode) {
   const code = cleanCode(rawCode)
   if (!code) throw new Error('Missing group code')

   const store = await readStore()
   if (!store.groups[code]) {
      store.groups[code] = createGroupRecord(code)
      await writeStore(store)
   } else {
      store.groups[code] = normalizeGroup(store.groups[code], code)
   }

   return groupPayload(store.groups[code])
}

export async function listGroups() {
   const store = await readStore()
   return Object.values(store.groups)
      .map((group) => groupPayload(group, { heavy: false }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function autoJoinGroup(rawMemberId, rawPoolCode = 'AUTO') {
   const memberId = cleanMemberId(rawMemberId)
   const poolCode = cleanCode(rawPoolCode) || 'AUTO'
   if (!memberId) throw new Error('Missing member id')

   const operation = writeQueue.then(async () => {
      const store = await readStore()
      const entries = Object.entries(store.groups)
         .map(([code, group]) => [code, normalizeGroup(group, code)])
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
      return groupPayload(store.groups[code])
   })

   writeQueue = operation.catch(() => {})
   return operation
}

export async function resetGroup(rawCode) {
   const code = cleanCode(rawCode)
   const store = await readStore()
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
   await writeStore(store)
   return groupPayload(store.groups[code])
}

export async function solveStation(rawCode, stationNumber, rawValue) {
   const code = cleanCode(rawCode)
   const station = STATIONS.find((item) => item.n === Number(stationNumber))
   if (!station) throw new Error('Unknown station')

   const value = normalizeInput(rawValue)
   const store = await readStore()
   if (!store.groups[code]) {
      store.groups[code] = createGroupRecord(code)
   } else {
      store.groups[code] = normalizeGroup(store.groups[code], code)
   }
   const group = store.groups[code]

   group.attempts[station.n] = Number(group.attempts[station.n] ?? 0) + 1
   if (Number(value) !== station.solution) {
      group.errors[station.n] = Number(group.errors[station.n] ?? 0) + 1
      group.updatedAt = now()
      await writeStore(store)
      return { group: groupPayload(group), valid: false }
   }

   group.solved[station.n] = value
   group.unlocked = nextUnlocked(group.solved, group.settings.mode, group.unlocked)
   checkFinished(group)
   group.updatedAt = now()
   await writeStore(store)

   return { group: groupPayload(group), valid: true }
}

export async function updateGroup(rawCode, action, body = {}) {
   const code = cleanCode(rawCode)
   const store = await readStore()
   const group = normalizeGroup(store.groups[code], code)
   const stamp = now()

   if (action === 'settings') {
      const nextMode = ['linear', 'open', 'manual'].includes(body.mode) ? body.mode : group.settings.mode
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
      }
      if (body.command === 'pause' && group.settings.startedAt && !group.settings.pausedAt) {
         group.settings.pausedAt = stamp
      }
      if (body.command === 'resume' && group.settings.pausedAt) {
         group.settings.elapsedPauseMs += Date.now() - Date.parse(group.settings.pausedAt)
         group.settings.pausedAt = null
      }
      // Bonus-/Strafminuten: verstellte Zeit landet in elapsedPauseMs —
      // positiv = geschenkte Zeit (Restzeit wächst), negativ = Abzug.
      if (body.command === 'adjust') {
         const delta = Number(body.minutes)
         if (Number.isFinite(delta) && Math.abs(delta) <= 30) {
            group.settings.elapsedPauseMs += Math.round(delta * 60000)
         }
      }
      if (body.command === 'finish') {
         group.settings.finishedAt = stamp
         group.settings.revealFinale = true
      }
   }

   if (action === 'unlock') {
      const station = Number(body.station)
      if (STATIONS.some((item) => item.n === station)) group.unlocked[station] = true
   }

   if (action === 'lock') {
      const station = Number(body.station)
      if (station > 1 && STATIONS.some((item) => item.n === station)) group.unlocked[station] = false
   }

   if (action === 'hint') {
      const station = Number(body.station)
      const target = STATIONS.find((item) => item.n === station)
      const max = hintLevelsFor(target).length
      const current = Number(group.hints[station] ?? 0)
      if (max > 0) group.hints[station] = Math.min(current + 1, max)
   }

   if (action === 'upload') {
      const station = Number(body.station)
      const dataUrl =
         typeof body.dataUrl === 'string' && body.dataUrl.startsWith('data:image/')
            ? body.dataUrl.slice(0, MAX_DATAURL_CHARS)
            : null
      if (station === 0) {
         // Teamfoto für die Nachbesprechung (keine Station, kein Solve).
         group.teamPhoto = {
            name: String(body.name ?? 'teamfoto').slice(0, 120),
            size: Number(body.size ?? 0),
            type: String(body.type ?? ''),
            dataUrl,
            hasImage: Boolean(dataUrl),
            uploadedAt: stamp,
         }
      } else if (STATIONS.some((item) => item.n === station)) {
         group.uploads[station] = {
            name: String(body.name ?? 'upload').slice(0, 120),
            size: Number(body.size ?? 0),
            type: String(body.type ?? ''),
            dataUrl,
            hasImage: Boolean(dataUrl),
            approved: false,
            uploadedAt: stamp,
         }
      }
   }

   if (action === 'approve-upload') {
      const station = Number(body.station)
      if (group.uploads[station]) {
         const approved = Boolean(body.approved)
         group.uploads[station] = { ...group.uploads[station], approved }
         // Freigabe durch Spielleitung löst Upload-Stationen (6/7) automatisch.
         const target = STATIONS.find((item) => item.n === station)
         if (approved && target?.kind === 'upload' && group.solved[station] === undefined) {
            group.solved[station] = String(target.solution)
            group.unlocked = nextUnlocked(group.solved, group.settings.mode, group.unlocked)
            checkFinished(group)
         }
      }
   }

   if (action === 'reveal-finale') {
      group.settings.revealFinale = Boolean(body.reveal)
   }

   group.updatedAt = stamp
   store.groups[code] = group
   await writeStore(store)
   return groupPayload(group)
}
