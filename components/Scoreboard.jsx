'use client'

import { useCallback, useEffect, useState } from 'react'

export default function Scoreboard() {
   const [groups, setGroups] = useState([])
   const [error, setError] = useState('')

   const load = useCallback(async () => {
      const response = await fetch('/api/groups', { cache: 'no-store' })
      if (!response.ok) throw new Error('Scoreboard nicht erreichbar.')
      const data = await response.json()
      const sorted = [...(data.groups ?? [])].sort((a, b) => {
         const sa = Object.keys(a.solved ?? {}).length
         const sb = Object.keys(b.solved ?? {}).length
         if (sb !== sa) return sb - sa
         return a.updatedAt.localeCompare(b.updatedAt)
      })
      setGroups(sorted)
      setError('')
   }, [])

   useEffect(() => {
      load().catch((err) => setError(err.message))
      const id = window.setInterval(() => load().catch((err) => setError(err.message)), 5000)
      return () => window.clearInterval(id)
   }, [load])

   return (
      <div className="crt">
         <div className="bg-grid" />
         <div className="app">
            <div className="wrap admin-wrap">
               <header className="topbar">
                  <div><span className="dot" /> SCOREBOARD</div>
                  <div>{groups.length} GRUPPEN</div>
               </header>
               {error && <p className="feedback err">{error}</p>}
               <section className="panel">
                  <div className="btn-row">
                     <a className="btn small" href="/">+ Neue Gruppe</a>
                     <button className="btn small ghost" onClick={load}>Aktualisieren</button>
                  </div>
               </section>
               <section className="score-list">
                  {groups.map((group, rank) => {
                     const solved = Object.keys(group.solved ?? {}).length
                     const pct = Math.round((solved / (group.stationCount ?? 20)) * 100)
                     return (
                        <article className="station-card" key={group.code}>
                           <div>
                              <div className="eyebrow">Rang {rank + 1} · {group.code}</div>
                              <h2>{group.name || group.code}</h2>
                              <p>{solved}/{group.stationCount ?? 20} gelöst · {pct} % · {group.memberCount}/{group.maxMembers} Geräte</p>
                              <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
                           </div>
                           <div className="card-actions">
                              <a className="btn small ghost" href={`/play/${group.code}`}>Team</a>
                              <a className="btn small ghost" href={`/admin/${group.code}`}>Leitung</a>
                              <a className="btn small ghost" href={`/projector/${group.code}`}>Beamer</a>
                           </div>
                        </article>
                     )
                  })}
                  {groups.length === 0 && !error && <p className="hint">Noch keine Gruppen — erstellt die erste auf der Startseite.</p>}
               </section>
            </div>
         </div>
      </div>
   )
}
