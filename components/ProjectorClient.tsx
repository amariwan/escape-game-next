'use client'

import { useCallback } from 'react'
import { PUBLIC_STATIONS } from '../lib/game-data/stations'
import { fetchJson } from '../lib/api-client'
import { remainingLabel } from '../lib/time'
import { usePolling } from '../lib/use-polling'
import type { GroupPayload } from '../lib/types'

export default function ProjectorClient({ groupCode }: { groupCode: string }) {
   const fetcher = useCallback(
      () => fetchJson<GroupPayload>(`/api/groups/${groupCode}`, { cache: 'no-store' }),
      [groupCode],
   )

   const { data: group, error, offline, reload } = usePolling(fetcher, 1000)

   if (!group) {
      return (
         <div className="projector">
            <div className="projector-time">VERBINDE</div>
            <p>{error || '…'} · Prüft WLAN und Server.</p>
            <button type="button" className="btn small" onClick={() => void reload()}>
               Erneut verbinden
            </button>
         </div>
      )
   }

   const stationCount = group.stationCount ?? PUBLIC_STATIONS.length
   const solvedCount = Object.keys(group.letters ?? {}).length
   const pct = Math.round((solvedCount / stationCount) * 100)
   const reveal = group.settings?.revealFinale || solvedCount === stationCount
   const word = reveal ? (group.finalWord ?? '') : PUBLIC_STATIONS.map((s) => group.letters?.[s.n] ?? '·').join('')

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
            <div>
               GRUPPE {groupCode}
               {group.name ? ` · ${group.name}` : ''}
            </div>
            <div className="projector-time">{remainingLabel(group.settings)}</div>
            <div>
               {solvedCount}/{stationCount}
            </div>
         </div>
         <div className="projector-bar projector-bar-big">
            <div style={{ width: `${pct}%` }} />
         </div>
         <div className="projector-pct">{pct} %</div>
         <div className="projector-grid">
            {PUBLIC_STATIONS.map((s) => (
               <div className={`projector-cell ${group.letters?.[s.n] ? 'done' : ''}`} key={s.n}>
                  <span>{String(s.n).padStart(2, '0')}</span>
                  <b>{group.letters?.[s.n] ?? '·'}</b>
               </div>
            ))}
         </div>
         <div className="projector-word">{word}</div>
      </div>
   )
}
