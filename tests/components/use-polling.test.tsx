import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePolling } from '../../lib/use-polling'

describe('usePolling', () => {
   it('lädt initial und liefert Daten', async () => {
      const fetcher = vi.fn().mockResolvedValue({ n: 1 })
      const { result } = renderHook(() => usePolling(fetcher, 1000))
      expect(result.current.loading).toBe(true)
      await waitFor(() => expect(result.current.data).toEqual({ n: 1 }))
      expect(result.current.error).toBe('')
      expect(result.current.loading).toBe(false)
      expect(fetcher).toHaveBeenCalledTimes(1)
   })

   it('meldet offline nach 2 Fehlern, erholt sich bei Erfolg', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('down'))
      const { result } = renderHook(() => usePolling(fetcher, 10))
      await waitFor(() => expect(result.current.offline).toBe(true))
      expect(result.current.error).toBe('down')
      fetcher.mockResolvedValue('ok')
      await act(async () => {
         await result.current.reload()
      })
      expect(result.current.offline).toBe(false)
      expect(result.current.data).toBe('ok')
   })

   it('ingest speist Fremddaten ein und setzt Fehler zurück', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('x'))
      const onData = vi.fn()
      const { result } = renderHook(() => usePolling(fetcher, 60_000, onData))
      await waitFor(() => expect(result.current.error).toBe('x'))
      act(() => {
         result.current.ingest('fresh')
      })
      expect(result.current.data).toBe('fresh')
      expect(result.current.error).toBe('')
      expect(onData).toHaveBeenCalledWith('fresh')
   })
})
