'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import { fetchJson } from '../lib/api-client'
import { usePolling } from '../lib/use-polling'
import type { GroupPayload } from '../lib/types'

export default function Scoreboard() {
   const fetcher = useCallback(async () => {
      const data = await fetchJson<{ groups?: GroupPayload[] }>('/api/groups', { cache: 'no-store' })
      return [...(data.groups ?? [])].sort((a, b) => {
         const sa = Object.keys(a.solved ?? {}).length
         const sb = Object.keys(b.solved ?? {}).length
         if (sb !== sa) return sb - sa
         return a.updatedAt.localeCompare(b.updatedAt)
      })
   }, [])

   const { data, error, reload } = usePolling(fetcher, 5000)
   const groups = data ?? []

   return (
      <div className="crt">
         <div className="bg-grid" />
         <div className="app">
            <div className="wrap admin-wrap">
               <header className="topbar">
                  <div>
                     <span className="dot" /> SCOREBOARD
                  </div>
                  <div>{groups.length} GRUPPEN</div>
               </header>
               {error && <p className="feedback err">{error}</p>}
               <section className="panel">
                  <div className="btn-row">
                     <Link className="btn small" href="/">
                        + Neue Gruppe
                     </Link>
                     <button type="button" className="btn small ghost" onClick={() => void reload()}>
                        Aktualisieren
                     </button>
                  </div>
               </section>
               <section className="score-list">
                  {groups.map((group, rank) => {
                     const solved = Object.keys(group.solved ?? {}).length
                     const pct = Math.round((solved / (group.stationCount ?? 20)) * 100)
                     return (
                        <article className="station-card" key={group.code}>
                           <div>
                              <div className="eyebrow">
                                 Rang {rank + 1} · {group.code}
                              </div>
                              <h2>{group.name || group.code}</h2>
                              <p>
                                 {solved}/{group.stationCount ?? 20} gelöst · {pct} % · {group.memberCount}/{group.maxMembers}{' '}
                                 Geräte
                              </p>
                              <div className="bar">
                                 <div className="fill" style={{ width: `${pct}%` }} />
                              </div>
                           </div>
                           <div className="card-actions">
                              <Link className="btn small ghost" href={`/play/${group.code}`}>
                                 Team
                              </Link>
                              <Link className="btn small ghost" href={`/admin/${group.code}`}>
                                 Leitung
                              </Link>
                              <Link className="btn small ghost" href={`/projector/${group.code}`}>
                                 Beamer
                              </Link>
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
