// Solve-Bremse gegen Brute-Force: max. 12 Versuche / 60 s je Gruppe+Station.
//
// Backend: REDIS_URL gesetzt → Redis (atomar via Lua, multi-instanzfähig),
// sonst In-Memory (Single-Server). Fällt Redis aus, geht das Spiel fail-open
// weiter (Warnung im Log) — Verfügbarkeit schlägt Limit-Schärfe.
import { createClient, type RedisClientType } from 'redis'
import { HttpError, httpError } from './types'

export const SOLVE_RATE_WINDOW_S = 60
export const SOLVE_RATE_MAX = 12

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
   redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`.trim()

const KEY_PREFIX = 'escape:solve:'
const RETRY_COOLDOWN_MS = 30_000

const memoryHits = new Map<string, number[]>()
let client: RedisClientType | null = null
let failedUntil = 0

/** 'redis' sobald REDIS_URL gesetzt ist (auch bei Ausfall — dann fail-open). */
export function rateLimitBackend(): 'redis' | 'memory' {
   return process.env.REDIS_URL ? 'redis' : 'memory'
}

async function redis(): Promise<RedisClientType | null> {
   const url = process.env.REDIS_URL
   if (!url || Date.now() < failedUntil) return null
   // Kein Auto-Reconnect im Client: tote Verbindung erkennen, frisch wählen,
   // Befehle schlagen schnell fehl (fail-open) statt zu hängen.
   if (client?.isReady) return client
   if (client) {
      try {
         client.destroy()
      } catch {
         // ignorieren
      }
      client = null
   }
   const next = createClient({
      url,
      // Während eines Ausfalls sofort fehlschlagen (fail-open) statt
      // Solve-Requests in der Offline-Queue zu parken.
      disableOfflineQueue: true,
      socket: { connectTimeout: 1000, reconnectStrategy: false },
   })
   next.on('error', (err: unknown) => {
      console.error('[rate-limit] redis:', err instanceof Error ? err.message : err)
   })
   try {
      await next.connect()
   } catch {
      failedUntil = Date.now() + RETRY_COOLDOWN_MS
      try {
         next.destroy()
      } catch {
         // ignorieren — Fallback memory greift
      }
      return null
   }
   client = next as RedisClientType
   return client
}

function memoryCheck(key: string): void {
   const cutoff = Date.now() - SOLVE_RATE_WINDOW_S * 1000
   const times = (memoryHits.get(key) ?? []).filter((t) => t > cutoff)
   if (times.length >= SOLVE_RATE_MAX) {
      throw httpError(429, 'Zu viele Versuche — kurz warten, dann erneut eingeben')
   }
   times.push(Date.now())
   memoryHits.set(key, times)
}

export async function checkSolveRateLimit(code: string, station: number): Promise<void> {
   const key = `${code}:${station}`
   const r = await redis()
   if (r) {
      try {
         const count = await r.eval(RATE_LIMIT_LUA, {
            keys: [`${KEY_PREFIX}${key}`],
            arguments: [String(SOLVE_RATE_WINDOW_S)],
         })
         if (Number(count) > SOLVE_RATE_MAX) {
            throw httpError(429, 'Zu viele Versuche — kurz warten, dann erneut eingeben')
         }
         return
      } catch (err) {
         if (err instanceof HttpError) throw err
         console.error('[rate-limit] redis-Befehl fehlgeschlagen, Fallback memory')
      }
   }
   memoryCheck(key)
}

/** Nur für Tests — leert Memory-Fenster + Redis-Zähler (best-effort). */
export async function __resetSolveRateLimits(): Promise<void> {
   memoryHits.clear()
   if (client) {
      try {
         for await (const key of client.scanIterator({ MATCH: `${KEY_PREFIX}*` })) {
            await client.del(key)
         }
      } catch {
         // Test-Isolation ist nett, aber kein Pflichtprogramm
      }
   }
}

/** Nur für Tests/Long-Running-Prozesse — schließt die Redis-Verbindung. */
export async function __closeRateLimitClient(): Promise<void> {
   const c = client
   client = null
   failedUntil = 0
   if (c) {
      try {
         c.destroy()
      } catch {
         // ignorieren
      }
   }
}
