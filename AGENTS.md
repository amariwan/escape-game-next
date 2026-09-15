<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Escape Game Next — agent notes

Next 16 + React 19, App Router, JS-only (`.js`/`.jsx`, no TS). No test/lint/typecheck scripts.

## Commands
- `npm run dev` — dev server on port `5200`, hostname `0.0.0.0` (see `package.json`)
- `npm run build` / `npm start` — production build/serve, same port
- No tests, linter, formatter configured. Verify via `npm run build`.
- LAN dev allowed via `allowedDevOrigins` in `next.config.js`; extend there for new device IPs.

## Architecture
- Routes: `/` (`GroupGate` create/join) → `/play/[code]` (`GameClient`), `/join` (`AutoJoin`), `/admin/[code]` (`AdminClient`), `/projector` (`ProjectorClient`).
- State lives in `lib/group-store.js` backed by mutable `data/groups.json` (no DB). `normalizeGroup()` backfills defaults — sparse entries in JSON are normal, not corruption.
- Game content source of truth: `lib/game-data/stations.js` (20 stations, `solution`, `hints`, `SOLUTIONS`, `FINAL_PASSWORD`). Solutions mirror `EscapeGame_Anti-lomene.pdf` p.22; keep in sync when editing.
- API: `POST /api/groups` create (optional `{name}`); `GET /api/groups` list for scoreboard (heavy `dataUrl` stripped); `GET/POST /api/groups/[code]` with `body.action` in `reset|solve|settings|rename|timer|unlock|lock|hint|upload|approve-upload|reveal-finale`; `POST /api/groups/join` auto-assigns into pool (`MAX_MEMBERS=3`, groups share `poolCode`).
- Group fields beyond solved/unlocked: `name`, `attempts`/`errors` per station (counted in `solveStation`, reset keeps `name`), `teamPhoto` (upload with `station: 0`), uploads carry downscaled `dataUrl` (cap `MAX_DATAURL_CHARS`).
- Timer: `settings.timerMinutes` (presets 45/60/90 in admin) + `timer/adjust` with `minutes` ±30 lands in `elapsedPauseMs` (positive = Bonus). Modes: `linear|open|manual` — `manual` preserves current unlocks, only admin frees stations.
- Hint levels: use `hintLevelsFor()` from `stations.js` (`hintLevels` wins over `hints`); store `hint` action caps at the same array length. Don't use `station.hints.length` directly.
- Uploads: `approve-upload` with `approved:true` auto-solves stations with `kind: 'upload'`. Upload images are client-downscaled (≤1280px JPEG) before POST.
- Persistence: `lib/store-backend.js` — `GROUP_STORE=json` (default, `data/groups.json`) or `GROUP_STORE=sqlite` (WAL, `data/groups.sqlite`, zero-dep via `node:sqlite`). Same `{groups:{}}` shape; Postgres would implement the same `loadStore/saveStore` interface.
- Clients poll with `cache: 'no-store'`: projector 1s, game/admin 2s, scoreboard 5s. Offline banner appears after ≥2 consecutive poll failures. Keep polling; no websockets.
- Extra routes: `/scoreboard` (all groups, ranked), `/print` (print-friendly station cards + Lösungsschlüssel, `window.print` → PDF). Sounds in `lib/sound.js` (WebAudio, no assets).

## Conventions / gotchas
- Relative imports keep `.js` extension (`../../../lib/group-store.js`); `'use client'` on interactive components.
- Codes sanitized uppercase alnum (`cleanCode`); answers via `normalizeInput()` (strips `.,` whitespace, leading zeros) — compare numerically, preserve for station 8 mirror logic in `PuzzleBody.jsx`.
- Modes: `linear` unlocks `highestSolved+1`, `open` unlocks all (`nextUnlocked`). Station 1 always unlocked; lock action refuses station 1.
- `GET /api/groups/[code]` auto-creates group if missing — every stray fetch writes to `data/groups.json`. Don't probe random codes in dev; `data/groups.json` is runtime state, don't commit test groups.
- Uploads store metadata only (`name/size/type/approved`), no file bytes. Finale reveals when all solved (`finishedAt`+`revealFinale`) or via `reveal-finale` action.
- UI language German; global styles only in `app/globals.css`.
