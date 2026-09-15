import { FINAL_PASSWORD, SOLUTIONS, STATIONS } from '../../lib/game-data/stations.js'
import PrintButton from './PrintButton.jsx'

function Material({ station }) {
   if (station.rows) {
      return (
         <table className="print-table">
            <thead><tr><th>Nr.</th><th>Ausgangsdaten</th><th>Behauptung</th><th>☐ korrekt</th><th>☐ falsch</th></tr></thead>
            <tbody>
               {station.rows.map((r) => (
                  <tr key={r.i}><td>{r.i}</td><td>{r.input}</td><td>{r.claim}</td><td>☐</td><td>☐</td></tr>
               ))}
            </tbody>
         </table>
      )
   }
   if (station.events) {
      return (
         <ul>{station.events.map((e) => <li key={e.label}>{e.label} — Zahl auf der Karte: <b>{e.num}</b></li>)}</ul>
      )
   }
   if (station.reference) {
      return <pre className="print-pre">{station.reference.join('\n')}</pre>
   }
   if (station.cipher) {
      return <pre className="print-pre">{station.cipher.join('\n')}</pre>
   }
   if (station.checklist) {
      return <ul>{station.checklist.map((c, i) => <li key={i}>☐ {c}</li>)}</ul>
   }
   if (station.equations) {
      return <pre className="print-pre">{station.equations.join('\n')}</pre>
   }
   if (station.grid) {
      return <pre className="print-pre">{station.grid.join('\n')}</pre>
   }
   if (station.candidates) {
      return (
         <div>
            <p>Kandidaten: {station.candidates.join(' · ')}</p>
            <ul>{station.statements.map((s, i) => <li key={i}>{s}</li>)}</ul>
         </div>
      )
   }
   if (station.acts) {
      return (
         <div>
            <p>Akten: {station.acts.map((a) => `${a.i} ${a.label}`).join(' · ')}</p>
            <p>Zeiten: {station.slots.join(' · ')}</p>
         </div>
      )
   }
   if (station.weights) {
      return <p>Gewichte: {station.weights.join(' · ')}</p>
   }
   if (station.items) {
      return <ul>{station.items.map((it) => <li key={it.name}>{it.name} — {it.amount}</li>)}</ul>
   }
   return null
}

export const metadata = { title: 'Druck-Paket · Miss Anti-lomene' }

export default function PrintPage() {
   return (
      <div className="print-doc">
         <div className="print-toolbar no-print">
            <a href="/">← Terminal</a>
            <span>Miss Anti-lomene · Druck-Paket (20 Stationen + Lösungsschlüssel)</span>
            <PrintButton />
         </div>
         {STATIONS.map((station) => (
            <section className="print-card" key={station.n}>
               <div className="print-head">
                  <b>Station {String(station.n).padStart(2, '0')}</b>
                  <h1>{station.title}</h1>
                  <span>{station.kind}</span>
               </div>
               <p>{station.prompt}</p>
               {station.note && <p><i>{station.note}</i></p>}
               {station.hint && <p><i>{station.hint}</i></p>}
               <Material station={station} />
               <details>
                  <summary>Hinweise für die Spielleitung</summary>
                  <ol>{(station.hintLevels ?? station.hints ?? []).map((h, i) => <li key={i}>{h}</li>)}</ol>
               </details>
            </section>
         ))}
         <section className="print-card">
            <h1>Lösungsschlüssel (nur Spielleitung)</h1>
            <table className="print-table">
               <thead><tr><th>St.</th><th>Zahl</th><th>Buchstabe</th></tr></thead>
               <tbody>
                  {SOLUTIONS.map((s) => (
                     <tr key={s.n}><td>{s.n}</td><td>{s.solution}</td><td>{s.letter}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
            <p>Passwort: <b>{FINAL_PASSWORD}</b></p>
         </section>
      </div>
   )
}
