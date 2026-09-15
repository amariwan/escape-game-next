'use client'

import { useEffect, useRef, useState } from 'react'
import { hintLevelsFor, normalizeInput } from '../../lib/hints'
import { playErr, playOk } from '../../lib/sound'
import type { GroupPayload, PublicStation, UploadFile } from '../../lib/types'
import PuzzleBody from './PuzzleBody'

type Status = 'idle' | 'ok' | 'err'

interface StationViewProps {
   station: PublicStation
   solvedMap: Record<number, string>
   solvedValue: string | undefined
   groupState: GroupPayload | null
   isUnlocked: boolean
   onSolved: (n: number, value: string) => Promise<boolean>
   onHint: (n: number) => Promise<void>
   onUpload: (station: number, file: UploadFile) => Promise<void>
   onNext: () => void
   onPrev: () => void
   canPrev: boolean
   index: number
   total: number
   openStation: (n: number) => void
   /** Split-Modus: nur die eigene Aufgabe zählt — Grid und Blättern ausblenden. */
   split?: boolean
}

export default function StationView({
   station,
   solvedMap,
   solvedValue,
   groupState,
   isUnlocked,
   onSolved,
   onHint,
   onUpload,
   onNext,
   onPrev,
   canPrev,
   index,
   total,
   openStation,
   split = false,
}: StationViewProps) {
   const [value, setValue] = useState(solvedValue ?? '')
   const [status, setStatus] = useState<Status>(solvedValue !== undefined ? 'ok' : 'idle')
   const [msg, setMsg] = useState(solvedValue !== undefined ? 'station abgeschlossen' : '')
   const [showHint, setShowHint] = useState(false)
   const [anim, setAnim] = useState('')
   // Abgeleiteter State gehört in den Render, nicht in einen Effekt.
   // Polls dürfen lokale Meldungen (validiert/fehlerhaft) nie überschreiben —
   // `acked` merkt sich, welcher Server-Stand schon übernommen wurde.
   const [syncedStation, setSyncedStation] = useState(station.n)
   const [acked, setAcked] = useState<string | undefined>(solvedValue)
   if (syncedStation !== station.n) {
      setSyncedStation(station.n)
      setAcked(solvedValue)
      setValue(solvedValue ?? '')
      setStatus(solvedValue !== undefined ? 'ok' : 'idle')
      setMsg(solvedValue !== undefined ? 'station abgeschlossen' : '')
      setShowHint(false)
   } else if (solvedValue !== acked) {
      setAcked(solvedValue)
      if (solvedValue === undefined) {
         // Reset durch Spielleitung — Erfolgsmeldung verwerfen
         setStatus('idle')
         setMsg('')
         setValue('')
      } else if (status === 'idle' && value === '') {
         // Fremd-Solve (anderes Gerät), eigenes Feld noch leer
         setStatus('ok')
         setMsg('station abgeschlossen')
         setValue(solvedValue)
      }
   }
   const inputRef = useRef<HTMLInputElement>(null)
   const hintList = hintLevelsFor(station)
   const revealedHints = Number(groupState?.hints?.[station.n] ?? 0)
   const upload = groupState?.uploads?.[station.n]

   useEffect(() => {
      if (inputRef.current) inputRef.current.focus()
   }, [station.n])

   const solved = status === 'ok'

   function flash(kind: string) {
      setAnim(kind)
      window.setTimeout(() => setAnim(''), 600)
   }

   async function check() {
      if (!isUnlocked || solved) return
      const norm = normalizeInput(value)
      if (norm === '') {
         setStatus('err')
         setMsg('› keine Eingabe erkannt. Setzt die Lösungszahl ein.')
         playErr()
         flash('shake')
         return
      }
      // Einzige Wahrheitsquelle ist der Server — kein lokaler Lösungsvergleich
      // (Lösungen liegen nie im Client-Bundle).
      try {
         const valid = await onSolved(station.n, value)
         if (valid) {
            setStatus('ok')
            setMsg('✓ validiert — Signal angenommen. Nächster Abschnitt freigegeben.')
            playOk()
            flash('pop')
         } else {
            setStatus('err')
            setMsg('✗ fehlerhaft — Miss Anti-lomene erkennt keinen gültigen Code.')
            playErr()
            flash('shake')
         }
      } catch (err) {
         setStatus('err')
         setMsg(`✗ ${err instanceof Error ? err.message : 'Speichern fehlgeschlagen'} — Eingabe behalten, später erneut senden.`)
         playErr()
         flash('shake')
      }
   }

   async function revealHint() {
      setShowHint(true)
      if (revealedHints < hintList.length) {
         try {
            await onHint(station.n)
         } catch {
            // Hinweis-Zähler bleibt stehen, Anzeige trotzdem offen
         }
      }
   }

   function onKeyDown(e: React.KeyboardEvent) {
      if (e.key === 'Enter') void check()
   }

   return (
      <div className="station fade-in">
         {!isUnlocked && (
            <div className="locked-banner">Station gesperrt. Die Spielleitung oder der lineare Fortschritt muss sie freigeben.</div>
         )}
         <div className="station-head">
            <div>
               <div className="eyebrow">
                  {split ? (
                     <>Deine Aufgabe · Station {String(station.n).padStart(2, '0')}</>
                  ) : (
                     <>Station {String(station.n).padStart(2, '0')} / {String(total).padStart(2, '0')}</>
                  )}
               </div>
               <h1 className="title">{station.title}</h1>
            </div>
            <div className="station-kind">{station.kind}</div>
         </div>

         <p className="prompt">{station.prompt}</p>

         <PuzzleBody station={station} onUpload={onUpload} />

         {hintList.length > 0 && (
            <div>
               <button type="button" className="link" onClick={() => void revealHint()} disabled={!isUnlocked}>
                  {showHint ? '– Hinweise ausblenden' : '○ Hinweis anfordern'}
               </button>
               {showHint && (
                  <div className="hint-stack">
                     {hintList.slice(0, Math.max(1, revealedHints)).map((hint, i) => (
                        <div className="hint-block" key={i}>
                           Hinweis {i + 1}: {hint}
                        </div>
                     ))}
                     {revealedHints < hintList.length && (
                        <button type="button" className="link" onClick={() => void revealHint()}>
                           Nächsten Hinweis freigeben
                        </button>
                     )}
                  </div>
               )}
            </div>
         )}

         {upload && (
            <div className={`upload-status ${upload.approved ? 'ok' : ''}`}>
               Upload: {upload.name} · {upload.hasImage || upload.dataUrl ? 'Bild gespeichert ✓ · ' : ''}
               {upload.approved ? 'von Spielleitung bestätigt' : 'wartet auf Spielleitung'}
            </div>
         )}

         <div className="solution">
            <div className="terminal-line">
               <span className="prompt-sign">› LÖSUNGSZAHL:</span>
               <input
                  ref={inputRef}
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => {
                     setValue(e.target.value)
                     setStatus('idle')
                     setMsg('')
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="___"
                  disabled={solved || !isUnlocked}
                  aria-label="Lösungszahl"
               />
               <button type="button" className="btn small" onClick={() => void check()} disabled={solved || !isUnlocked}>
                  {solved ? '✓' : 'Eingeben'}
               </button>
            </div>
            <div className={`feedback ${status} ${anim}`}>{msg}</div>
         </div>

         {!split && (
         <div className="nav-row">
            <button type="button" className="btn ghost" onClick={onPrev} disabled={!canPrev}>
               ← Zurück
            </button>

            <div className="station-jump" title="Alle Stationen">
               {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                  <button
                     type="button"
                     key={n}
                     className={`jump ${n === station.n ? 'active' : ''} ${solvedMap[n] ? 'done' : ''} ${groupState?.unlocked?.[n] ? '' : 'locked'}`}
                     onClick={() => openStation(n)}
                     disabled={!groupState?.unlocked?.[n]}
                     aria-label={`Station ${n}`}
                  >
                     {n}
                  </button>
               ))}
            </div>

            <button type="button" className="btn primary" onClick={onNext} disabled={!solved}>
               {index + 1 >= total ? 'Zur Prüfung →' : 'Nächste →'}
            </button>
         </div>
         )}
      </div>
   )
}
