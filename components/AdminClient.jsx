'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { STATIONS, hintLevelsFor } from '../lib/game-data/stations.js'

function formatTime(settings) {
   if (!settings?.startedAt) return 'nicht gestartet'
   const end = settings.pausedAt ? Date.parse(settings.pausedAt) : Date.now()
   const elapsed = Math.max(0, end - Date.parse(settings.startedAt) - (settings.elapsedPauseMs ?? 0))
   const remaining = Math.max(0, (settings.timerMinutes ?? 60) * 60000 - elapsed)
   const min = Math.floor(remaining / 60000)
   const sec = Math.floor((remaining % 60000) / 1000)
   return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const TIMER_PRESETS = [45, 60, 90]

export default function AdminClient({ groupCode }) {
   const [group, setGroup] = useState(null)
   const [error, setError] = useState('')
   const [offline, setOffline] = useState(false)
   const [timerMinutes, setTimerMinutes] = useState(60)
   const [name, setName] = useState('')
   const failures = useRef(0)

   const load = useCallback(async () => {
      const response = await fetch(`/api/groups/${groupCode}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Gruppe nicht erreichbar.')
      const data = await response.json()
      setGroup(data)
      setTimerMinutes(data.settings?.timerMinutes ?? 60)
      setName(data.name ?? '')
      setError('')
      failures.current = 0
      setOffline(false)
   }, [groupCode])

   useEffect(() => {
      load().catch((err) => setError(err.message))
      const id = window.setInterval(
         () =>
            load().catch((err) => {
               failures.current += 1
               setError(err.message)
               if (failures.current >= 2) setOffline(true)
            }),
         2000,
      )
      return () => window.clearInterval(id)
   }, [load])

   async function send(payload) {
      try {
         const response = await fetch(`/api/groups/${groupCode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
         })
         if (!response.ok) throw new Error('Aktion fehlgeschlagen.')
         setGroup(await response.json())
         setError('')
      } catch (err) {
         setError(err.message)
      }
   }

   if (!group) {
      return (
         <div className="crt">
            <div className="bg-grid" />
            <div className="app"><div className="wrap"><div className="start">Admin wird verbunden</div>{error && <p className="feedback err">{error}</p>}</div></div>
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
                  <div><span className="dot" /> SPIELLEITUNG · {groupCode}{group.name ? ` · ${group.name}` : ''}</div>
                  <div>{formatTime(group.settings)}</div>
                  <div>{solvedCount}/{STATIONS.length} GELÖST</div>
               </header>

               {offline && (
                  <div className="offline-banner">
                     OFFLINE — Server antwortet nicht (letzte Daten werden gezeigt).
                     <button className="btn small" onClick={load}>Erneut verbinden</button>
                  </div>
               )}
               {error && !offline && <p className="feedback err">{error}</p>}

               <section className="panel" data-tag="Steuerung">
                  <div className="admin-grid">
                     <label className="field">
                        Gruppenname
                        <span className="field-row">
                           <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="—" />
                           <button className="btn small" onClick={() => send({ action: 'rename', name })}>OK</button>
                        </span>
                     </label>
                     <label className="field">
                        Modus
                        <select
                           value={group.settings.mode}
                           onChange={(event) => send({ action: 'settings', mode: event.target.value })}
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
                                 key={m}
                                 className={`btn small ${Number(group.settings.timerMinutes) === m ? '' : 'ghost'}`}
                                 onClick={() => send({ action: 'settings', timerMinutes: m })}
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
                              onChange={(event) => setTimerMinutes(event.target.value)}
                           />
                           <button className="btn small" onClick={() => send({ action: 'settings', timerMinutes })}>Setzen</button>
                        </span>
                     </label>
                  </div>
                  <div className="btn-row">
                     <button className="btn small" onClick={() => send({ action: 'timer', command: 'start' })}>Start</button>
                     <button className="btn small ghost" onClick={() => send({ action: 'timer', command: 'pause' })}>Pause</button>
                     <button className="btn small ghost" onClick={() => send({ action: 'timer', command: 'resume' })}>Weiter</button>
                     <button className="btn small ghost" onClick={() => send({ action: 'timer', command: 'adjust', minutes: 5 })}>+5 Bonus</button>
                     <button className="btn small ghost" onClick={() => send({ action: 'timer', command: 'adjust', minutes: -5 })}>−5 Strafe</button>
                     <button className="btn small ghost" onClick={() => send({ action: 'reveal-finale', reveal: !group.settings.revealFinale })}>
                        {group.settings.revealFinale ? 'Finale schließen' : 'Finale öffnen'}
                     </button>
                     <button className="btn small ghost" onClick={() => send({ action: 'timer', command: 'finish' })}>Beenden</button>
                     <button className="btn small ghost" onClick={() => send({ action: 'reset' })}>Reset</button>
                  </div>
                  <p className="hint">
                     Status: {group.settings.startedAt ? (group.settings.pausedAt ? 'pausiert' : 'läuft') : 'nicht gestartet'}
                     {' '}· Versuche: {totalAttempts} · Fehler: {totalErrors}
                     {' '}· <a className="footer-link" href={`/projector/${groupCode}`}>Beamer</a>
                     {' '}· <a className="footer-link" href={`/play/${groupCode}`}>Teamgerät</a>
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
                                 {solved ? `gelöst: ${group.solved[station.n]}` : (unlocked ? 'offen' : 'gesperrt')}
                                 {' '}· Hinweise: {hintCount}/{maxHints}
                                 {' '}· Versuche: {group.attempts?.[station.n] ?? 0} · Fehler: {group.errors?.[station.n] ?? 0}
                              </p>
                              {upload && (
                                 <p>
                                    Upload: {upload.name} · {upload.approved ? 'bestätigt (Station gelöst)' : 'offen'}
                                 </p>
                              )}
                              {upload?.dataUrl && (
                                 <img className="preview small" src={upload.dataUrl} alt={`Upload Station ${station.n}`} />
                              )}
                           </div>
                           <div className="card-actions">
                              <button
                                 className="btn small ghost"
                                 onClick={() => send({ action: unlocked ? 'lock' : 'unlock', station: station.n })}
                              >
                                 {unlocked ? 'Sperren' : 'Freigeben'}
                              </button>
                              {upload && (
                                 <button
                                    className="btn small"
                                    onClick={() =>
                                       send({
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
