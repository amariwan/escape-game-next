// Stabile Geräte-ID für die Mitgliederzählung.
// Nur aus Client-Kontext aufrufen (nutzt window.localStorage).
const MEMBER_KEY = 'escape-game-member-id'

function makeMemberId(): string {
   if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
   }
   return `member-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getMemberId(): string {
   const existing = window.localStorage.getItem(MEMBER_KEY)
   if (existing) return existing
   const next = makeMemberId()
   window.localStorage.setItem(MEMBER_KEY, next)
   return next
}
