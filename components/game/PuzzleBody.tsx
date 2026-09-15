'use client'

import { useEffect, useRef, useState } from 'react'
import { downscaleImage } from '../../lib/image'
import type { PublicStation, UploadFile } from '../../lib/types'

interface PuzzleBodyProps {
   station: PublicStation
   onUpload?: (station: number, file: UploadFile) => void
}

// Rendert den inhaltlichen Teil einer Station (treu zur PDF).
export default function PuzzleBody({ station, onUpload }: PuzzleBodyProps) {
   switch (station.kind) {
      case 'logik':
         return <ReportPuzzle station={station} />
      case 'rekonstruktion':
         return <ReconstructionPuzzle station={station} />
      case 'signal':
         return <SignalPuzzle />
      case 'muster':
         return <PatternPuzzle station={station} />
      case 'reihenfolge':
         return <SequencePuzzle station={station} />
      case 'upload':
         return <UploadPuzzle station={station} onUpload={onUpload} />
      case 'spiegel':
         return <MirrorPuzzle station={station} />
      case 'gedaechtnis':
         return <MemoryPuzzle />
      case 'kandidaten':
         return <CandidatesPuzzle station={station} />
      case 'team':
         return <TeamPuzzle />
      case 'kalender':
         return <CalendarPuzzle station={station} />
      case 'binär':
         return <BinaryPuzzle station={station} />
      case 'prüfung':
         return <ControlPuzzle station={station} />
      case 'buchhaltung':
         return <AccountingPuzzle station={station} />
      case 'falten':
         return <FoldPuzzle />
      case 'maske':
         return <MaskPuzzle station={station} />
      case 'gleichung':
         return <EquationPuzzle station={station} />
      case 'finale':
         return <FinalConfession />
      default:
         return null
   }
}

function ReportPuzzle({ station }: { station: PublicStation }) {
   // falsch markierte Zeilen → Zahl (Station 01)
   const [marks, setMarks] = useState<Record<number, 'korrekt' | 'falsch'>>({})
   const rows = station.rows ?? []
   const falschNums = rows.filter((r) => marks[r.i] === 'falsch').map((r) => r.i)
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
               {rows.map((r) => (
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
                                 onChange={() => setMarks((m) => ({ ...m, [r.i]: 'korrekt' }))}
                              />
                              korrekt
                           </label>
                           <label>
                              <input
                                 type="radio"
                                 name={`r${r.i}`}
                                 checked={marks[r.i] === 'falsch'}
                                 onChange={() => setMarks((m) => ({ ...m, [r.i]: 'falsch' }))}
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

function ReconstructionPuzzle({ station }: { station: PublicStation }) {
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
            <div className="shred-footer">CONTROL // FINAL_FINAL_v12 // NICHT SCHREDDERN</div>
         </div>
         {station.note && <div className="note">{station.note}</div>}
      </div>
   )
}

function SignalPuzzle() {
   return (
      <div className="puzzle">
         <div className="signal">
            {'████▒▒░░▓▓▒▒░░████░░▓▒▒▓░░▓▓▒▒▓▓▒▒░░▓░▒▒▓▓▒▒░░▓▓'.split('').map((c, i) => (
               <span key={i} className="bit">
                  {c}
               </span>
            ))}
         </div>
         <div className="note">FUNKSTÖRUNG · NOTIZEN BLATT · Zahl wird freigegeben</div>
      </div>
   )
}

function PatternPuzzle({ station }: { station: PublicStation }) {
   return (
      <div className="puzzle">
         <div className="grid2">
            <div className="chip ref">
               <div className="chip-label">REFERENZ (180°)</div>
               <pre>{(station.reference ?? []).join('\n')}</pre>
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

function SequencePuzzle({ station }: { station: PublicStation }) {
   const events = station.events ?? []
   const [order, setOrder] = useState<string[]>(events.map((e) => e.label))
   function move(i: number, dir: number) {
      const next = [...order]
      const j = i + dir
      if (j < 0 || j >= next.length) return
      ;[next[i], next[j]] = [next[j], next[i]]
      setOrder(next)
   }
   const lastNum = events.find((e) => e.label === order[order.length - 1])?.num
   return (
      <div className="puzzle">
         <div className="event-list">
            {order.map((label, i) => (
               <div className="event-row" key={label}>
                  <span className="num">{i + 1}</span>
                  <span className="label">{label}</span>
                  <span className="num small">{events.find((e) => e.label === label)?.num}</span>
                  <span className="event-controls">
                     <button type="button" onClick={() => move(i, -1)} aria-label="nach oben">
                        ▲
                     </button>
                     <button type="button" onClick={() => move(i, 1)} aria-label="nach unten">
                        ▼
                     </button>
                  </span>
               </div>
            ))}
         </div>
         <div className="computed">
            Letzte Karte in der Reihenfolge: <b>{lastNum ?? '—'}</b>
         </div>
      </div>
   )
}

function UploadPuzzle({ station, onUpload }: { station: PublicStation; onUpload?: PuzzleBodyProps['onUpload'] }) {
   const [file, setFile] = useState<File | null>(null)
   const [preview, setPreview] = useState('')
   const [stored, setStored] = useState(false)

   function handleFile(f: File | undefined) {
      if (!f) return
      setFile(f)
      setStored(false)
      const localUrl = URL.createObjectURL(f)
      setPreview(localUrl)
      const meta: UploadFile = { name: f.name, size: f.size, type: f.type, dataUrl: null }
      // Bild verkleinert mitspeichern, damit die Spielleitung es wirklich sieht.
      const img = new Image()
      img.onload = () => {
         try {
            meta.dataUrl = downscaleImage(img)
         } catch {
            /* nur Metadaten */
         }
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
            {(station.checklist ?? []).map((c, i) => (
               <li key={i}>
                  <span className="box">□</span> {c}
               </li>
            ))}
         </ul>
         <label className="file-drop">
            {file ? `geladen: ${file.name}${stored ? ' · gespeichert ✓' : ' · wird gespeichert…'}` : 'Bild hierher ziehen oder auswählen'}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFile(e.target.files?.[0])} />
         </label>
         {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- lokales Blob/data:-URL, nichts zu optimieren
            <img className="preview" src={preview} alt="Upload-Vorschau" />
         )}
      </div>
   )
}

function MirrorPuzzle({ station }: { station: PublicStation }) {
   const [flipped, setFlipped] = useState(false)
   return (
      <div className="puzzle">
         <div className="mirror" style={{ transform: flipped ? 'scaleX(-1)' : 'none' }}>
            {(station.cipher ?? []).map((line, i) => (
               <div className="cipher-line" key={i}>
                  {line}
               </div>
            ))}
         </div>
         <button type="button" className="link" onClick={() => setFlipped((f) => !f)}>
            {flipped ? '↺ Spiegel zurück' : '⟲ Text spiegeln'}
         </button>
         {station.hint && <div className="hint-block">{station.hint}</div>}
      </div>
   )
}

function MemoryPuzzle() {
   const [count, setCount] = useState(10)
   const [phase, setPhase] = useState<'idle' | 'show' | 'question'>('idle')
   const timerRef = useRef<number | null>(null)

   useEffect(
      () => () => {
         if (timerRef.current !== null) window.clearInterval(timerRef.current)
      },
      [],
   )

   function start() {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      setPhase('show')
      setCount(10)
      let c = 10
      timerRef.current = window.setInterval(() => {
         c -= 1
         setCount(c)
         if (c <= 0) {
            if (timerRef.current !== null) window.clearInterval(timerRef.current)
            timerRef.current = null
            setPhase('question')
         }
      }, 1000)
   }
   return (
      <div className="puzzle">
         {phase === 'idle' && (
            <button type="button" className="btn" onClick={start}>
               ▶ 10 Sekunden starten
            </button>
         )}
         {phase === 'show' && (
            <div className="desk-scene">
               <div className="scene-label">SCHREIBTISCH</div>
               <div className="desk-items">
                  <span>☕</span>
                  <span>📎</span>
                  <span>📷</span>
                  <span>🔑</span>
                  <span>✒️</span>
                  <span>🔋</span>
                  <span>📕</span>
               </div>
               <div className="countdown">noch {count}s …</div>
            </div>
         )}
         {phase === 'question' && (
            <div className="memory-q">
               <div className="chip-label">Fragen zum Schreibtisch</div>
               <p>Welche Gegenstände hattet ihr vor Augen? Schreibt eure Eindrücke auf und leitet die Lösungszahl ab.</p>
            </div>
         )}
      </div>
   )
}

function CandidatesPuzzle({ station }: { station: PublicStation }) {
   // Prüftabelle: pro Kandidat zählen, wie viele Aussagen wahr sind.
   const candidates = station.candidates ?? []
   const statements = station.statements ?? []
   const [eliminated, setEliminated] = useState<Record<number, boolean>>({})

   function truthCount(n: number): boolean[] {
      const divisors = Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0)
      return [n % 2 === 1, Number.isInteger(Math.sqrt(n)), divisors.length === 3, n > 20]
   }

   function toggle(n: number) {
      setEliminated((prev) => ({ ...prev, [n]: !prev[n] }))
   }

   return (
      <div className="puzzle">
         <table className="report">
            <thead>
               <tr>
                  <th>Kandidat</th>
                  {statements.map((s, i) => (
                     <th key={i}>{s.split(':')[0]}</th>
                  ))}
                  <th>Wahr</th>
                  <th>Raus?</th>
               </tr>
            </thead>
            <tbody>
               {candidates.map((n) => {
                  const truths = truthCount(n)
                  const count = truths.filter(Boolean).length
                  return (
                     <tr key={n} className={eliminated[n] ? 'struck' : count === 3 ? 'done' : ''}>
                        <td className="mark">{n}</td>
                        {truths.map((t, i) => (
                           <td key={i} className="mark">
                              {t ? '✓' : '✗'}
                           </td>
                        ))}
                        <td className="mark">{count}/4</td>
                        <td className="mark">
                           <button type="button" className="link small" onClick={() => toggle(n)}>
                              {eliminated[n] ? '↩ zurück' : '✕ raus'}
                           </button>
                        </td>
                     </tr>
                  )
               })}
            </tbody>
         </table>
         <div className="computed">
            Übrig: <b>{candidates.filter((n) => !eliminated[n]).join(' · ') || '—'}</b>
         </div>
      </div>
   )
}

function TeamPuzzle() {
   // Reine Team-Aktion am Tisch — kein Terminal-Input nötig.
   return (
      <div className="puzzle">
         <div className="grid2">
            <div className="chip ref">
               <div className="chip-label">REGELN</div>
               <p>Nur Ja/Nein-Fragen. Zeigen und Beschreiben verboten.</p>
               <p>Fragt erst grob (Formen, Ecken), dann Positionen.</p>
            </div>
            <div>
               <div className="chip-label">VIER SKIZZEN — eine stimmt</div>
               <div className="card-cards">
                  {[1, 2, 3, 4].map((n) => (
                     <div key={n} className="card-mini">
                        S{n}
                     </div>
                  ))}
               </div>
               <div className="note">Geheime Vorlage liegt im Umschlag — eine Person schaut, Rest fragt.</div>
            </div>
         </div>
      </div>
   )
}

function CalendarPuzzle({ station }: { station: PublicStation }) {
   // Jede Akte genau einer Uhrzeit zuordnen.
   const acts = station.acts ?? []
   const slots = station.slots ?? []
   const [assign, setAssign] = useState<Record<number, string>>({})

   function setSlot(actI: number, slot: string) {
      setAssign((prev) => ({ ...prev, [actI]: slot }))
   }

   const usedSlots = Object.values(assign).filter(Boolean)
   const duplicates = new Set(usedSlots).size !== usedSlots.length
   const atOne = acts.find((a) => assign[a.i] === '13:00')

   return (
      <div className="puzzle">
         <div className="event-list">
            {acts.map((a) => (
               <div className="event-row" key={a.i}>
                  <span className="num">Akte {a.i}</span>
                  <span className="label">{a.label}</span>
                  <select value={assign[a.i] ?? ''} onChange={(e) => setSlot(a.i, e.target.value)} aria-label={`Uhrzeit für ${a.label}`}>
                     <option value="">—</option>
                     {slots.map((s) => (
                        <option key={s} value={s}>
                           {s} Uhr
                        </option>
                     ))}
                  </select>
               </div>
            ))}
         </div>
         <div className="computed">
            {duplicates ? (
               <>⚠ Jede Uhrzeit nur einmal vergeben.</>
            ) : (
               <>
                  Um 13:00 liegt: <b>{atOne ? `Akte ${atOne.i} (${atOne.label})` : '—'}</b>
               </>
            )}
         </div>
      </div>
   )
}

function BinaryPuzzle({ station }: { station: PublicStation }) {
   // Fünf Bit (Standard: 10111 = 23), umwandelbar
   const weights = station.weights ?? []
   const [bits, setBits] = useState('10111')
   const decimal = bits
      .split('')
      .reduce((acc, b, i) => acc + Number(b) * (weights[i] ?? 0), 0)
   function toggle(i: number) {
      setBits((prev) =>
         prev
            .split('')
            .map((c, j) => (j === i ? (c === '1' ? '0' : '1') : c))
            .join(''),
      )
   }
   return (
      <div className="puzzle">
         <div className="binary">
            {bits.split('').map((b, i) => (
               <button
                  type="button"
                  key={i}
                  className={`bit-cell ${b === '1' ? 'on' : ''}`}
                  onClick={() => toggle(i)}
                  title={String(weights[i] ?? '')}
               >
                  <span className="weight">{weights[i]}</span>
                  <span className="digit">{b}</span>
               </button>
            ))}
         </div>
         <div className="computed">
            Dezimal: <b>{decimal}</b>
            <span className="plus">{weights.map((w, i) => (bits[i] === '1' ? w : '·')).join(' + ')}</span>
         </div>
      </div>
   )
}

const CONTROL_FIELDS = [
   '31 FEB',
   '25:61 UHR',
   '7 × 8 = 54',
   'BINÄR: 10201',
   'QUARTAL Q5',
   '1 Stunde = 60 Minuten',
   '1 Jahr = 13 Monate',
   '360° ÷ 4 = 90°',
   '1 Meter = 90 cm',
   '1 Dutzend = 12',
   '21 ist eine Primzahl',
   '1 Woche = 8 Tage',
]

function ControlPuzzle({ station }: { station: PublicStation }) {
   // Zwölf Felder, anklickbar markieren — gezählt wird lokal, ohne Wertung.
   const [marks, setMarks] = useState<Record<number, boolean>>({})
   const marked = Object.values(marks).filter(Boolean).length

   function toggle(i: number) {
      setMarks((prev) => ({ ...prev, [i]: !prev[i] }))
   }

   return (
      <div className="puzzle">
         <div className="control-grid">
            {CONTROL_FIELDS.map((field, i) => (
               <button
                  type="button"
                  key={i}
                  className={`ctrl ${marks[i] ? 'marked' : ''}`}
                  onClick={() => toggle(i)}
                  aria-pressed={Boolean(marks[i])}
               >
                  {marks[i] ? '✕ ' : ''}{field}
               </button>
            ))}
         </div>
         {station.note && <div className="note">{station.note}</div>}
         <div className="chip-label">Markiere alle fehlerhaften Felder (Anzahl = Lösungszahl)</div>
         <div className="computed">
            Markiert: <b>{marked}</b>
         </div>
      </div>
   )
}

function FoldPuzzle() {
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

function MaskPuzzle({ station }: { station: PublicStation }) {
   return (
      <div className="puzzle">
         <div className="matrix">
            {(station.grid ?? []).join(' ').split(' ').map((c, i) => (
               <span className="cell" key={i}>
                  {c}
               </span>
            ))}
         </div>
         {station.hint && <div className="hint-block">{station.hint}</div>}
      </div>
   )
}

function EquationPuzzle({ station }: { station: PublicStation }) {
   return (
      <div className="puzzle">
         <div className="equations">
            {(station.equations ?? []).map((e, i) => (
               <div className="eq" key={i}>
                  {e}
               </div>
            ))}
         </div>
      </div>
   )
}

function parseAmount(raw: string): number {
   const cleaned = raw.replace(/[^\d,.-]/g, '').replace(',', '.')
   const n = Number(cleaned)
   return Number.isFinite(n) ? n : 0
}

function AccountingPuzzle({ station }: { station: PublicStation }) {
   // Vom kleinsten zum größten Betrag sortieren, dann Anfangsbuchstaben lesen.
   const items = station.items ?? []
   const [order, setOrder] = useState<string[]>(items.map((it) => it.name))

   function move(i: number, dir: number) {
      const next = [...order]
      const j = i + dir
      if (j < 0 || j >= next.length) return
      ;[next[i], next[j]] = [next[j], next[i]]
      setOrder(next)
   }

   function autoSort() {
      setOrder(
         [...items]
            .sort((a, b) => parseAmount(a.amount) - parseAmount(b.amount))
            .map((it) => it.name),
      )
   }

   const amountOf = (name: string): string => items.find((it) => it.name === name)?.amount ?? ''
   const initials = order.map((name) => name.charAt(0)).join('')

   return (
      <div className="puzzle">
         <div className="event-list">
            {order.map((name, i) => (
               <div className="event-row" key={name}>
                  <span className="num">{i + 1}</span>
                  <span className="label">{name}</span>
                  <span className="num small">{amountOf(name)}</span>
                  <span className="event-controls">
                     <button type="button" onClick={() => move(i, -1)} aria-label="nach oben">
                        ▲
                     </button>
                     <button type="button" onClick={() => move(i, 1)} aria-label="nach unten">
                        ▼
                     </button>
                  </span>
               </div>
            ))}
         </div>
         <div className="btn-row">
            <button type="button" className="link" onClick={autoSort}>
               Nach Betrag sortieren
            </button>
         </div>
         <div className="computed">
            Anfangsbuchstaben (oben → unten): <b>{initials || '—'}</b>
         </div>
      </div>
   )
}

function FinalConfession() {
   return (
      <div className="puzzle">
         <div className="confession">
            <p>
               „Miss Anti-lomene hat das Chaos nicht erfunden — sie hat es dokumentiert. Und jetzt liegt es an euch, es zu
               entschlüsseln.“
            </p>
            <p>
               Zählt die Wörter der drei Sätze, wandelt jede Zahl in einen Buchstaben um (A=1 … Z=26). Das Zahlwort ist eure
               finale Lösungszahl.
            </p>
         </div>
      </div>
   )
}
