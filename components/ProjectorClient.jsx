'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FINAL_PASSWORD, SOLUTIONS, STATIONS, normalizeInput } from '../lib/game-data/stations.js'

function remaining(settings) {
   if (!settings?.startedAt) return 'BEREIT'
   const end = settings.pausedAt ? Date.parse(settings.pausedAt) : Date.now()
   const elapsed = Math.max(0, end - Date.parse(settings.startedAt) - (settings.elapsedPauseMs ?? 0))
   const left = Math.max(0, (settings.timerMinutes ?? 60) * 60000 - elapsed)
   const min = Math.floor(left / 60000)
   const sec = Math.floor((left % 60000) / 1000)
   return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ProjectorClient({ groupCode }) {
   const [group, setGroup] = useState(null)
   const [error, setError] = useState('')
   const [offline, setOffline] = useState(false)
   const failures = useRef(0)

   const load = useCallback(async () => {
      const response = await fetch(`/api/groups/${groupCode}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Gruppe nicht erreichbar.')
      setGroup(await response.json())
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
         1000,
      )
      return () => window.clearInterval(id)
   }, [load])

   const letters = useMemo(() => {
      if (!group) return []
      return SOLUTIONS.map((solution) => {
         const value = group.solved?.[solution.n]
         const correct = value !== undefined && Number(normalizeInput(value)) === solution.solution
         return { ...solution, correct }
      })
   }, [group])

   if (!group) {
      return (
         <div className="projector">
            <div className="projector-time">VERBINDE</div>
            <p>{error || '…'} · Prüft WLAN und Server.</p>
            <button className="btn small" onClick={load}>Erneut verbinden</button>
         </div>
      )
   }

   const solvedCount = letters.filter((item) => item.correct).length
   const pct = Math.round((solvedCount / STATIONS.length) * 100)
   const reveal = group.settings?.revealFinale || solvedCount === STATIONS.length

   return (
      <div className="projector">
         {offline && (
            <div className="offline-banner">
               OFFLINE — letzte Daten · <button className="btn small" onClick={load}>Erneut verbinden</button>
            </div>
         )}
         <div className="projector-header">
            <div>GRUPPE {groupCode}{group.name ? ` · ${group.name}` : ''}</div>
            <div className="projector-time">{remaining(group.settings)}</div>
            <div>{solvedCount}/{STATIONS.length}</div>
         </div>
         <div className="projector-bar projector-bar-big">
            <div style={{ width: `${pct}%` }} />
         </div>
         <div className="projector-pct">{pct} %</div>
         <div className="projector-grid">
            {letters.map((item) => (
               <div className={`projector-cell ${item.correct ? 'done' : ''}`} key={item.n}>
                  <span>{String(item.n).padStart(2, '0')}</span>
                  <b>{item.correct ? item.letter : '·'}</b>
               </div>
            ))}
         </div>
         <div className="projector-word">
            {reveal ? FINAL_PASSWORD : letters.map((item) => (item.correct ? item.letter : '·')).join('')}
         </div>
      </div>
   )
}
