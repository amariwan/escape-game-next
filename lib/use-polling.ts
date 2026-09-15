// Polling-Abo für Gruppen-Daten — ersetzt vier handgestrickte
// load+setInterval+Offline-Blöcke (GameClient, AdminClient, Projector, Scoreboard).
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface PollResult<T> {
   data: T | null
   error: string
   offline: boolean
   loading: boolean
   /** Erneut laden (wirft nie — Fehler landen in `error`/`offline`). */
   reload: () => Promise<void>
   /** Fremde Daten (z.B. POST-Antwort) in denselben State einspeisen. */
   ingest: (data: T) => void
}

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, onData?: (data: T) => void): PollResult<T> {
   const [data, setData] = useState<T | null>(null)
   const [error, setError] = useState('')
   const [offline, setOffline] = useState(false)
   const [loading, setLoading] = useState(true)
   const failures = useRef(0)

   const ingest = useCallback(
      (result: T) => {
         failures.current = 0
         setData(result)
         onData?.(result)
         setError('')
         setOffline(false)
         setLoading(false)
      },
      [onData],
   )

   const reload = useCallback(async () => {
      try {
         ingest(await fetcher())
      } catch (err) {
         failures.current += 1
         setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.')
         if (failures.current >= 2) setOffline(true)
         setLoading(false)
      }
   }, [fetcher, ingest])

   useEffect(() => {
      // Polling ist ein valides Abo auf ein externes System (Server-State);
      // der Linter erkennt das Fetch-Pattern nicht — gezielt begründet.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void reload()
      const id = window.setInterval(() => void reload(), intervalMs)
      return () => window.clearInterval(id)
   }, [reload, intervalMs])

   return { data, error, offline, loading, reload, ingest }
}
