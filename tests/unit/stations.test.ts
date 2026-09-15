import { describe, expect, it } from 'vitest'
import { FINAL_PASSWORD, PUBLIC_STATIONS, SOLUTIONS, STATIONS } from '../../lib/game-data/stations.js'

// Diese Tests zementieren Spiel-Invarianten: löscht/verändert jemand eine
// Lösung oder ein Pflichtfeld, schlagen sie an, bevor der Client crasht.
describe('STATIONS', () => {
   it('genau 20 Stationen, Nummern 1..20 eindeutig', () => {
      expect(STATIONS).toHaveLength(20)
      expect(STATIONS.map((s) => s.n).sort((a, b) => a - b)).toEqual(
         Array.from({ length: 20 }, (_, i) => i + 1),
      )
   })

   it('jede Station hat Titel, Prompt, Lösung 1..26 und Hinweise', () => {
      for (const s of STATIONS) {
         expect(s.title.length, `Station ${s.n} Titel`).toBeGreaterThan(0)
         expect(s.prompt.length, `Station ${s.n} Prompt`).toBeGreaterThan(0)
         expect(Number.isInteger(s.solution), `Station ${s.n} Lösung`).toBe(true)
         expect(s.solution, `Station ${s.n} Bereich`).toBeGreaterThanOrEqual(1)
         expect(s.solution, `Station ${s.n} Bereich`).toBeLessThanOrEqual(26)
      }
   })

   it('jede Station erfüllt ihren Renderer-Vertrag (kein Crash wie früher bei 10/12/15)', () => {
      // Vertrag aus PuzzleBody: welches Kind braucht welche Felder
      const needs: Record<string, (keyof (typeof STATIONS)[number])[]> = {
         logik: ['rows'],
         muster: ['reference'],
         reihenfolge: ['events'],
         upload: ['checklist'],
         spiegel: ['cipher'],
         kandidaten: ['candidates', 'statements'],
         kalender: ['acts', 'slots'],
         'binär': ['weights'],
         buchhaltung: ['items'],
         maske: ['grid'],
         gleichung: ['equations'],
      }
      for (const s of STATIONS) {
         for (const field of needs[s.kind] ?? []) {
            const value = s[field] as unknown[] | undefined
            expect(
               Array.isArray(value) && value.length > 0,
               `Station ${s.n} (${s.kind}) braucht nicht-leeres ${String(field)}`,
            ).toBe(true)
         }
      }
   })

   it('Pflichtfelder je Kind vorhanden', () => {
      const byN = (n: number) => STATIONS.find((s) => s.n === n)!
      expect(byN(1).rows).toHaveLength(6)
      expect(byN(4).reference).toHaveLength(3)
      expect(byN(5).events).toHaveLength(7)
      expect(byN(5).hintLevels).toHaveLength(3)
      expect(byN(6).checklist!.length).toBeGreaterThan(0)
      expect(byN(8).cipher).toHaveLength(4)
      expect(byN(10).candidates).toHaveLength(5)
      expect(byN(10).statements).toHaveLength(4)
      expect(byN(12).acts).toHaveLength(5)
      expect(byN(12).slots).toHaveLength(5)
      expect(byN(13).weights).toEqual([16, 8, 4, 2, 1])
      expect(byN(15).items!.length).toBeGreaterThan(0)
      expect(byN(17).grid!.length).toBeGreaterThan(0)
      expect(byN(18).equations).toHaveLength(4)
      expect(byN(19).grid!.length).toBeGreaterThan(0)
   })

   it('Kandidaten-Logik Station 10: genau ein Kandidat mit drei wahren Aussagen', () => {
      const s = STATIONS.find((x) => x.n === 10)!
      const truthCount = (n: number): number => {
         const divisors = Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0)
         return [n % 2 === 1, Number.isInteger(Math.sqrt(n)), divisors.length === 3, n > 20].filter(Boolean).length
      }
      const winners = (s.candidates ?? []).filter((n) => truthCount(n) === 3)
      expect(winners).toEqual([s.solution])
   })
})

describe('SOLUTIONS / FINAL_PASSWORD', () => {
   it('Buchstaben folgen A=1..Z=26', () => {
      for (const entry of SOLUTIONS) {
         expect(entry.letter).toBe(String.fromCharCode(64 + entry.solution))
      }
   })

   it('Passwort ergibt sich aus den Lösungen (PDF S.22)', () => {
      const derived = SOLUTIONS.map((s) => s.letter).join('')
      expect(derived).toBe('ZUSAMMENSINDWIRSTARK')
      expect(FINAL_PASSWORD).toBe(derived)
   })
})

describe('PUBLIC_STATIONS', () => {
   it('enthält kein einziges solution-Byte', () => {
      expect(PUBLIC_STATIONS).toHaveLength(20)
      const raw = JSON.stringify(PUBLIC_STATIONS)
      expect(raw).not.toContain('"solution"')
      for (const s of PUBLIC_STATIONS) {
         expect('solution' in s).toBe(false)
      }
   })
})
