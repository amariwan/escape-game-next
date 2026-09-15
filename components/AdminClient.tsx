'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import {
   Check,
   Flag,
   KeyRound,
   Lock,
   LockOpen,
   Minus,
   MonitorPlay,
   Pause,
   Play,
   Plus,
   RotateCcw,
   Timer,
   Users,
   X,
} from 'lucide-react'
import { STATIONS } from '../lib/game-data/stations'
import { fetchJson, postJson } from '../lib/api-client'
import { hintLevelsFor } from '../lib/hints'
import { remainingLabel, timerStatus } from '../lib/time'
import { usePolling } from '../lib/use-polling'
import type { GameMode, GroupPayload } from '../lib/types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'

const TIMER_PRESETS = [45, 60, 90]
const ADMIN_TOKEN_KEY = 'escape-admin-token'

export default function AdminClient({ groupCode }: { groupCode: string }) {
   const [timerMinutes, setTimerMinutes] = useState<number | string>(60)
   const [name, setName] = useState('')
   const [actionError, setActionError] = useState('')
   // Spielleitungs-Passwort sitzt nur im Session-Speicher, nie in URL/GET.
   // Lazy-Init statt Effekt — läuft nur clientseitig ('use client').
   const [adminToken, setAdminToken] = useState(() => {
      try {
         return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
      } catch {
         return ''
      }
   })

   function saveToken(next: string) {
      setAdminToken(next)
      try {
         if (next) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, next)
         else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      } catch {
         // ignorieren — Token gilt dann nur für diese Sitzung im State
      }
   }

   const fetcher = useCallback(
      () => fetchJson<GroupPayload>(`/api/groups/${groupCode}`, { cache: 'no-store' }),
      [groupCode],
   )
   const onData = useCallback((data: GroupPayload) => {
      setTimerMinutes(data.settings?.timerMinutes ?? 60)
      setName(data.name ?? '')
   }, [])

   const { data: group, error, offline, reload, ingest } = usePolling(fetcher, 2000, onData)

   async function send(payload: Record<string, unknown>) {
      try {
         ingest(await postJson<GroupPayload>(`/api/groups/${groupCode}`, { ...payload, adminToken }))
         setActionError('')
      } catch (err) {
         const msg = err instanceof Error ? err.message : 'Aktion fehlgeschlagen.'
         setActionError(
            msg.includes('401') || msg.toLowerCase().includes('passwort')
               ? 'Spielleitungs-Passwort falsch oder fehlt — oben eingeben.'
               : msg,
         )
      }
   }

   if (!group) {
      return (
         <div className="crt">
            <div className="bg-grid" />
            <div className="app">
               <div className="wrap">
                  <div className="start">Admin wird verbunden</div>
                  {error && <p className="feedback err">{error}</p>}
               </div>
            </div>
         </div>
      )
   }

   const solvedCount = Object.keys(group.solved ?? {}).length
   const totalAttempts = Object.values(group.attempts ?? {}).reduce((a, b) => a + Number(b ?? 0), 0)
   const totalErrors = Object.values(group.errors ?? {}).reduce((a, b) => a + Number(b ?? 0), 0)

   return (
      <div className="crt">
         <div className="bg-grid" />
         <div className="app">
            <div className="wrap admin-wrap">
               <header className="topbar">
                  <div>
                     <span className="dot" /> SPIELLEITUNG · {groupCode}
                     {group.name ? ` · ${group.name}` : ''}
                  </div>
                  <div className="flex items-center gap-1.5">
                     <Timer className="size-4" />
                     {remainingLabel(group.settings)}
                  </div>
                  <div className="flex items-center gap-1.5">
                     <Users className="size-4" />
                     {solvedCount}/{STATIONS.length} GELÖST
                  </div>
               </header>

               {offline && (
                  <div className="offline-banner">
                     OFFLINE — Server antwortet nicht (letzte Daten werden gezeigt).
                     <Button type="button" size="sm" variant="outline" onClick={() => void reload()}>
                        Erneut verbinden
                     </Button>
                  </div>
               )}
               {error && !offline && (
                  <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                     {error}
                  </p>
               )}
               {actionError && (
                  <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                     {actionError}
                  </p>
               )}

               <Card>
                  <CardHeader>
                     <CardTitle>Steuerung</CardTitle>
                     <CardDescription>
                        Status: {timerStatus(group.settings)} · Versuche: {totalAttempts} · Fehler: {totalErrors}
                     </CardDescription>
                     <CardAction className="flex gap-2">
                        <Button type="button" size="sm" variant="link" asChild>
                           <Link href={`/projector/${groupCode}`}>
                              <MonitorPlay />
                              Beamer
                           </Link>
                        </Button>
                        <Button type="button" size="sm" variant="link" asChild>
                           <Link href={`/play/${groupCode}`}>
                              <Users />
                              Teamgerät
                           </Link>
                        </Button>
                     </CardAction>
                  </CardHeader>
                  <CardContent>
                     <div className="admin-grid">
                        <div className="grid gap-1.5">
                           <Label htmlFor="admin-token">
                              <KeyRound className="size-3.5" />
                              Spielleitungs-Passwort
                           </Label>
                           <div className="flex gap-2">
                              <Input
                                 id="admin-token"
                                 type="password"
                                 value={adminToken}
                                 onChange={(e) => saveToken(e.target.value)}
                                 placeholder="—"
                                 autoComplete="current-password"
                              />
                              {adminToken && (
                                 <Button type="button" size="icon" variant="ghost" onClick={() => saveToken('')} aria-label="Passwort löschen">
                                    <X />
                                 </Button>
                              )}
                           </div>
                        </div>
                        <div className="grid gap-1.5">
                           <Label htmlFor="admin-name">Gruppenname</Label>
                           <div className="flex gap-2">
                              <Input
                                 id="admin-name"
                                 value={name}
                                 onChange={(e) => setName(e.target.value)}
                                 maxLength={60}
                                 placeholder="—"
                              />
                              <Button type="button" size="sm" onClick={() => void send({ action: 'rename', name })}>
                                 OK
                              </Button>
                           </div>
                        </div>
                        <div className="grid gap-1.5">
                           <Label htmlFor="admin-mode">Modus</Label>
                           <select
                              id="admin-mode"
                              className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [&>option]:bg-popover"
                              value={group.settings.mode}
                              onChange={(event) => void send({ action: 'settings', mode: event.target.value as GameMode })}
                           >
                              <option value="linear">Linear (Reihenfolge)</option>
                              <option value="open">Alle Stationen offen</option>
                              <option value="manual">Nur per Freigabe</option>
                              <option value="split">Split — jede:r löst eigene Station</option>
                           </select>
                        </div>
                        <div className="grid gap-1.5">
                           <Label>Timer-Presets</Label>
                           <div className="flex flex-wrap gap-2">
                              {TIMER_PRESETS.map((m) => (
                                 <Button
                                    type="button"
                                    key={m}
                                    size="sm"
                                    variant={Number(group.settings.timerMinutes) === m ? 'default' : 'outline'}
                                    onClick={() => void send({ action: 'settings', timerMinutes: m })}
                                 >
                                    {m} Min
                                 </Button>
                              ))}
                           </div>
                        </div>
                        <div className="grid gap-1.5">
                           <Label htmlFor="admin-minutes">Minuten (5–240)</Label>
                           <div className="flex gap-2">
                              <Input
                                 id="admin-minutes"
                                 type="number"
                                 min="5"
                                 max="240"
                                 value={timerMinutes}
                                 onChange={(event) => setTimerMinutes(event.target.value === '' ? '' : Number(event.target.value))}
                              />
                              <Button type="button" size="sm" onClick={() => void send({ action: 'settings', timerMinutes })}>
                                 Setzen
                              </Button>
                           </div>
                        </div>
                     </div>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                     <Button type="button" size="sm" onClick={() => void send({ action: 'timer', command: 'start' })}>
                        <Play />
                        Start
                     </Button>
                     <Button type="button" size="sm" variant="outline" onClick={() => void send({ action: 'timer', command: 'pause' })}>
                        <Pause />
                        Pause
                     </Button>
                     <Button type="button" size="sm" variant="outline" onClick={() => void send({ action: 'timer', command: 'resume' })}>
                        Weiter
                     </Button>
                     <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void send({ action: 'timer', command: 'adjust', minutes: 5 })}
                     >
                        <Plus />
                        5 Bonus
                     </Button>
                     <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void send({ action: 'timer', command: 'adjust', minutes: -5 })}
                     >
                        <Minus />
                        5 Strafe
                     </Button>
                     <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void send({ action: 'reveal-finale', reveal: !group.settings.revealFinale })}
                     >
                        <Flag />
                        {group.settings.revealFinale ? 'Finale schließen' : 'Finale öffnen'}
                     </Button>
                     <Button type="button" size="sm" variant="secondary" onClick={() => void send({ action: 'timer', command: 'finish' })}>
                        Beenden
                     </Button>
                     <Button type="button" size="sm" variant="destructive" onClick={() => void send({ action: 'reset' })}>
                        <RotateCcw />
                        Reset
                     </Button>
                  </CardFooter>
               </Card>

                {group.settings.mode === 'split' && (
                   <p className="hint">
                      Split aktiv: {Object.keys(group.split?.assignments ?? {}).length} Aufgabe(n) verteilt ·{' '}
                      {Object.values(group.split?.assignments ?? {}).filter((n) => group.solved?.[n] !== undefined).length}{' '}
                      gelöst — Finale öffnet sich automatisch bei allen.
                   </p>
                )}
                <section className="admin-stations">
                   {STATIONS.map((station) => {
                      const solved = group.solved?.[station.n] !== undefined
                      const unlocked = group.unlocked?.[station.n]
                      const upload = group.uploads?.[station.n]
                      const hintCount = group.hints?.[station.n] ?? 0
                      const maxHints = hintLevelsFor(station).length
                      const assignee = Object.entries(group.split?.assignments ?? {}).find(([, n]) => n === station.n)?.[0]
                     return (
                        <Card key={station.n} className={solved ? 'border-primary/60' : ''}>
                           <CardHeader>
                              <div className="eyebrow">Station {String(station.n).padStart(2, '0')}</div>
                              <CardTitle>{station.title}</CardTitle>
                              <CardAction>
                                 {solved ? (
                                    <Badge>
                                       <Check />
                                       {group.solved[station.n]}
                                    </Badge>
                                 ) : unlocked ? (
                                    <Badge variant="secondary">offen</Badge>
                                 ) : (
                                    <Badge variant="outline">
                                       <Lock className="size-3" />
                                       gesperrt
                                    </Badge>
                                 )}
                              </CardAction>
                           </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                               <p>
                                  Hinweise: {hintCount}/{maxHints} · Versuche: {group.attempts?.[station.n] ?? 0} · Fehler:{' '}
                                  {group.errors?.[station.n] ?? 0}
                               </p>
                               {assignee && <p>Aufgabe von Gerät {assignee.slice(0, 8)}…</p>}
                              {upload && (
                                 <p>
                                    Upload: {upload.name} · {upload.approved ? 'bestätigt (Station gelöst)' : 'wartet auf Bestätigung'}
                                 </p>
                              )}
                              {upload?.dataUrl && (
                                 // eslint-disable-next-line @next/next/no-img-element -- data:-URL aus Upload, nichts zu optimieren
                                 <img className="preview small" src={upload.dataUrl} alt={`Upload Station ${station.n}`} />
                              )}
                           </CardContent>
                           <CardFooter className="flex flex-wrap gap-2">
                              <Button
                                 type="button"
                                 size="sm"
                                 variant="outline"
                                 onClick={() => void send({ action: unlocked ? 'lock' : 'unlock', station: station.n })}
                              >
                                 {unlocked ? <Lock /> : <LockOpen />}
                                 {unlocked ? 'Sperren' : 'Freigeben'}
                              </Button>
                              {upload && (
                                 <Button
                                    type="button"
                                    size="sm"
                                    variant={upload.approved ? 'secondary' : 'default'}
                                    onClick={() =>
                                       void send({
                                          action: 'approve-upload',
                                          station: station.n,
                                          approved: !upload.approved,
                                       })
                                    }
                                 >
                                    {upload.approved ? <X /> : <Check />}
                                    {upload.approved ? 'Zurücknehmen' : 'Bestätigen'}
                                 </Button>
                              )}
                           </CardFooter>
                        </Card>
                     )
                  })}
               </section>
            </div>
         </div>
      </div>
   )
}
