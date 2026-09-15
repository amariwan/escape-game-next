import { describe, expect, it } from 'vitest'
import { hintLevelsFor, normalizeInput } from '../../lib/hints.js'

describe('normalizeInput', () => {
   it('entfernt Punkte, Kommas und Whitespaces', () => {
      expect(normalizeInput('2.6')).toBe('26')
      expect(normalizeInput('2,6')).toBe('26')
      expect(normalizeInput(' 2 6 ')).toBe('26')
   })

   it('entfernt führende Nullen', () => {
      expect(normalizeInput('026')).toBe('26')
      expect(normalizeInput('007')).toBe('7')
   })

   it('behandelt leere/fehlende Eingaben robust', () => {
      expect(normalizeInput('')).toBe('')
      expect(normalizeInput(null)).toBe('')
      expect(normalizeInput(undefined)).toBe('')
      expect(normalizeInput(26)).toBe('26')
   })
})

describe('hintLevelsFor', () => {
   it('hintLevels gewinnt über hints', () => {
      expect(hintLevelsFor({ hintLevels: ['a'], hints: ['b', 'c'] })).toEqual(['a'])
   })

   it('fällt auf hints bzw. hint zurück', () => {
      expect(hintLevelsFor({ hints: ['b'] })).toEqual(['b'])
      expect(hintLevelsFor({ hint: 'solo' })).toEqual(['solo'])
   })

   it('gibt [] für null/stationslose Eingaben', () => {
      expect(hintLevelsFor(null)).toEqual([])
      expect(hintLevelsFor(undefined)).toEqual([])
      expect(hintLevelsFor({})).toEqual([])
   })
})
