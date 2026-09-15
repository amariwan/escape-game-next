'use client'

import React, { useMemo, useState } from 'react'
import {
   STATIONS,
   SOLUTIONS,
   FINAL_PASSWORD,
   normalizeInput,
} from '../../lib/game-data/stations.js'
import { playFinale } from '../../lib/sound.js'

function formatDuration(ms) {
   const total = Math.max(0, Math.floor(ms / 1000))
   const min = Math.floor(total / 60)
   const sec = total % 60
   return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function timeUsed(settings) {
   if (!settings?.startedAt) return null
   const end = settings.finishedAt
      ? Date.parse(settings.finishedAt)
      : settings.pausedAt
        ? Date.parse(settings.pausedAt)
        : Date.now()
   return Math.max(0, end - Date.parse(settings.startedAt) - (settings.elapsedPauseMs ?? 0))
}

export default function Finale({ solved, groupState, onRestart, onPhoto }) {
    // Welcher Buchstabe ist pro Station bekannt (nur bei korrekt gelöster)
   const letters = useMemo(
      () =>
         SOLUTIONS.map((s) => {
            const val = solved[s.n]
            const correct = val !== undefined && Number(normalizeInput(val)) === s.solution
            return { n: s.n, letter: s.letter, correct }
         }),
      [solved],
   )

   const allSolved = letters.every((l) => l.correct)
   const serverReveal = groupState?.settings?.revealFinale && allSolved
   const [revealed, setRevealed] = useState(false)
   const [photoPreview, setPhotoPreview] = useState(null)

   const assembled = letters.filter((l) => l.correct).map((l) => l.letter).join('')
   const used = timeUsed(groupState?.settings)
   const attempts = Object.values(groupState?.attempts ?? {}).reduce((a, b) => a + Number(b ?? 0), 0)
   const errors = Object.values(groupState?.errors ?? {}).reduce((a, b) => a + Number(b ?? 0), 0)
   const hints = Object.values(groupState?.hints ?? {}).reduce((a, b) => a + Number(b ?? 0), 0)
   const teamPhoto = groupState?.teamPhoto

   function verify() {
      setRevealed(true)
      playFinale()
   }

   function handlePhoto(file) {
      if (!file) return
      const localUrl = URL.createObjectURL(file)
      setPhotoPreview(localUrl)
      const img = new Image()
      img.onload = () => {
         let dataUrl = null
         try {
            const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
            dataUrl = canvas.toDataURL('image/jpeg', 0.8)
         } catch { /* nur Metadaten */ }
         setPhotoPreview(dataUrl ?? localUrl)
         void onPhoto?.({ name: file.name, size: file.size, type: file.type, dataUrl })
      }
      img.onerror = () => {
         void onPhoto?.({ name: file.name, size: file.size, type: file.type, dataUrl: null })
      }
      img.src = localUrl
   }

   return (
        <div className="finale fade-in">
           <div className="eyebrow">Spielleitung · Lösungsschlüssel</div>
           <h1 className="title">Die 20 Stimmen</h1>
           <p className="prompt">
             Jede gelöste Station liefert eine Zahl. Die Zahl wird in einen
             Buchstaben umgewandelt (A=1 … Z=26). Zusammen ergeben die 20
             Buchstaben das Passwort.
           </p>

           <div className="map">
              <table className="map-table">
                 <thead>
                    <tr><th>St.</th><th>Zahl</th><th>Buchstabe</th></tr>
                 </thead>
                 <tbody>
                    {letters.map((l) => {
                       const s = STATIONS.find((x) => x.n === l.n)
                       return (
                          <tr key={l.n} className={l.correct ? 'done' : ''}>
                             <td>{String(l.n).padStart(2, '0')}</td>
                             <td className="num">{l.correct ? s.solution : '—'}</td>
                             <td className="ltr">{l.correct ? l.letter : '·'}</td>
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

           <button className="btn primary" onClick={verify} disabled={!allSolved}>
             {allSolved ? 'Passwort entschlüsseln' : `Noch ${20 - letters.filter(l=>l.correct).length} Stationen offen`}
           </button>

           {(revealed || serverReveal) && allSolved && (
              <div className="finale-reveal fade-in">
                 <div className="eyebrow center">Passwort</div>
                 <div className="final-word">
                    {FINAL_PASSWORD.split('').map((c, i) => (
                       <span className="l" style={{ animationDelay: `${i * 60}ms` }} key={i}>{c}</span>
                    ))}
                 </div>
                 <p className="center prompt">
                    „Zusammen sind wir stark." Miss Anti-lomene hat das Chaos
                    überstanden. Ihr auch.
                 </p>
              </div>
           )}
           {revealed && !allSolved && (
              <p className="feedback err">
                ✗ Nicht alle Stationen gelöst — das Passwort bleibt verschlossen.
              </p>
           )}

           <section className="panel debrief" data-tag="Nachbesprechung">
              <div className="debrief-grid">
                 <div><span>Zeit</span><b>{used === null ? '—' : formatDuration(used)}</b></div>
                 <div><span>Gelöst</span><b>{letters.filter((l) => l.correct).length}/20</b></div>
                 <div><span>Versuche</span><b>{attempts}</b></div>
                 <div><span>Fehler</span><b>{errors}</b></div>
                 <div><span>Hinweise</span><b>{hints}</b></div>
              </div>
              <div className="team-photo">
                 <div className="eyebrow">Teamfoto</div>
                 {(photoPreview ?? teamPhoto?.dataUrl) ? (
                    <img className="preview" src={photoPreview ?? teamPhoto.dataUrl} alt="Teamfoto" />
                 ) : (
                    <p className="hint">Noch kein Teamfoto — aufladen für die Nachbesprechung.</p>
                 )}
                 <label className="file-drop">
                    Teamfoto aufnehmen / auswählen
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhoto(e.target.files?.[0])} />
                 </label>
                 {teamPhoto && !teamPhoto.dataUrl && <p className="hint">Foto-Metadaten gespeichert ({teamPhoto.name}).</p>}
              </div>
              <div className="btn-row center">
                 <button className="btn ghost" onClick={onRestart}>↺ Neustart</button>
              </div>
           </section>
        </div>
    )
}
