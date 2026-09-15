// Globales Spielleitungs-Passwort für Admin-Aktionen + Admin-Seiten.
//
// ADMIN_PASSWORD als Env-Var setzen (z.B. in .env.local). Ist sie leer oder
// fehlt, bleiben Admin-Aktionen offen (lokale Entwicklung / Tests).
// Der Token läuft im POST-Body als `adminToken` mit — nie im GET/URL.
import { httpError } from './types'

/** Aktionen, die nur die Spielleitung mit Passwort ausführen darf. */
export const ADMIN_ACTIONS = new Set([
   'reset',
   'settings',
   'rename',
   'timer',
   'unlock',
   'lock',
   'approve-upload',
   'reveal-finale',
])

export function getAdminPassword(): string {
   return process.env.ADMIN_PASSWORD ?? ''
}

export function isAdminConfigured(): boolean {
   return getAdminPassword().length > 0
}

/** Wirft 401 bei falschem/fehlendem Token — nur wenn ein Passwort gesetzt ist. */
export function requireAdminToken(token: unknown): void {
   if (!isAdminConfigured()) return
   if (typeof token !== 'string' || token !== getAdminPassword()) {
      throw httpError(401, 'Spielleitungs-Passwort fehlt oder ist falsch')
   }
}
