'use client'

interface ProgressProps {
   solved: number
   total: number
   pct: number
   phase: string
   onOpen: (n: number) => void
   onGotoFinale: () => void
   /** Split: kein manueller Finale-Link — Finale öffnet sich automatisch. */
   allowFinaleLink?: boolean
}

export default function Progress({ solved, total, pct, phase, onOpen, onGotoFinale, allowFinaleLink = true }: ProgressProps) {
   if (phase === 'qr') return null
   return (
      <div className="progress">
         <span>{pct}%</span>
         <div className="bar">
            <div className="fill" style={{ width: `${pct}%` }} />
         </div>
         <span>
            {solved}/{total}
         </span>
         {phase === 'play' && allowFinaleLink ? (
            <button type="button" className="link small" onClick={onGotoFinale}>
               → Prüfung
            </button>
         ) : (
            <button type="button" className="link small" onClick={() => onOpen(1)}>
               → Stationen
            </button>
         )}
      </div>
   )
}
