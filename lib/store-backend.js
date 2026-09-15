// Persistenz-Layer für den Gruppen-Store.
// Backend-Wahl über Env: GROUP_STORE=json (Default) oder GROUP_STORE=sqlite.
// Beide Backends sprechen dieselbe load()/save()-Schnittstelle auf dem
// Gesamt-Store { groups: {...} }, sodass lib/group-store.js unverändert bleibt.
// SQLite nutzt node:sqlite (Node 22.5+, kein extra Dep) mit WAL-Modus —
// crash-sicher und transaktional, für Hosting geeigneter als groups.json.
// Pfad: GROUP_STORE_PATH oder data/groups.json bzw. data/groups.sqlite.
// Postgres wäre der nächste Schritt: gleiche Schnittstelle, z.B. eine
// Tabelle kv(key TEXT PRIMARY KEY, value TEXT) mit key='store'.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')
const MODE = (process.env.GROUP_STORE ?? 'json').toLowerCase()

function jsonPath() {
   return process.env.GROUP_STORE_PATH ?? path.join(DATA_DIR, 'groups.json')
}

function sqlitePath() {
   return process.env.GROUP_STORE_PATH ?? path.join(DATA_DIR, 'groups.sqlite')
}

async function loadJson() {
   try {
      return JSON.parse(await readFile(jsonPath(), 'utf8'))
   } catch {
      return { groups: {} }
   }
}

async function saveJson(store) {
   await mkdir(DATA_DIR, { recursive: true })
   await writeFile(jsonPath(), JSON.stringify(store, null, 2), 'utf8')
}

let sqliteDb = null

async function sqlite() {
   if (sqliteDb) return sqliteDb
   const { DatabaseSync } = await import('node:sqlite')
   await mkdir(DATA_DIR, { recursive: true })
   sqliteDb = new DatabaseSync(sqlitePath())
   sqliteDb.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
   sqliteDb.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
   return sqliteDb
}

async function loadSqlite() {
   const db = await sqlite()
   const row = db.prepare("SELECT value FROM kv WHERE key = 'store'").get()
   if (!row) return { groups: {} }
   try {
      return JSON.parse(row.value)
   } catch {
      return { groups: {} }
   }
}

async function saveSqlite(store) {
   const db = await sqlite()
   const raw = JSON.stringify(store)
   db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
      'store',
      raw,
   )
}

export async function loadStore() {
   const store = MODE === 'sqlite' ? await loadSqlite() : await loadJson()
   if (!store || typeof store !== 'object' || !store.groups) return { groups: {} }
   return store
}

export async function saveStore(store) {
   if (MODE === 'sqlite') await saveSqlite(store)
   else await saveJson(store)
}

export function backendInfo() {
   return { mode: MODE, path: MODE === 'sqlite' ? sqlitePath() : jsonPath() }
}
