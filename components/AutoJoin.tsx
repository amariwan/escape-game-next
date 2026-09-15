'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { postJson } from '../lib/api-client'
import { getMemberId } from '../lib/member'
import type { GroupPayload } from '../lib/types'

export default function AutoJoin() {
   const router = useRouter()
   const searchParams = useSearchParams()
   const [status, setStatus] = useState('Gruppe wird gesucht')
   const [error, setError] = useState('')

   useEffect(() => {
      let active = true

      async function join() {
         try {
            const memberId = getMemberId()
            const poolCode = searchParams.get('pool') ?? 'AUTO'
            const group = await postJson<GroupPayload>('/api/groups/join', { memberId, poolCode })
            if (!active) return

            setStatus(`Gruppe ${group.code} gefunden (${group.memberCount}/${group.maxMembers})`)
            router.replace(`/play/${group.code}`)
         } catch (err) {
            if (!active) return
            setError(err instanceof Error ? err.message : 'Automatischer Beitritt fehlgeschlagen')
            setStatus('Automatischer Beitritt fehlgeschlagen')
         }
      }

      void join()

      return () => {
         active = false
      }
   }, [router, searchParams])

   return (
      <div className="crt">
         <div className="bg-grid" />
         <div className="app">
            <div className="wrap full">
               <div className="start">
                  <div className="eyebrow">Miss Anti-lomene · Auto-Gruppe</div>
                  <h1 className="title">
                     Team wird
                     <br />
                     <span className="accent">automatisch geladen</span>
                  </h1>
                  <p className="prompt center">{status}</p>
                  {error && <p className="feedback err">{error}</p>}
               </div>
            </div>
         </div>
      </div>
   )
}
