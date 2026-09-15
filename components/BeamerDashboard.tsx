'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { KeyRound, MonitorPlay, Plus, Users, X } from 'lucide-react'
import { PUBLIC_STATIONS } from '../lib/game-data/stations'
import { fetchJson, postJson } from '../lib/api-client'
import { remainingLabel } from '../lib/time'
import { usePolling } from '../lib/use-polling'
import type { EventMode, EventSettings, GroupPayload } from '../lib/types'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'

const ADMIN_TOKEN_KEY = 'escape-admin-token'

interface WallData {
   groups: GroupPayload[]
   event: EventSettings
}

function progressOf(group: GroupPayload): { solved: number; total: number; pct: number } {
   const total = group.stationCount ?? PUBLIC_STATIONS.length
   const solved = Object.keys(group.letters ?? {}).length
   return { solved, total, pct: total === 0 ? 0 : Math.round((solved / total) * 100) }
}

function wordOf(group: GroupPayload): string {
   const { solved, total } = progressOf(group)
   const reveal = group.settings?.revealFinale || solved === total
   if (reveal) return group.finalWord ?? ''
   return PUBLIC_STATIONS.map((s) => group.letters?.[s.n] ?? '·').join('')
}

function GroupCard({ group, isSolo }: { group: GroupPayload; isSolo: boolean }) {
   const { solved, total, pct } = progressOf(group)
   return (
      <article className={`beamer-card${isSolo ? ' solo' : ''}`}>
         <div className="beamer-card-head">
            <div>
               GRUPPE {group.code}
               {group.name ? ` · ${group.name}` : ''}
               {isSolo && <span className="beamer-solo-badge">SOLO · LIVE</span>}
            </div>
            <div className="beamer-card-time">{remainingLabel(group.settings)}</div>
            <div>
               {solved}/{total}
            </div>
         </div>
         <div className="projector-bar">
            <div style={{ width: `${pct}%` }} />
         </div>
         <div className="projector-grid">
            {PUBLIC_STATIONS.map((s) => (
               <div className={`projector-cell ${group.letters?.[s.n] ? 'done' : ''}`} key={s.n}>
                  <span>{String(s.n).padStart(2, '0')}</span>
                  <b>{group.letters?.[s.n] ?? '·'}</b>
               </div>
            ))}
         </div>
         <div className="beamer-card-word">{wordOf(group)}</div>
         <div className="beamer-card-links">
            <Link className="btn small ghost" href={`/play/${group.code}`}>
               <Users className="size-3.5" />
               Team
            </Link>
            <Link className="btn small ghost" href={`/admin/${group.code}`}>
               Leitung
            </Link>
            <Link className="btn small ghost" href={`/projector/${group.code}`}>
               <MonitorPlay className="size-3.5" />
               Beamer
            </Link>
         </div>
      </article>
   )
}

export default function BeamerDashboard() {
   const [adminToken, setAdminToken] = useState(() => {
      try {
         return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? ''
      } catch {
         return ''
      }
   })
   const [soloPick, setSoloPick] = useState('')
   const [actionError, setActionError] = useState('')
   const [busy, setBusy] = useState(false)

   function saveToken(next: string) {
      setAdminToken(next)
      try {
         if (next) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, next)
         else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      } catch {
         // ignorieren — Token gilt dann nur im State
      }
   }

   const fetcher = useCallback(async (): Promise<WallData> => {
      const [groupsData, event] = await Promise.all([
         fetchJson<{ groups?: GroupPayload[] }>('/api/groups', { cache: 'no-store' }),
         fetchJson<EventSettings>('/api/event', { cache: 'no-store' }),
      ])
      const groups = [...(groupsData.groups ?? [])].sort((a, b) => {
         const sa = Object.keys(a.solved ?? {}).length
         const sb = Object.keys(b.solved ?? {}).length
         if (sb !== sa) return sb - sa
         return a.updatedAt.localeCompare(b.updatedAt)
      })
      return { groups, event }
   }, [])

   const onData = useCallback((data: WallData) => {
      setSoloPick((prev) => prev || data.event.soloCode || data.groups[0]?.code || '')
   }, [])

   const { data, error, offline, reload } = usePolling(fetcher, 2000, onData)

   async function setMode(mode: EventMode) {
      setBusy(true)
      setActionError('')
      try {
         await postJson('/api/event', { mode, soloCode: mode === 'solo' ? soloPick || undefined : undefined, adminToken })
         await reload()
      } catch (err) {
         const msg = err instanceof Error ? err.message : 'Umschalten fehlgeschlagen.'
         setActionError(
            msg.includes('401') || msg.toLowerCase().includes('passwort')
               ? 'Spielleitungs-Passwort falsch oder fehlt — oben eingeben.'
               : msg,
         )
      } finally {
         setBusy(false)
      }
   }

   async function createGroup() {
      setBusy(true)
      setActionError('')
      try {
         await postJson('/api/groups', { name: '' })
         await reload()
      } catch (err) {
         setActionError(err instanceof Error ? err.message : 'Gruppe konnte nicht erstellt werden.')
      } finally {
         setBusy(false)
      }
   }

   const groups = data?.groups ?? []
   const event = data?.event
   const soloFirst = event?.mode === 'solo' && event.soloCode
      ? [...groups].sort((a, b) => (a.code === event.soloCode ? -1 : b.code === event.soloCode ? 1 : 0))
      : groups

   return (
      <div className="projector">
         {offline && (
            <div className="offline-banner">
               OFFLINE — letzte Daten ·{' '}
               <button type="button" className="btn small" onClick={() => void reload()}>
                  Erneut verbinden
               </button>
            </div>
         )}
         <div className="projector-header">
            <div>BEAMER-WAND · {event ? (event.mode === 'solo' ? `SOLO ${event.soloCode ?? ''}` : 'MULTI') : '…'} </div>
            <div className="projector-time">{groups.length}</div>
            <div>{groups.length === 1 ? 'Gruppe' : 'Gruppen'}</div>
         </div>

         <Card>
            <CardHeader>
               <CardTitle>Event-Steuerung</CardTitle>
               <CardDescription>
                  Solo: ein Event, eine Gruppe — alle Geräte spielen gemeinsam (ohne Geräte-Limit). Multi: beliebig viele
                  Gruppen parallel (max. 3 Geräte pro Gruppe).
               </CardDescription>
            </CardHeader>
            <CardContent>
               <div className="admin-grid">
                  <div className="grid gap-1.5">
                     <Label htmlFor="beamer-token">
                        <KeyRound className="size-3.5" />
                        Spielleitungs-Passwort
                     </Label>
                     <div className="flex gap-2">
                        <Input
                           id="beamer-token"
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
                     <Label>Modus</Label>
                     <div className="flex flex-wrap gap-2">
                        <Button
                           type="button"
                           size="sm"
                           variant={event?.mode === 'solo' ? 'default' : 'outline'}
                           disabled={busy}
                           onClick={() => void setMode('solo')}
                        >
                           Solo — eine Gruppe
                        </Button>
                        <Button
                           type="button"
                           size="sm"
                           variant={event?.mode !== 'solo' ? 'default' : 'outline'}
                           disabled={busy}
                           onClick={() => void setMode('multi')}
                        >
                           Multi — viele Gruppen
                        </Button>
                     </div>
                  </div>
                  <div className="grid gap-1.5">
                     <Label htmlFor="beamer-solo">Solo-Gruppe</Label>
                     <div className="flex gap-2">
                        <select
                           id="beamer-solo"
                           className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] [&>option]:bg-popover"
                           value={soloPick}
                           onChange={(e) => setSoloPick(e.target.value)}
                        >
                           <option value="">Neueste / neue Event-Gruppe</option>
                           {groups.map((g) => (
                              <option key={g.code} value={g.code}>
                                 {g.code}
                                 {g.name ? ` · ${g.name}` : ''}
                              </option>
                           ))}
                        </select>
                     </div>
                  </div>
                  <div className="grid gap-1.5">
                     <Label>Gruppen</Label>
                     <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void createGroup()}>
                           <Plus />
                           Neue Gruppe
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => void reload()}>
                           Aktualisieren
                        </Button>
                     </div>
                  </div>
               </div>
               {(error || actionError) && (
                  <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive mt-3">
                     {actionError || error}
                  </p>
               )}
            </CardContent>
         </Card>

         <section className="beamer-wall">
            {soloFirst.map((group) => (
               <GroupCard key={group.code} group={group} isSolo={event?.mode === 'solo' && event.soloCode === group.code} />
            ))}
            {groups.length === 0 && !error && <p className="hint">Noch keine Gruppen — oben die erste erstellen.</p>}
         </section>
      </div>
   )
}
