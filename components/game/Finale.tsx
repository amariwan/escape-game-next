'use client'

import { useMemo, useState } from 'react'
import { PUBLIC_STATIONS } from '../../lib/game-data/stations'
import { downscaleImage } from '../../lib/image'
import { playFinale } from '../../lib/sound'
import { elapsedMs, formatMMSS } from '../../lib/time'
import type { GroupPayload, UploadFile } from '../../lib/types'

interface FinaleProps {
   solved: Record<number, string>
   groupState: GroupPayload | null
   onRestart: () => void
   onPhoto: (file: UploadFile) => Promise<void>
}

export default function Finale({ solved, groupState, onRestart, onPhoto }: FinaleProps) {
   // Korrekt = serverseitig als gelöst markiert. Buchstaben + Passwort kommen
   // vom Server (nur Gelöstes / nur bei Freigabe) — nie aus einem Import.
   const letters = useMemo(() => groupState?.letters ?? {}, [groupState])
   const stationCount = groupState?.stationCount ?? PUBLIC_STATIONS.length
   const solvedNumbers = useMemo(() => {
      const fromServer = groupState ? Object.keys(groupState.solved).map(Number) : []
      const fromLocal = Object.keys(solved).map(Number)
      return [...new Set([...fromServer, ...fromLocal])]
   }, [groupState, solved])

   const allSolved = PUBLIC_STATIONS.every((s) => solvedNumbers.includes(s.n))
   const serverReveal = groupState?.settings?.revealFinale ?? false
   const finalWord = groupState?.finalWord ?? null
   const [revealed, setRevealed] = useState(false)
   const [photoPreview, setPhotoPreview] = useState<string | null>(null)
   const [photoError, setPhotoError] = useState('')

   const assembled = PUBLIC_STATIONS.filter((s) => letters[s.n])
      .map((s) => letters[s.n])
      .join('')
   const used = elapsedMs(groupState?.settings)
   const attempts = Object.values(groupState?.attempts ?? {}).reduce((a, b) => a + Number(b ?? 0), 0)
   const errors = Object.values(groupState?.errors ?? {}).reduce((a, b) => a + Number(b ?? 0), 0)
   const hints = Object.values(groupState?.hints ?? {}).reduce((a, b) => a + Number(b ?? 0), 0)
   const teamPhoto = groupState?.teamPhoto

   const showPassword = serverReveal || (revealed && allSolved)

   function verify() {
      if (!allSolved) return
      setRevealed(true)
      playFinale()
   }

   function handlePhoto(file: File | undefined) {
      if (!file) return
      setPhotoError('')
      const localUrl = URL.createObjectURL(file)
      setPhotoPreview(localUrl)
      const img = new Image()
      img.onload = () => {
         let dataUrl: string | null = null
         try {
            dataUrl = downscaleImage(img)
         } catch {
            /* nur Metadaten */
         }
         setPhotoPreview(dataUrl ?? localUrl)
         onPhoto({ name: file.name, size: file.size, type: file.type, dataUrl }).catch((err) => {
            setPhotoError(err instanceof Error ? err.message : 'Foto konnte nicht gespeichert werden')
         })
      }
      img.onerror = () => {
         onPhoto({ name: file.name, size: file.size, type: file.type, dataUrl: null }).catch((err) => {
            setPhotoError(err instanceof Error ? err.message : 'Foto konnte nicht gespeichert werden')
         })
      }
      img.src = localUrl
   }

   return (
      <div className="finale fade-in">
         <div className="eyebrow">Spielleitung · Lösungsschlüssel</div>
         <h1 className="title">Die 20 Stimmen</h1>
         <p className="prompt">
            Jede gelöste Station liefert eine Zahl. Die Zahl wird in einen Buchstaben umgewandelt (A=1 … Z=26). Zusammen ergeben
            die {stationCount} Buchstaben das Passwort.
         </p>

         <div className="map">
            <table className="map-table">
               <thead>
                  <tr>
                     <th>St.</th>
                     <th>Zahl</th>
                     <th>Buchstabe</th>
                  </tr>
               </thead>
               <tbody>
                  {PUBLIC_STATIONS.map((s) => {
                     const done = solvedNumbers.includes(s.n)
                     const value = groupState?.solved?.[s.n] ?? solved[s.n]
                     return (
                        <tr key={s.n} className={done ? 'done' : ''}>
                           <td>{String(s.n).padStart(2, '0')}</td>
                           <td className="num">{done ? value : '—'}</td>
                           <td className="ltr">{letters[s.n] ?? '·'}</td>
                        </tr>
                     )
                  })}
               </tbody>
            </table>
         </div>

         <div className="assembled">
            <div className="eyebrow">Zusammengesetzt (gelöst)</div>
            <div className="assembled-word">{assembled || '····'}</div>
         </div>

         <button type="button" className="btn primary" onClick={verify} disabled={!allSolved}>
            {allSolved ? 'Passwort entschlüsseln' : `Noch ${stationCount - solvedNumbers.length} Stationen offen`}
         </button>

         {showPassword && finalWord && (
            <div className="finale-reveal fade-in">
               <div className="eyebrow center">Passwort</div>
               <div className="final-word">
                  {finalWord.split('').map((c, i) => (
                     <span className="l" style={{ animationDelay: `${i * 60}ms` }} key={i}>
                        {c}
                     </span>
                  ))}
               </div>
               <p className="center prompt">&bdquo;Zusammen sind wir stark.&ldquo; Miss Anti-lomene hat das Chaos überstanden. Ihr auch.</p>
            </div>
         )}
         {revealed && !allSolved && (
            <p className="feedback err">✗ Nicht alle Stationen gelöst — das Passwort bleibt verschlossen.</p>
         )}

         <section className="panel debrief" data-tag="Nachbesprechung">
            <div className="debrief-grid">
               <div>
                  <span>Zeit</span>
                  <b>{used === null ? '—' : formatMMSS(used)}</b>
               </div>
               <div>
                  <span>Gelöst</span>
                  <b>
                     {solvedNumbers.length}/{stationCount}
                  </b>
               </div>
               <div>
                  <span>Versuche</span>
                  <b>{attempts}</b>
               </div>
               <div>
                  <span>Fehler</span>
                  <b>{errors}</b>
               </div>
               <div>
                  <span>Hinweise</span>
                  <b>{hints}</b>
               </div>
            </div>
            <div className="team-photo">
               <div className="eyebrow">Teamfoto</div>
               {photoPreview ?? teamPhoto?.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data:-URL, next/image kann nichts optimieren
                  <img className="preview" src={photoPreview ?? teamPhoto?.dataUrl ?? ''} alt="Teamfoto" />
               ) : (
                  <p className="hint">Noch kein Teamfoto — aufladen für die Nachbesprechung.</p>
               )}
               <label className="file-drop">
                  Teamfoto aufnehmen / auswählen
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhoto(e.target.files?.[0])} />
               </label>
               {photoError && <p className="feedback err">{photoError}</p>}
               {teamPhoto && !teamPhoto.dataUrl && <p className="hint">Foto-Metadaten gespeichert ({teamPhoto.name}).</p>}
            </div>
            <div className="btn-row center">
               <button type="button" className="btn ghost" onClick={onRestart}>
                  ↺ Neustart
               </button>
            </div>
         </section>
      </div>
   )
}
