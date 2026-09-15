'use client'

import React from 'react'

export default function Progress({ solved, total, pct, phase, onOpen, onGotoFinale, unlocked }) {
    if (phase === 'qr') return null
    return (
        <div className="progress">
           <span>{pct}%</span>
           <div className="bar">
              <div className="fill" style={{ width: `${pct}%` }} />
           </div>
           <span>{solved}/{total}</span>
           {phase === 'play' ? (
              <button className="link small" onClick={onGotoFinale}>→ Prüfung</button>
           ) : (
              <button className="link small" onClick={() => onOpen(1)}>→ Stationen</button>
           )}
        </div>
     )
}
