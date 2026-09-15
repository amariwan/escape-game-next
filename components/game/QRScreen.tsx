'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QRScreenProps {
   onEnter: () => void
   groupCode: string
   groupInfo: { memberCount: number; maxMembers: number }
}

// QR zeigt auf den Auto-Join. Das Backend teilt jedes Gerät einer Gruppe mit max. 3 Mitgliedern zu.
export default function QRScreen({ onEnter, groupCode, groupInfo }: QRScreenProps) {
   const [img, setImg] = useState('')
   const target = typeof window !== 'undefined' ? `${window.location.origin}/join?pool=${encodeURIComponent(groupCode)}` : ''

   useEffect(() => {
      if (!target) return
      QRCode.toDataURL(target, {
         width: 600,
         margin: 2,
         color: { dark: '#050807', light: '#ffffff' },
      })
         .then(setImg)
         .catch(() => setImg(''))
   }, [target])

   return (
      <div className="qr-card fade-in">
         <div className="eyebrow">
            Auto-Join · aktuelle Gruppe {groupCode} · {groupInfo.memberCount}/{groupInfo.maxMembers}
         </div>
         <h1 className="title">Scan mich ein</h1>
         <p className="prompt">Scannt den Code mit dem Handy. Jedes Gerät wird automatisch einer Gruppe mit maximal 3 Mitgliedern zugeteilt.</p>

         <div className="qr-box">
            {img ? (
               // eslint-disable-next-line @next/next/no-img-element -- generiertes data:-QR, nichts zu optimieren
               <img src={img} alt="QR-Code" width="300" height="300" />
            ) : (
               <div className="qr-loading">…generiere…</div>
            )}
         </div>

         <div className="qr-meta">
            <span>DESTINATION</span>
            <span className="url">{target}</span>
         </div>

         <div className="btn-row center">
            <button type="button" className="btn primary" onClick={onEnter}>
               → Ich bin im Raum — Stationen öffnen
            </button>
            <Link className="btn ghost" href={`/admin/${groupCode}`}>
               Spielleitung
            </Link>
            <Link className="btn ghost" href={`/projector/${groupCode}`}>
               Beamer
            </Link>
         </div>
         <p className="hint">Tipp: Auch ohne Scanner — drückt einfach weiter.</p>
      </div>
   )
}
