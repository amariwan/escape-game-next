'use client'

import React, { useState } from 'react'

// Rendert den inhaltlichen Teil einer Station (treu zur PDF).
// Einige Stationen haben eine leichte Interaktivität, die die Lösungszahl
// errechnet und per `onComputed` in das Eingabefeld vorgibt.
export default function PuzzleBody({ station, onUpload }) {
    switch (station.kind) {
        case 'logik':
           return <ReportPuzzle station={station} />
        case 'rekonstruktion':
           return <ReconstructionPuzzle station={station} />
        case 'signal':
           return <SignalPuzzle station={station} />
        case 'muster':
           return <PatternPuzzle station={station} />
        case 'reihenfolge':
           return <SequencePuzzle station={station} />
        case 'upload':
           return <UploadPuzzle station={station} onUpload={onUpload} />
        case 'spiegel':
           return <MirrorPuzzle station={station} />
        case 'gedaechtnis':
           return <MemoryPuzzle station={station} />
        case 'binär':
           return <BinaryPuzzle station={station} />
        case 'prüfung':
           return <ControlPuzzle station={station} />
        case 'falten':
           return <FoldPuzzle station={station} />
        case 'maske':
           return <MaskPuzzle station={station} />
        case 'gleichung':
           return <EquationPuzzle station={station} />
        case 'finale':
           return <FinalConfession station={station} />
        default:
           return null
    }
}

function ReportPuzzle({ station }) {
    // falsch markierte Zeilen → Zahl (Station 01)
    const [marks, setMarks] = useState({})
    const falschNums = station.rows
       .filter((r) => marks[r.i] === 'falsch')
       .map((r) => r.i)
    const computed = falschNums.join('')

    return (
       <div className="puzzle">
          <table className="report">
             <thead>
                <tr>
                   <th>Nr.</th>
                   <th>Ausgangsdaten</th>
                   <th>Behauptung</th>
                   <th>Prüfung</th>
                </tr>
             </thead>
             <tbody>
                {station.rows.map((r) => (
                   <tr key={r.i}>
                      <td className="mark">{r.i}</td>
                      <td>{r.input}</td>
                      <td>{r.claim}</td>
                      <td className="mark">
                         <div className="radio-row">
                            <label>
                               <input
                                 type="radio"
                                 name={`r${r.i}`}
                                 checked={marks[r.i] === 'korrekt'}
                                 onChange={() =>
                                    setMarks((m) => ({ ...m, [r.i]: 'korrekt' }))
                                 }
                               />
                               korrekt
                            </label>
                            <label>
                               <input
                                 type="radio"
                                 name={`r${r.i}`}
                                 checked={marks[r.i] === 'falsch'}
                                 onChange={() =>
                                    setMarks((m) => ({ ...m, [r.i]: 'falsch' }))
                                 }
                               />
                               falsch
                            </label>
                         </div>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
          <div className="computed">
             Falsch-Reihen (oben → unten): <b>{computed || '—'}</b>
          </div>
       </div>
    )
}

function ReconstructionPuzzle({ station }) {
    return (
       <div className="puzzle">
          <div className="shredded">
             <div className="shred-col">
                <span>AKTE 02</span>
                <span>REKONSTRUKTION</span>
             </div>
             <div className="shred-col">
                <span>FUNKVERKEHR</span>
                <span>+ TRESOR +</span>
             </div>
             <div className="shred-col">
                <span>AKTE</span>
             </div>
             <div className="shred-footer">
                CONTROL // FINAL_FINAL_v12 // NICHT SCHREDDERN
             </div>
          </div>
          {station.note && <div className="note">{station.note}</div>}
       </div>
    )
}

function SignalPuzzle({ station }) {
    return (
       <div className="puzzle">
          <div className="signal">
             {'████▒▒░░▓▓▒▒░░████░░▓▒▒▓░░▓▓▒▒▓▓▒▒░░▓░▒▒▓▓▒▒░░▓▓'
                .split('')
                .map((c, i) => (
                   <span key={i} className="bit">{c}</span>
                ))}
          </div>
          <div className="note">FUNKSTÖRUNG · NOTIZEN BLATT · Zahl wird freigegeben</div>
       </div>
    )
}

function PatternPuzzle({ station }) {
    return (
       <div className="puzzle">
          <div className="grid2">
             <div className="chip ref">
                <div className="chip-label">REFERENZ (180°)</div>
                <pre>{station.reference.join('\n')}</pre>
             </div>
             <div>
                <div className="chip-label">SIEBEN KARTEN — eine ist korrekt</div>
                <div className="card-cards">
                   {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="card-mini">
                         K{n}
                      </div>
                   ))}
                </div>
             </div>
          </div>
       </div>
    )
}

function SequencePuzzle({ station }) {
    const [order, setOrder] = useState(station.events.map((e) => e.label))
    function move(i, dir) {
       const next = [...order]
       const j = i + dir
       if (j < 0 || j >= next.length) return
       ;[next[i], next[j]] = [next[j], next[i]]
       setOrder(next)
    }
    const lastNum =
       station.events.find((e) => e.label === order[order.length - 1])?.num
    return (
       <div className="puzzle">
          <div className="event-list">
             {order.map((label, i) => (
                <div className="event-row" key={label}>
                   <span className="num">{i + 1}</span>
                   <span className="label">{label}</span>
                   <span className="num small">
                     {station.events.find((e) => e.label === label)?.num}
                   </span>
                   <span className="event-controls">
                      <button onClick={() => move(i, -1)} aria-label="nach oben">▲</button>
                      <button onClick={() => move(i, 1)} aria-label="nach unten">▼</button>
                   </span>
                </div>
             ))}
          </div>
          {station.hints && (
             <div className="hints">
                <div className="chip-label">HINWEISE</div>
                <ul>
                   {station.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                   ))}
                </ul>
             </div>
          )}
          <div className="computed">
             Letzte Karte in der Reihenfolge: <b>{lastNum ?? '—'}</b>
          </div>
       </div>
    )
}

function UploadPuzzle({ station, onUpload }) {
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState('')
    const [stored, setStored] = useState(false)

    function downscale(img, maxEdge = 1280) {
       const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
       const canvas = document.createElement('canvas')
       canvas.width = Math.round(img.width * scale)
       canvas.height = Math.round(img.height * scale)
       canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
       return canvas.toDataURL('image/jpeg', 0.8)
    }

    function handleFile(f) {
       if (!f) return
       setFile(f)
       setStored(false)
       const localUrl = URL.createObjectURL(f)
       setPreview(localUrl)
       const meta = { name: f.name, size: f.size, type: f.type, dataUrl: null }
       // Bild verkleinert mitspeichern, damit die Spielleitung es wirklich sieht.
       const img = new Image()
       img.onload = () => {
          try {
             meta.dataUrl = downscale(img)
          } catch { /* nur Metadaten */ }
          setStored(true)
          void onUpload?.(station.n, meta)
          URL.revokeObjectURL(localUrl)
          setPreview(meta.dataUrl ?? localUrl)
       }
       img.onerror = () => {
          void onUpload?.(station.n, meta)
       }
       img.src = localUrl
    }

    return (
       <div className="puzzle">
          <ul className="checklist">
             {station.checklist.map((c, i) => (
                <li key={i}><span className="box">□</span> {c}</li>
             ))}
          </ul>
          <label className="file-drop">
             {file ? `geladen: ${file.name}${stored ? ' · gespeichert ✓' : ' · wird gespeichert…'}` : 'Bild hierher ziehen oder auswählen'}
             <input
               type="file"
               accept="image/*"
               capture="environment"
               onChange={(e) => handleFile(e.target.files?.[0])}
             />
          </label>
          {preview && <img className="preview" src={preview} alt="Upload-Vorschau" />}
       </div>
    )
}

function MirrorPuzzle({ station }) {
    const [flipped, setFlipped] = useState(false)
    return (
       <div className="puzzle">
          <div className="mirror" style={{ transform: flipped ? 'scaleX(-1)' : 'none' }}>
             {station.cipher.map((line, i) => (
                <div className="cipher-line" key={i}>{line}</div>
             ))}
          </div>
          <button className="link" onClick={() => setFlipped((f) => !f)}>
             {flipped ? '↺ Spiegel zurück' : '⟲ Text spiegeln'}
          </button>
          {station.hint && <div className="hint-block">{station.hint}</div>}
       </div>
    )
}

function MemoryPuzzle({ station }) {
    const [running, setRunning] = useState(false)
    const [count, setCount] = useState(10)
    const [phase, setPhase] = useState('idle')
    function start() {
       setPhase('show')
       setRunning(true)
       setCount(10)
       let c = 10
       const iv = setInterval(() => {
          c -= 1
          setCount(c)
          if (c <= 0) {
             clearInterval(iv)
             setRunning(false)
             setPhase('question')
          }
        }, 1000)
    }
    return (
       <div className="puzzle">
          {phase === 'idle' && (
             <button className="btn" onClick={start}>▶ 10 Sekunden starten</button>
          )}
          {phase === 'show' && (
             <div className="desk-scene">
                <div className="scene-label">SCHREIBTISCH</div>
                <div className="desk-items">
                   <span>☕</span><span>📎</span><span>📷</span><span>🔑</span>
                   <span>✒️</span><span>🔋</span><span>📕</span>
                </div>
                <div className="countdown">noch {count}s …</div>
             </div>
          )}
          {phase === 'question' && (
             <div className="memory-q">
                <div className="chip-label">Fragen zum Schreibtisch</div>
                <p>Welche Gegenstände hattet ihr vor Augen? Schreibt eure
                  Eindrücke auf und leitet die Lösungszahl ab.</p>
             </div>
          )}
       </div>
    )
}

function BinaryPuzzle({ station }) {
    // Fünf Bit (Standard: 10111 = 23), umwandelbar
    const [bits, setBits] = useState('10111')
    const decimal = bits.split('').reduce((acc, b, i) => acc + (Number(b) * station.weights[i]), 0)
    function toggle(i) {
       setBits((prev) => prev.split('').map((c, j) => (j === i ? (c === '1' ? '0' : '1') : c)).join(''))
    }
    return (
       <div className="puzzle">
          <div className="binary">
             {bits.split('').map((b, i) => (
                <button
                   key={i}
                   className={`bit-cell ${b === '1' ? 'on' : ''}`}
                   onClick={() => toggle(i)}
                   title={station.weights[i]}
                >
                   <span className="weight">{station.weights[i]}</span>
                   <span className="digit">{b}</span>
                </button>
             ))}
          </div>
          <div className="computed">
             Dezimal: <b>{decimal}</b>
             <span className="plus">
                {station.weights.map((w, i) => bits[i] === '1' ? w : '·').join(' + ')}
             </span>
          </div>
       </div>
    )
}

function ControlPuzzle({ station }) {
    return (
       <div className="puzzle">
          <div className="control-grid">
             <div className="ctrl">31 FEB · 25:61</div>
             <div className="ctrl">7 × 8 = 54</div>
             <div className="ctrl">BINÄR: 10201</div>
             <div className="ctrl">QUARTAL Q5</div>
             <div className="ctrl">1 Stunde = 60 Minuten</div>
             <div className="ctrl">1 Jahr = 13 Monate</div>
             <div className="ctrl">360° ÷ 4 = 90°</div>
             <div className="ctrl">1 Meter = 90 cm</div>
             <div className="ctrl">1 Dutzend = 12</div>
             <div className="ctrl">21 ist eine Primzahl</div>
          </div>
          {station.note && <div className="note">{station.note}</div>}
          <div className="chip-label">Markiere alle fehlerhaften Felder (Anzahl = Lösungszahl)</div>
       </div>
    )
}

function FoldPuzzle({ station }) {
    return (
       <div className="puzzle">
          <div className="fold">
             <div className="fold-paper">
                <span className="fold-mark">2</span>
                <span className="fold-mark">3</span>
                <div className="fold-hint">falte entlang der Linien</div>
             </div>
          </div>
          <div className="note">Durch das richtige Falten wird eine Zahl sichtbar.</div>
       </div>
    )
}

function MaskPuzzle({ station }) {
    return (
       <div className="puzzle">
          <div className="matrix">
             {station.grid.join(' ').split(' ').map((c, i) => (
                <span className="cell" key={i}>{c}</span>
             ))}
          </div>
          {station.hint && <div className="hint-block">{station.hint}</div>}
       </div>
    )
}

function EquationPuzzle({ station }) {
    return (
       <div className="puzzle">
          <div className="equations">
             {station.equations.map((e, i) => (
                <div className="eq" key={i}>{e}</div>
             ))}
          </div>
       </div>
    )
}

function FinalConfession({ station }) {
    return (
       <div className="puzzle">
          <div className="confession">
             <p>„Miss Anti-lomene hat das Chaos nicht erfunden — sie hat es
                dokumentiert. Und jetzt liegt es an euch, es zu entschlüsseln.“</p>
             <p>Zählt die Wörter der drei Sätze, wandelt jede Zahl in einen
                Buchstaben um (A=1 … Z=26). Das Zahlwort ist eure finale Lösungszahl.</p>
          </div>
       </div>
    )
}
