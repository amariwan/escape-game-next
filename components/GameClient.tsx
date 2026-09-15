'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PUBLIC_STATIONS } from '../lib/game-data/stations'
import { fetchJson, postJson } from '../lib/api-client'
import { getMemberId } from '../lib/member'
import { usePolling } from '../lib/use-polling'
import type { GroupPayload, UploadFile } from '../lib/types'
import StartScreen from './game/StartScreen'
import QRScreen from './game/QRScreen'
import StationView from './game/StationView'
import Finale from './game/Finale'
import Progress from './game/Progress'
import TopBar from './game/TopBar'
import Footer from './game/Footer'

const PHASE = {
   INTRO: 'intro',
   QR: 'qr',
   PLAY: 'play',
   FINALE: 'finale',
} as const

type Phase = (typeof PHASE)[keyof typeof PHASE]

type GroupResponse = GroupPayload & { valid?: boolean }

export default function GameClient({ groupCode }: { groupCode: string }) {
   const [phase, setPhase] = useState<Phase>(PHASE.INTRO)
   const [index, setIndex] = useState(0)
   const [transition, setTransition] = useState(false)
   // Strikter Follow-Modus: Team-Stand liegt auf dem Server (activeStation/activePhase).
   // `booted` springt beim ersten Poll auf den Team-Stand (Refresh-sicher),
   // `lastNav` schützt eigene Navigation vor dem Zurückschnappen durch alten Poll.
   const booted = useRef(false)
   const lastNav = useRef(0)

   const fetcher = useCallback(
      () => fetchJson<GroupResponse>(`/api/groups/${groupCode}`, { cache: 'no-store' }),
      [groupCode],
   )
   const { data: groupState, error, offline, loading, reload, ingest } = usePolling(fetcher, 2000)

   const solved = useMemo(() => groupState?.solved ?? {}, [groupState])
   const groupInfo = useMemo(
      () => ({
         memberCount: groupState?.memberCount ?? groupState?.members?.length ?? 0,
         maxMembers: groupState?.maxMembers ?? 3,
      }),
      [groupState],
   )
   const total = PUBLIC_STATIONS.length
   const solvedCount = useMemo(() => Object.keys(solved).length, [solved])
   const progressPct = Math.round((solvedCount / total) * 100)
   const serverStation = groupState?.activeStation ?? 1
   const serverPhase = groupState?.activePhase ?? 'play'

   // Refresh landet auf dem Team-Stand: Wer schon spielt, überspringt Intro/QR.
   // Polling ist ein valides Abo auf ein externes System (Server-State) —
   // setState hier übernimmt Server-Wahrheit, kein abgeleiteter Render-State.
   useEffect(() => {
      if (booted.current || !groupState) return
      booted.current = true
      const hasProgress = solvedCount > 0 || serverStation > 1 || serverPhase === 'finale'
      if (!hasProgress) return
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Server-Stand beim Boot übernehmen
      setIndex(Math.min(Math.max(serverStation - 1, 0), total - 1))
      setPhase(serverPhase === 'finale' ? PHASE.FINALE : PHASE.PLAY)
   }, [groupState, solvedCount, serverStation, serverPhase, total])

   // Fremd-Solve / Fremd-Navigation übernehmen — alle Geräte gleiche Aufgabe.
   useEffect(() => {
      if (!booted.current || !groupState) return
      if (Date.now() - lastNav.current < 2000) return
      if (phase !== PHASE.PLAY && phase !== PHASE.FINALE) return
      const wantIndex = Math.min(Math.max(serverStation - 1, 0), total - 1)
      const wantPhase = serverPhase === 'finale' ? PHASE.FINALE : PHASE.PLAY
      if (wantPhase !== phase) {
         // eslint-disable-next-line react-hooks/set-state-in-effect -- Fremd-Navigation (Poll) übernehmen
         setPhase(wantPhase)
         if (wantPhase === PHASE.PLAY) setIndex(wantIndex)
      } else if (wantPhase === PHASE.PLAY && wantIndex !== index) {
         setIndex(wantIndex)
      }
   }, [groupState, serverStation, serverPhase, phase, index, total])

   // Gerät als Mitglied registrieren — sonst bleibt der Zähler bei 0/3.
   useEffect(() => {
      let active = true
      async function register() {
         try {
            const group = await postJson<GroupResponse>('/api/groups/join', {
               code: groupCode,
               memberId: getMemberId(),
            })
            if (active) ingest(group)
         } catch {
            // Zähler bleibt stehen, Spiel läuft trotzdem (Poll übernimmt)
         }
      }
      void register()
      return () => {
         active = false
      }
   }, [groupCode, ingest])

   function goTo(next: Phase) {
      setTransition(true)
      window.setTimeout(() => {
         setPhase(next)
         setTransition(false)
      }, 380)
   }

   async function writeGroup(payload: Record<string, unknown>): Promise<GroupResponse> {
      const data = await postJson<GroupResponse>(`/api/groups/${groupCode}`, payload)
      ingest(data)
      return data
   }

   function startGame() {
      goTo(PHASE.QR)
   }

   /** Team-Navigation an den Server melden (strikter Follow-Modus). */
   function navigate(station: number, nextPhase: 'play' | 'finale') {
      lastNav.current = Date.now()
      void writeGroup({ action: 'navigate', station, phase: nextPhase }).catch(() => {
         // Poll übernimmt — Navigation gilt lokal trotzdem
      })
   }

   function enterGame() {
      const at = Math.min(Math.max(serverStation - 1, 0), total - 1)
      goTo(PHASE.PLAY)
      setIndex(at)
      navigate(at + 1, 'play')
   }

   async function onSolved(n: number, value: string): Promise<boolean> {
      const data = await writeGroup({ action: 'solve', station: n, value })
      return data.valid ?? false
   }

   async function requestHint(n: number): Promise<void> {
      await writeGroup({ action: 'hint', station: n })
   }

   async function registerUpload(station: number, file: UploadFile): Promise<void> {
      await writeGroup({
         action: 'upload',
         station,
         name: file.name,
         size: file.size,
         type: file.type,
         dataUrl: file.dataUrl ?? null,
      })
   }

   async function registerTeamPhoto(file: UploadFile): Promise<void> {
      await writeGroup({
         action: 'upload',
         station: 0,
         name: file.name,
         size: file.size,
         type: file.type,
         dataUrl: file.dataUrl ?? null,
      })
   }

   function nextStation() {
      if (index + 1 >= total) {
         goTo(PHASE.FINALE)
         navigate(serverStation, 'finale')
      } else {
         const next = index + 1
         setTransition(true)
         window.setTimeout(() => {
            setIndex(next)
            setTransition(false)
         }, 380)
         navigate(next + 1, 'play')
      }
   }

   function prevStation() {
      const prev = Math.max(0, index - 1)
      setIndex(prev)
      navigate(prev + 1, 'play')
   }

   function backToStations() {
      goTo(PHASE.PLAY)
      setIndex(0)
      navigate(1, 'play')
   }

   function openStation(n: number) {
      if (!groupState?.unlocked?.[n]) return
      setIndex(n - 1)
      setPhase(PHASE.PLAY)
      navigate(n, 'play')
   }

   function gotoFinale() {
      goTo(PHASE.FINALE)
      navigate(serverStation, 'finale')
   }

   let content
   if (loading) {
      content = (
         <div className="start">
            <div className="eyebrow">Gruppe {groupCode}</div>
            <h1 className="title">Terminal wird verbunden</h1>
         </div>
      )
   } else if (error && !groupState) {
      content = (
         <div className="start">
            <div className="eyebrow">Gruppe {groupCode}</div>
            <h1 className="title">Verbindung gestört</h1>
            <p className="prompt center">{error} · Prüft WLAN und Server.</p>
            <button type="button" className="btn primary" onClick={() => void reload()}>
               Erneut verbinden
            </button>
         </div>
      )
   } else if (phase === PHASE.INTRO) {
      content = <StartScreen onStart={startGame} solvedCount={solvedCount} groupCode={groupCode} />
   } else if (phase === PHASE.QR) {
      content = <QRScreen onEnter={enterGame} groupCode={groupCode} groupInfo={groupInfo} />
   } else if (phase === PHASE.FINALE) {
      content = <Finale solved={solved} groupState={groupState} onRestart={backToStations} onPhoto={registerTeamPhoto} />
   } else {
      const station = PUBLIC_STATIONS[index]
      const isUnlocked = groupState?.unlocked?.[station.n] ?? station.n === 1
      content = (
         <StationView
            station={station}
            solvedMap={solved}
            solvedValue={solved[station.n]}
            groupState={groupState}
            isUnlocked={isUnlocked}
            onSolved={onSolved}
            onHint={requestHint}
            onUpload={registerUpload}
            onNext={nextStation}
            onPrev={prevStation}
            canPrev={index > 0}
            index={index}
            total={total}
            openStation={openStation}
         />
      )
   }

   const showChrome = phase !== PHASE.INTRO && !loading

   return (
      <div className={`crt ${transition ? 'glitch' : ''}`}>
         <div className="bg-grid" />
         <div className="app">
            {showChrome ? (
               <div className="wrap">
                  {offline && (
                     <div className="offline-banner">
                        OFFLINE — letzte Daten werden gezeigt. Prüft WLAN/Server.
                        <button type="button" className="btn small" onClick={() => void reload()}>
                           Erneut verbinden
                        </button>
                     </div>
                  )}
                  <TopBar
                     phase={phase}
                     solvedCount={solvedCount}
                     total={total}
                     groupCode={groupCode}
                     groupInfo={groupInfo}
                     groupState={groupState}
                  />
                  <Progress
                     solved={solvedCount}
                     total={total}
                     pct={progressPct}
                     phase={phase}
                     onOpen={openStation}
                     onGotoFinale={gotoFinale}
                  />
                  <main key={phase + index} className={`content ${transition ? '' : 'fade-in'}`}>
                     {content}
                  </main>
                  <Footer solved={solved} groupCode={groupCode} groupInfo={groupInfo} />
               </div>
            ) : (
               <div className="wrap full">{content}</div>
            )}
         </div>
      </div>
   )
}
