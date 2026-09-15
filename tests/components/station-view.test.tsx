import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StationView from '../../components/game/StationView'
import type { GroupPayload, PublicStation } from '../../lib/types'

const station: PublicStation = {
   n: 1,
   title: 'Der manipulierte Bericht',
   kind: 'logik',
   prompt: 'Prüft alles.',
   rows: [{ i: 1, input: '18 von 72', claim: '25 %' }],
}

const groupState = {
   hints: { 1: 0 },
   uploads: {},
   unlocked: { 1: true },
} as unknown as GroupPayload

function renderView(overrides: Partial<Parameters<typeof StationView>[0]> = {}) {
   const onSolved = vi.fn().mockResolvedValue(true)
   const props: Parameters<typeof StationView>[0] = {
      station,
      solvedMap: {},
      solvedValue: undefined,
      groupState,
      isUnlocked: true,
      onSolved,
      onHint: vi.fn().mockResolvedValue(undefined),
      onUpload: vi.fn().mockResolvedValue(undefined),
      onNext: vi.fn(),
      onPrev: vi.fn(),
      canPrev: false,
      index: 0,
      total: 20,
      openStation: vi.fn(),
      ...overrides,
   }
   render(<StationView {...props} />)
   return { onSolved, props }
}

describe('StationView', () => {
   it('leere Eingabe → Fehlermeldung, kein Server-Call', async () => {
      const user = userEvent.setup()
      const { onSolved } = renderView()
      await user.click(screen.getByRole('button', { name: 'Eingeben' }))
      expect(await screen.findByText(/keine Eingabe erkannt/)).toBeInTheDocument()
      expect(onSolved).not.toHaveBeenCalled()
   })

   it('Server-valid → Erfolg und onSolved mit Rohwert', async () => {
      const user = userEvent.setup()
      const { onSolved } = renderView()
      await user.type(screen.getByPlaceholderText('___'), '26')
      await user.click(screen.getByRole('button', { name: 'Eingeben' }))
      expect(await screen.findByText(/validiert/)).toBeInTheDocument()
      expect(onSolved).toHaveBeenCalledWith(1, '26')
   })

   it('Server-invalid → Fehler, Eingabe bleibt', async () => {
      const user = userEvent.setup()
      renderView({ onSolved: vi.fn().mockResolvedValue(false) })
      await user.type(screen.getByPlaceholderText('___'), '99')
      await user.click(screen.getByRole('button', { name: 'Eingeben' }))
      expect(await screen.findByText(/fehlerhaft/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText('___')).toHaveValue('99')
   })

   it('Netzfehler → Hinweis zum Wiederholen', async () => {
      const user = userEvent.setup()
      renderView({ onSolved: vi.fn().mockRejectedValue(new Error('Offline')) })
      await user.type(screen.getByPlaceholderText('___'), '26')
      await user.click(screen.getByRole('button', { name: 'Eingeben' }))
      expect(await screen.findByText(/Offline/)).toBeInTheDocument()
   })

   it('gelöste Station ist gesperrt dargestellt', () => {
      renderView({ solvedValue: '26' })
      expect(screen.getByPlaceholderText('___')).toBeDisabled()
      expect(screen.getByText('station abgeschlossen')).toBeInTheDocument()
   })
})
