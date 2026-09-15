'use client'

import React, { useState, useRef, useEffect } from 'react'
import { hintLevelsFor, normalizeInput } from '../../lib/game-data/stations.js'
import { playErr, playOk } from '../../lib/sound.js'
import PuzzleBody from './PuzzleBody.jsx'

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
}) {
    const [value, setValue] = useState(solvedValue ?? '')
   const [status, setStatus] = useState(solvedValue ? 'ok' : 'idle')
   const [msg, setMsg] = useState(solvedValue ? 'station abgeschlossen' : '')
    const [showHint, setShowHint] = useState(false)
    const [anim, setAnim] = useState('')
    const inputRef = useRef(null)
    const hintList = hintLevelsFor(station)
   const revealedHints = Number(groupState?.hints?.[station.n] ?? 0)
   const upload = groupState?.uploads?.[station.n]

   useEffect(() => {
      setValue(solvedValue ?? '')
      setStatus(solvedValue ? 'ok' : 'idle')
      setMsg(solvedValue ? 'station abgeschlossen' : '')
      setShowHint(false)
      if (inputRef.current) inputRef.current.focus()
     }, [station.n])

   const solved = status === 'ok'

    function flash(kind) {
       setAnim(kind)
       window.setTimeout(() => setAnim(''), 600)
    }

    function check() {
       if (!isUnlocked) return
       const norm = normalizeInput(value)
       if (norm === '') {
          setStatus('err')
          setMsg('› keine Eingabe erkannt. Setzt die Lösungszahl ein.')
          playErr()
          flash('shake')
          return
        }
       if (Number(norm) === station.solution) {
          setStatus('ok')
          setMsg('✓ validiert — Signal angenommen. Nächster Abschnitt freigegeben.')
          playOk()
          flash('pop')
          void onSolved(station.n, norm)
       } else {
          setStatus('err')
          setMsg('✗ fehlerhaft — Miss Anti-lomene erkennt keinen gültigen Code.')
          playErr()
          flash('shake')
       }
    }

   async function revealHint() {
      setShowHint(true)
      if (revealedHints < hintList.length) await onHint(station.n)
   }

   function onKeyDown(e) {
      if (e.key === 'Enter') check()
   }

   return (
        <div className="station fade-in">
           {!isUnlocked && (
              <div className="locked-banner">
                 Station gesperrt. Die Spielleitung oder der lineare Fortschritt muss sie freigeben.
              </div>
           )}
           <div className="station-head">
              <div>
                <div className="eyebrow">Station {String(station.n).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
                <h1 className="title">{station.title}</h1>
              </div>
              <div className="station-kind">{station.kind}</div>
           </div>

           <p className="prompt">{station.prompt}</p>

           <PuzzleBody station={station} onUpload={onUpload} />

           {hintList.length > 0 && (
              <div>
                <button className="link" onClick={revealHint} disabled={!isUnlocked}>
                   {showHint ? '– Hinweise ausblenden' : '○ Hinweis anfordern'}
                </button>
                {showHint && (
                   <div className="hint-stack">
                      {hintList.slice(0, Math.max(1, revealedHints)).map((hint, i) => (
                         <div className="hint-block" key={hint}>
                            Hinweis {i + 1}: {hint}
                         </div>
                      ))}
                      {revealedHints < hintList.length && (
                         <button className="link" onClick={revealHint}>
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
                <button
                  className="btn small"
                  onClick={check}
                  disabled={solved || !isUnlocked}
                >
                  {solved ? '✓' : 'Eingeben'}
                </button>
              </div>
               <div className={`feedback ${status} ${anim}`}>{msg}</div>
           </div>

           <div className="nav-row">
              <button className="btn ghost" onClick={onPrev} disabled={!canPrev}>
                 ← Zurück
              </button>

              <div className="station-jump" title="Alle Stationen">
                {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                   <button
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

              <button className="btn primary" onClick={onNext} disabled={!solved}>
                 {index + 1 >= total ? 'Zur Prüfung →' : 'Nächste →'}
              </button>
           </div>
        </div>
     )
}
