// Zeit-Helfer — Single Source of Truth für alle Timer-Anzeigen.
// elapsedPauseMs-Semantik: positiv = geschenkte Zeit (Bonus), negativ = Abzug.
// Client-Uhren können driften — Beamer und Teamgerät zeigen je ihre lokale
// Rechnung auf Basis der Server-Settings. Für ein Event reicht das.
import type { GroupSettings } from './types'

export function elapsedMs(settings: GroupSettings | null | undefined, nowMs: number = Date.now()): number | null {
   if (!settings?.startedAt) return null
   const start = Date.parse(settings.startedAt)
   if (!Number.isFinite(start)) return null
   // Nach Beenden friert die Zeit ein (Nachbesprechung), sonst Pause/Jetzt.
   const endRaw = settings.finishedAt ?? settings.pausedAt ?? null
   const end = endRaw ? Date.parse(endRaw) : nowMs
   if (!Number.isFinite(end)) return null
   return Math.max(0, end - start - (settings.elapsedPauseMs ?? 0))
}

export function remainingMs(settings: GroupSettings | null | undefined, nowMs: number = Date.now()): number | null {
   const elapsed = elapsedMs(settings, nowMs)
   if (elapsed === null || !settings) return null
   return Math.max(0, (settings.timerMinutes ?? 60) * 60000 - elapsed)
}

export function formatMMSS(ms: number): string {
   const total = Math.max(0, Math.floor(ms / 1000))
   const min = Math.floor(total / 60)
   const sec = total % 60
   return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Restzeit-Anzeige; vor Start das volle Budget. */
export function remainingLabel(settings: GroupSettings | null | undefined, nowMs: number = Date.now()): string {
   if (!settings?.startedAt) return formatMMSS((settings?.timerMinutes ?? 60) * 60000)
   const remaining = remainingMs(settings, nowMs)
   return remaining === null ? '—' : formatMMSS(remaining)
}

/** Statuswort für Admin-Steuerung. */
export function timerStatus(settings: GroupSettings | null | undefined): 'nicht gestartet' | 'pausiert' | 'läuft' {
   if (!settings?.startedAt) return 'nicht gestartet'
   return settings.pausedAt ? 'pausiert' : 'läuft'
}
