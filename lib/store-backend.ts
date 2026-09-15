// Persistenz-Layer für den Gruppen-Store.
// Backend-Wahl über Env: GROUP_STORE=json (Default) | sqlite | kv.
// - json: data/groups.json (lokal). Auf Vercel (read-only FS) Default nach /tmp.
// - sqlite: node:sqlite (Node 22.5+, kein extra Dep), WAL-Modus.
// - kv: Upstash Redis / Vercel KV per REST (fetch, kein extra Dep).
//   Env: KV_REST_API_URL (+KV_REST_API_TOKEN) oder UPSTASH_REDIS_REST_URL
//   (+UPSTASH_REDIS_REST_TOKEN). Key via GROUP_STORE_KEY (Default
//   'escape-game:store'). Ohne gesetztes GROUP_STORE wird kv automatisch
//   gewählt, sobald KV-Env vorhanden ist — sonst json.
// Alle Backends sprechen dieselbe load()/save()-Schnittstelle auf dem
// Gesamt-Store { groups: {...} }, sodass lib/group-store.ts unverändert bleibt.
// Save-Fehler (z.B. read-only FS) werfen nicht, sondern landen im
// Memory-Fallback + console.error — API gibt nie 500 wegen Persistenz.
// Postgres wäre der nächste Schritt: gleiche Schnittstelle, z.B. eine
// Tabelle kv(key TEXT PRIMARY KEY, value TEXT) mit key='store'.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StoreShape } from './types'

const KV_KEY = process.env.GROUP_STORE_KEY ?? 'escape-game:store'

interface KvConfig {
   url: string
   token: string
}

function kvConfig(): KvConfig | null {
   const url = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/+$/, '')
   const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? ''
   return url && token ? { url, token } : null
}

const KV = kvConfig()
const MODE = (process.env.GROUP_STORE ?? (KV ? 'kv' : 'json')).toLowerCase()

// Vercel: Filesystem read-only (außer /tmp), Instanzen ephemeral.
const ON_VERCEL = Boolean(process.env.VERCEL)
const DATA_DIR =
   process.env.GROUP_STORE_PATH != null
      ? path.dirname(process.env.GROUP_STORE_PATH)
      : ON_VERCEL
        ? path.join('/tmp', 'escape-game-next')
        : path.join(process.cwd(), 'data')

function jsonPath(): string {
   return process.env.GROUP_STORE_PATH ?? path.join(DATA_DIR, 'groups.json')
}

function sqlitePath(): string {
   return process.env.GROUP_STORE_PATH ?? path.join(DATA_DIR, 'groups.sqlite')
}

// Letzte bekannte Daten — Fallback, damit Reads/Saves nie crashen.
let memCache: StoreShape | null = null
const emptyStore = (): StoreShape => ({ groups: {} })

function validStore(store: unknown): StoreShape | null {
   if (store && typeof store === 'object' && 'groups' in store) {
      const groups = (store as { groups: unknown }).groups
      if (groups && typeof groups === 'object') return store as StoreShape
   }
   return null
}

/** Kopie zurückgeben — Aufrufer mutieren den Store, der Cache darf das nicht sehen. */
function clone<T>(value: T): T {
   return JSON.parse(JSON.stringify(value)) as T
}

function errorMessage(error: unknown): string {
   return error instanceof Error ? error.message : String(error)
}

async function loadJson(): Promise<StoreShape> {
   try {
      const parsed: unknown = JSON.parse(await readFile(jsonPath(), 'utf8'))
      const store = validStore(parsed) ?? emptyStore()
      memCache = store
      return store
   } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
         console.error('[store] load json failed:', errorMessage(error))
      }
      return memCache ? clone(memCache) : emptyStore()
   }
}

async function saveJson(store: StoreShape): Promise<void> {
   memCache = store
   try {
      await mkdir(DATA_DIR, { recursive: true })
      await writeFile(jsonPath(), JSON.stringify(store, null, 2), 'utf8')
   } catch (error) {
      console.error('[store] save json failed (memory fallback):', errorMessage(error))
   }
}

interface SqliteDb {
   exec(sql: string): void
   prepare(sql: string): { get(): { value: string } | undefined; run(...params: string[]): void }
}

let sqliteDb: SqliteDb | null = null

async function sqlite(): Promise<SqliteDb> {
   if (sqliteDb) return sqliteDb
   const { DatabaseSync } = (await import('node:sqlite')) as unknown as {
      DatabaseSync: new (path: string) => SqliteDb
   }
   await mkdir(DATA_DIR, { recursive: true })
   sqliteDb = new DatabaseSync(sqlitePath())
   sqliteDb.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
   sqliteDb.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
   return sqliteDb
}

async function loadSqlite(): Promise<StoreShape> {
   try {
      const db = await sqlite()
      const row = db.prepare("SELECT value FROM kv WHERE key = 'store'").get()
      if (!row) return memCache ? clone(memCache) : emptyStore()
      const store = validStore(JSON.parse(row.value) as unknown) ?? emptyStore()
      memCache = store
      return store
   } catch (error) {
      console.error('[store] load sqlite failed:', errorMessage(error))
      return memCache ? clone(memCache) : emptyStore()
   }
}

async function saveSqlite(store: StoreShape): Promise<void> {
   memCache = store
   try {
      const db = await sqlite()
      const raw = JSON.stringify(store)
      db.prepare(
         'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ).run('store', raw)
   } catch (error) {
      console.error('[store] save sqlite failed (memory fallback):', errorMessage(error))
   }
}

type KvResult = { result?: string | null; error?: string }

// Upstash-/Vercel-KV-REST via Pipeline (kein extra Dep, große Values OK).
async function kvPipeline(commands: string[][]): Promise<KvResult[]> {
   if (!KV) throw new Error('KV nicht konfiguriert')
   const res = await fetch(`${KV.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
   })
   if (!res.ok) throw new Error(`KV pipeline ${res.status}: ${await res.text().catch(() => '')}`)
   return (await res.json()) as KvResult[]
}

async function loadKv(): Promise<StoreShape> {
   try {
      const [out] = await kvPipeline([['GET', KV_KEY]])
      if (out?.error) throw new Error(out.error)
      if (out?.result == null) return memCache ? clone(memCache) : emptyStore()
      const store = validStore(JSON.parse(out.result) as unknown) ?? emptyStore()
      memCache = store
      return store
   } catch (error) {
      console.error('[store] load kv failed:', errorMessage(error))
      return memCache ? clone(memCache) : emptyStore()
   }
}

async function saveKv(store: StoreShape): Promise<void> {
   memCache = store
   try {
      const [out] = await kvPipeline([['SET', KV_KEY, JSON.stringify(store)]])
      if (out?.error) throw new Error(out.error)
   } catch (error) {
      console.error('[store] save kv failed (memory fallback):', errorMessage(error))
   }
}

export async function loadStore(): Promise<StoreShape> {
   if (MODE === 'kv') {
      if (!KV) throw new Error('GROUP_STORE=kv, aber KV_REST_API_URL/KV_REST_API_TOKEN (oder UPSTASH_*) fehlt')
      return loadKv()
   }
   const store = MODE === 'sqlite' ? await loadSqlite() : await loadJson()
   if (!store || typeof store !== 'object' || !store.groups) return emptyStore()
   return store
}

export async function saveStore(store: StoreShape): Promise<void> {
   if (MODE === 'kv') {
      if (!KV) throw new Error('GROUP_STORE=kv, aber KV_REST_API_URL/KV_REST_API_TOKEN (oder UPSTASH_*) fehlt')
      await saveKv(store)
   } else if (MODE === 'sqlite') await saveSqlite(store)
   else await saveJson(store)
}

export type BackendInfo = { mode: string; key: string; url: string | null } | { mode: string; path: string }

export function backendInfo(): BackendInfo {
   if (MODE === 'kv') return { mode: MODE, key: KV_KEY, url: KV ? KV.url : null }
   return { mode: MODE, path: MODE === 'sqlite' ? sqlitePath() : jsonPath() }
}
