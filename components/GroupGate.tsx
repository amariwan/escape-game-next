'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { postJson } from '../lib/api-client'
import type { GroupPayload } from '../lib/types'

export default function GroupGate() {
   const router = useRouter()
   const [name, setName] = useState('')
   const [code, setCode] = useState('')
   const [busy, setBusy] = useState(false)
   const [error, setError] = useState('')
   const [created, setCreated] = useState<GroupPayload | null>(null)
   const [qr, setQr] = useState('')

   useEffect(() => {
      if (!created) return
      const target = `${window.location.origin}/play/${created.code}`
      QRCode.toDataURL(target, { width: 420, margin: 2 })
         .then(setQr)
         .catch(() => setQr(''))
   }, [created])

   async function createGroup(event: React.FormEvent) {
      event.preventDefault()
      setBusy(true)
      setError('')
      try {
         setCreated(await postJson<GroupPayload>('/api/groups', { name }))
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Gruppe konnte nicht erstellt werden.')
      } finally {
         setBusy(false)
      }
   }

   function joinGroup(event: React.FormEvent) {
      event.preventDefault()
      const clean = code.trim().replace(/[^a-z0-9]/gi, '').toUpperCase()
      if (!clean) {
         setError('Bitte Gruppen-Code eingeben.')
         return
      }
      router.push(`/play/${clean}`)
   }

   if (created) {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      return (
         <div className="crt">
            <div className="bg-grid" />
            <div className="app">
               <div className="wrap full">
                  <div className="start fade-in">
                     <div className="eyebrow">Gruppe bereit · {created.name || 'ohne Namen'}</div>
                     <h1 className="title">
                        Code <span className="accent">{created.code}</span>
                     </h1>
                     <p className="prompt center">QR scannen oder Code weitergeben — jedes Gerät wählt danach seine Rolle.</p>
                     <div className="qr-box">
                        {qr ? (
                           // eslint-disable-next-line @next/next/no-img-element -- generiertes data:-QR, nichts zu optimieren
                           <img src={qr} alt="Gruppen-QR" width="220" height="220" />
                        ) : (
                           <div className="qr-loading">…generiere…</div>
                        )}
                     </div>
                     <div className="qr-meta">
                        <span>DESTINATION</span>
                        <span className="url">
                           {origin}/play/{created.code}
                        </span>
                     </div>
                     <div className="role-grid">
                        <Link className="btn primary" href={`/play/${created.code}`}>
                           Teamgerät starten
                        </Link>
                        <Link className="btn small" href={`/admin/${created.code}`}>
                           Spielleitung
                        </Link>
                        <Link className="btn small ghost" href={`/projector/${created.code}`}>
                           Beamer
                        </Link>
                     </div>
                     <div className="btn-row center">
                        <Link className="link" href="/scoreboard">
                           Zum Scoreboard →
                        </Link>
                        <button type="button" className="link" onClick={() => setCreated(null)}>
                           Weitere Gruppe erstellen
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )
   }

   return (
      <div className="crt">
         <div className="bg-grid" />
         <div className="app">
            <div className="wrap full">
               <div className="start">
                  <div className="eyebrow">Miss Anti-lomene · Gruppen-Terminal</div>
                  <h1 className="title">
                     Neues Team
                     <br />
                     <span className="accent">oder Code beitreten</span>
                  </h1>
                  <p className="prompt center">Erstellt eine Gruppen-Sitzung. Alle Geräte mit demselben Code sehen denselben Fortschritt.</p>
                  <form className="terminal-line group-form" onSubmit={(e) => void createGroup(e)}>
                     <span className="caret">&gt;</span>
                     <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="GRUPPEN-NAME (OPTIONAL)"
                        aria-label="Gruppen-Name"
                        maxLength={60}
                     />
                     <button className="btn primary" type="submit" disabled={busy}>
                        {busy ? '…' : 'Neue Gruppe erstellen'}
                     </button>
                  </form>
                  <form className="terminal-line group-form" onSubmit={joinGroup}>
                     <span className="caret">&gt;</span>
                     <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="GRUPPEN-CODE" aria-label="Gruppen-Code" />
                     <button className="btn small" type="submit">
                        Beitreten
                     </button>
                  </form>
                  <div className="btn-row center">
                     <Link className="link" href="/scoreboard">
                        Scoreboard aller Gruppen →
                     </Link>
                     <Link className="link" href="/print">
                        Druck-Paket →
                     </Link>
                  </div>
                  {error && <p className="feedback err">{error}</p>}
               </div>
            </div>
         </div>
      </div>
   )
}
