<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Escape Game Next — agent notes

Next 16 + React 19, App Router, TypeScript strict (`.ts`/`.tsx`, `npm run typecheck`).

## Commands
- `npm run dev` — dev server on port `5200`, hostname `0.0.0.0` (see `package.json`)
- `npm run build` / `npm start` — production build/serve, same port
- `npm run typecheck` — `tsc --noEmit`; `npm run lint` — ESLint flat (`eslint.config.mjs`, Next core-web-vitals + TS)
- `npm run test` — Vitest unit (`tests/unit`, node) + components (`tests/components`, jsdom); `npm run test:e2e` — Playwright (Chromium, isolierter Store via `GROUP_STORE_PATH=test-results/e2e-store/groups.json`)
- `npm run verify` — typecheck + lint + test + build. No formatter configured.
- LAN dev allowed via `allowedDevOrigins` in `next.config.js`; extend there for new device IPs.

## Architecture
- Routes: `/` (`GroupGate` create/join) → `/play/[code]` (`GameClient`), `/join` (`AutoJoin`), `/admin/[code]` (`AdminClient`), `/projector` (`ProjectorClient`).
- State lives in `lib/group-store.ts` backed by mutable `data/groups.json` (no DB). `normalizeGroup()` backfills defaults — sparse entries in JSON are normal, not corruption. All read-modify-write ops run serialized via `runExclusive` (no lost updates under parallel polls).
- Game content source of truth: `lib/game-data/stations.ts` (20 stations, `solution`, `hints`, `SOLUTIONS`, `FINAL_PASSWORD`). Solutions mirror `EscapeGame_Anti-lomene.pdf` p.22; keep in sync when editing. Jede Station muss den Renderer-Vertrag ihres `kind` erfüllen (`tests/unit/stations.test.ts` prüft Pflichtfelder — Station 10/12/15 crashten früher mit falschem `kind`).
- API: `POST /api/groups` create (optional `{name}`); `GET /api/groups` list for scoreboard (heavy `dataUrl` stripped); `GET /api/groups/[code]` **read-only, 404 when missing** (no auto-create); `POST` with `body.action` in `reset|solve|settings|rename|timer|unlock|lock|hint|upload|approve-upload|reveal-finale|navigate`; `POST /api/groups/join` with `{memberId, poolCode}` (QR auto-assign, `MAX_MEMBERS=3`) or `{code, memberId}` (explicit join, registers device, 409 when full). Client errors are 400/401/403/404/409/413/429 via `HttpError`, never silent no-ops.
- Admin-Schutz: `ADMIN_PASSWORD` (Env, z.B. `.env.local`) schaltet den Guard in `lib/admin-auth.ts` scharf — Admin-Aktionen (`reset|settings|rename|timer|unlock|lock|approve-upload|reveal-finale`) brauchen dann `body.adminToken`, sonst 401. Team-Aktionen (`solve|hint|upload|navigate`) bleiben ohne Token. Ohne gesetztes Passwort bleibt alles offen (Dev/Tests). Admin-Token liegt nur im `sessionStorage`, nie in URL/GET.
- Anti-Cheat: `solveStation` verweigert gesperrte Stationen (403, ohne Zähler) + Rate-Limit 12 Versuche/60s je Gruppe+Station (429). Limit lebt in `lib/rate-limit.ts`: `REDIS_URL` gesetzt → Redis (atomares Lua-INCR+EXPIRE, Key `escape:solve:{code}:{station}`, TTL 60s), sonst In-Memory. Redis-Ausfall → fail-open mit Log (kein Auto-Reconnect, `disableOfflineQueue`, 1s-Timeout). Tests in `tests/unit/rate-limit.test.ts` (Live-Test nur mit `TEST_LIVE_REDIS=1 REDIS_URL=...`).
- UI: shadcn/new-york-Fundament (Tailwind v4 via `@tailwindcss/postcss`, Tokens in `app/globals.css` auf `:root` im CRT-Look — App ist immer dunkel, keine `.dark`-Klasse; `components.json`, `cn()` in `lib/utils.ts`). Komponenten in `components/ui/` (`button|input|card|label|badge`, Lucide-Icons). Admin (`AdminClient`) nutzt shadcn, Spiel-UI bleibt Custom-CSS. `npx shadcn@latest add <x>` für weitere Komponenten (Aliase `@/…` in `tsconfig.json` vorhanden, Code nutzt relative Imports ohne Extension).
- Team-Follow: `activeStation` (1–20) + `activePhase` (`play|finale`) sind Server-State; `solve` rückt `activeStation` automatisch vor, `navigate` (`{station, phase}`, Team-Aktion, nur freigeschaltete Stationen) setzt ihn. `GameClient` folgt per Poll (Refresh landet auf Team-Stand, Fremd-Solve zieht alle weiter); Intro/QR bleiben lokal.
- Payload carries `letters` (only solved stations) + `finalWord` (only when `revealFinale`) — Finale/Projector never import solutions. Server is the only solve authority; client `check()` awaits `valid` from POST.
- Group fields beyond solved/unlocked: `name`, `attempts`/`errors` per station (counted in `solveStation`, reset keeps `name`; re-solve is idempotent, empty input is 400 without counting), `teamPhoto` (upload with `station: 0`), uploads carry downscaled `dataUrl` (oversize → 413, not truncation).
- Timer: `settings.timerMinutes` (presets 45/60/90 in admin) + `timer/adjust` with `minutes` ±30 lands in `elapsedPauseMs` (positive = Bonus). Modes: `linear|open|manual` — `manual` preserves current unlocks, only admin frees stations. Shared helpers in `lib/time.ts` (`remainingLabel`, `elapsedMs` — frozen at `finishedAt`); client clocks may drift, acceptable for event use.
- Hint levels: use `hintLevelsFor()` from `lib/hints.ts` (`hintLevels` wins over `hints`); store `hint` action caps at the same array length. Don't use `station.hints.length` directly.
- Uploads: `approve-upload` with `approved:true` auto-solves stations with `kind: 'upload'`. Upload images are client-downscaled (≤1280px JPEG) before POST.
- Persistence: `lib/store-backend.ts` — `GROUP_STORE=json` (default, `data/groups.json`) or `GROUP_STORE=sqlite` (WAL, `data/groups.sqlite`, zero-dep via `node:sqlite`). Same `{groups:{}}` shape; Postgres would implement the same `loadStore/saveStore` interface. Memory fallback returns clones (callers mutate).
- Clients poll with `cache: 'no-store'` via `usePolling()` in `lib/use-polling.ts` (single hook: data/error/offline/loading/reload/ingest): projector 1s, game/admin 2s, scoreboard 5s. Offline banner appears after ≥2 consecutive poll failures. Keep polling; no websockets. POSTs go through `postJson()` in `lib/api-client.ts` (server `{error}` reaches UI).
- Extra routes: `/scoreboard` (all groups, ranked), `/print` (print-friendly station cards + Lösungsschlüssel, `window.print` → PDF). Sounds in `lib/sound.ts` (WebAudio, no assets). Image-Downscale lebt einmalig in `lib/image.ts` (`PuzzleBody` + `Finale` teilen ihn).

## Conventions / gotchas
- Relative imports are extensionless (`../../../lib/group-store`); `'use client'` on interactive components. Turbopack does NOT resolve `.js`→`.ts` — never re-add extensions.
- NEVER import `lib/game-data/stations.ts` (or `SOLUTIONS`/`FINAL_PASSWORD`) into player-facing components (`GameClient`, `StationView`, `PuzzleBody`, `Finale`, `ProjectorClient`) — solutions would ship in the browser bundle. Player code uses `PUBLIC_STATIONS` + `lib/hints.ts` (`normalizeInput`, `hintLevelsFor`); full `STATIONS` is reserved for server code + Leitung (admin/print).
- Codes sanitized uppercase alnum (`cleanCode`); answers via `normalizeInput()` (strips `.,` whitespace, leading zeros) — compare numerically.
- Modes: `linear` unlocks `highestSolved+1`, `open` unlocks all (`nextUnlocked`). Station 1 always unlocked; lock action refuses station 1.
- `GET /api/groups/[code]` is read-only (404 when missing) — safe to poll/probe. `POST /api/groups/join` with `{code}` creates on explicit join only. `data/groups.json` is runtime state, don't commit test groups.
- Uploads store metadata only (`name/size/type/approved`), no file bytes. Finale reveals when all solved (`finishedAt`+`revealFinale`) or via `reveal-finale` action (also honored alone, like projector).
- UI language German; global styles only in `app/globals.css`.
