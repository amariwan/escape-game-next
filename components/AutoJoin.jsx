'use client'

import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const MEMBER_KEY = 'escape-game-member-id'

function makeMemberId() {
   if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
   }

   return `member-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getMemberId() {
   const existing = window.localStorage.getItem(MEMBER_KEY)
   if (existing) return existing

   const next = makeMemberId()
   window.localStorage.setItem(MEMBER_KEY, next)
   return next
}

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
            const response = await fetch('/api/groups/join', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ memberId, poolCode }),
            })

            if (!response.ok) throw new Error('Automatische Gruppe nicht erreichbar.')

            const group = await response.json()
            if (!active) return

            setStatus(`Gruppe ${group.code} gefunden (${group.memberCount}/${group.maxMembers})`)
            router.replace(`/play/${group.code}`)
         } catch (err) {
            if (!active) return
            setError(err.message)
            setStatus('Automatischer Beitritt fehlgeschlagen')
         }
      }

      join()

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
                  <p className="prompt center">
                     {status}
                  </p>
                  {error && <p className="feedback err">{error}</p>}
               </div>
            </div>
         </div>
      </div>
   )
}
