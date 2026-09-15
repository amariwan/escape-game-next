'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { STATIONS } from '../lib/game-data/stations'
import { fetchJson, postJson } from '../lib/api-client'
import { hintLevelsFor } from '../lib/hints'
import { remainingLabel, timerStatus } from '../lib/time'
import { usePolling } from '../lib/use-polling'
import type { GameMode, GroupPayload } from '../lib/types'

const TIMER_PRESETS = [45, 60, 90]
const ADMIN_TOKEN_KEY = 'escape-admin-token'

export default function AdminClient({ groupCode }: { groupCode: string }) {
   const [timerMinutes, setTimerMinutes] = useState<number | string>(60)
   const [name, setName] = useState('')
   const [actionError, setActionError] = useState('')
   const [adminToken, setAdminToken] = useState('')

   // Spielleitungs-Passwort sitzt nur im Session-Speicher, nie in URL/GET.
   useEffect(() => {
      try {
         setAdminToken(window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '')
      } catch {
         // privater Modus o.ä. — Aktionen laufen ohne gespeicherten Token
      }
   }, [])

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
                  <div>{remainingLabel(group.settings)}</div>
                  <div>
                     {solvedCount}/{STATIONS.length} GELÖST
                  </div>
               </header>

               {offline && (
                  <div className="offline-banner">
                     OFFLINE — Server antwortet nicht (letzte Daten werden gezeigt).
                     <button type="button" className="btn small" onClick={() => void reload()}>
                        Erneut verbinden
                     </button>
                  </div>
               )}
               {error && !offline && <p className="feedback err">{error}</p>}
               {actionError && <p className="feedback err">{actionError}</p>}

               <section className="panel" data-tag="Steuerung">
                  <div className="admin-grid">
                     <label className="field">
                        Spielleitungs-Passwort
                        <span className="field-row">
                           <input
                              type="password"
                              value={adminToken}
                              onChange={(e) => saveToken(e.target.value)}
                              placeholder="—"
                              autoComplete="current-password"
                           />
                           {adminToken && (
                              <button type="button" className="btn small ghost" onClick={() => saveToken('')}>
                                 Löschen
                              </button>
                           )}
                        </span>
                     </label>
                     <label className="field">
                        Gruppenname
                        <span className="field-row">
                           <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="—" />
                           <button type="button" className="btn small" onClick={() => void send({ action: 'rename', name })}>
                              OK
                           </button>
                        </span>
                     </label>
                     <label className="field">
                        Modus
                        <select
                           value={group.settings.mode}
                           onChange={(event) => void send({ action: 'settings', mode: event.target.value as GameMode })}
                        >
                           <option value="linear">Linear (der Reihe nach)</option>
                           <option value="open">Alle Stationen offen</option>
                           <option value="manual">Nur per Freigabe (QR/Code)</option>
                        </select>
                     </label>
                     <div className="field">
                        Timer-Presets
                        <div className="btn-row">
                           {TIMER_PRESETS.map((m) => (
                              <button
                                 type="button"
                                 key={m}
                                 className={`btn small ${Number(group.settings.timerMinutes) === m ? '' : 'ghost'}`}
                                 onClick={() => void send({ action: 'settings', timerMinutes: m })}
                              >
                                 {m} Min
                              </button>
                           ))}
                        </div>
                     </div>
                     <label className="field">
                        Minuten (5–240)
                        <span className="field-row">
                           <input
                              type="number"
                              min="5"
                              max="240"
                              value={timerMinutes}
                              onChange={(event) => setTimerMinutes(event.target.value === '' ? '' : Number(event.target.value))}
                           />
                           <button type="button" className="btn small" onClick={() => void send({ action: 'settings', timerMinutes })}>
                              Setzen
                           </button>
                        </span>
                     </label>
                  </div>
                  <div className="btn-row">
                     <button type="button" className="btn small" onClick={() => void send({ action: 'timer', command: 'start' })}>
                        Start
                     </button>
                     <button type="button" className="btn small ghost" onClick={() => void send({ action: 'timer', command: 'pause' })}>
                        Pause
                     </button>
                     <button type="button" className="btn small ghost" onClick={() => void send({ action: 'timer', command: 'resume' })}>
                        Weiter
                     </button>
                     <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => void send({ action: 'timer', command: 'adjust', minutes: 5 })}
                     >
                        +5 Bonus
                     </button>
                     <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => void send({ action: 'timer', command: 'adjust', minutes: -5 })}
                     >
                        −5 Strafe
                     </button>
                     <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => void send({ action: 'reveal-finale', reveal: !group.settings.revealFinale })}
                     >
                        {group.settings.revealFinale ? 'Finale schließen' : 'Finale öffnen'}
                     </button>
                     <button type="button" className="btn small ghost" onClick={() => void send({ action: 'timer', command: 'finish' })}>
                        Beenden
                     </button>
                     <button type="button" className="btn small ghost" onClick={() => void send({ action: 'reset' })}>
                        Reset
                     </button>
                  </div>
                  <p className="hint">
                     Status: {timerStatus(group.settings)} · Versuche: {totalAttempts} · Fehler: {totalErrors} ·{' '}
                     <Link className="footer-link" href={`/projector/${groupCode}`}>
                        Beamer
                     </Link>{' '}
                     ·{' '}
                     <Link className="footer-link" href={`/play/${groupCode}`}>
                        Teamgerät
                     </Link>
                  </p>
               </section>

               <section className="admin-stations">
                  {STATIONS.map((station) => {
                     const solved = group.solved?.[station.n] !== undefined
                     const unlocked = group.unlocked?.[station.n]
                     const upload = group.uploads?.[station.n]
                     const hintCount = group.hints?.[station.n] ?? 0
                     const maxHints = hintLevelsFor(station).length
                     return (
                        <article className={`station-card ${solved ? 'done' : ''}`} key={station.n}>
                           <div>
                              <div className="eyebrow">Station {String(station.n).padStart(2, '0')}</div>
                              <h2>{station.title}</h2>
                              <p>
                                 {solved ? `gelöst: ${group.solved[station.n]}` : unlocked ? 'offen' : 'gesperrt'} · Hinweise:{' '}
                                 {hintCount}/{maxHints} · Versuche: {group.attempts?.[station.n] ?? 0} · Fehler:{' '}
                                 {group.errors?.[station.n] ?? 0}
                              </p>
                              {upload && <p>Upload: {upload.name} · {upload.approved ? 'bestätigt (Station gelöst)' : 'offen'}</p>}
                              {upload?.dataUrl && (
                                 // eslint-disable-next-line @next/next/no-img-element -- data:-URL aus Upload, nichts zu optimieren
                                 <img className="preview small" src={upload.dataUrl} alt={`Upload Station ${station.n}`} />
                              )}
                           </div>
                           <div className="card-actions">
                              <button
                                 type="button"
                                 className="btn small ghost"
                                 onClick={() => void send({ action: unlocked ? 'lock' : 'unlock', station: station.n })}
                              >
                                 {unlocked ? 'Sperren' : 'Freigeben'}
                              </button>
                              {upload && (
                                 <button
                                    type="button"
                                    className="btn small"
                                    onClick={() =>
                                       void send({
                                          action: 'approve-upload',
                                          station: station.n,
                                          approved: !upload.approved,
                                       })
                                    }
                                 >
                                    {upload.approved ? 'Zurücknehmen' : 'Bestätigen'}
                                 </button>
                              )}
                           </div>
                        </article>
                     )
                  })}
               </section>
            </div>
         </div>
      </div>
   )
}
