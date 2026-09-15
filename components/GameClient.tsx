'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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

   function enterGame() {
      goTo(PHASE.PLAY)
      setIndex(0)
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
      } else {
         setTransition(true)
         window.setTimeout(() => {
            setIndex((current) => current + 1)
            setTransition(false)
         }, 380)
      }
   }

   function prevStation() {
      setIndex((current) => Math.max(0, current - 1))
   }

   async function doReset(next: Phase) {
      await writeGroup({ action: 'reset' })
      setIndex(0)
      setPhase(next)
   }

   function resetGame() {
      void doReset(PHASE.INTRO)
   }

   function restart() {
      void doReset(PHASE.PLAY)
   }

   function openStation(n: number) {
      if (!groupState?.unlocked?.[n]) return
      setIndex(n - 1)
      setPhase(PHASE.PLAY)
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
      content = <StartScreen onStart={startGame} onReset={resetGame} solvedCount={solvedCount} groupCode={groupCode} />
   } else if (phase === PHASE.QR) {
      content = <QRScreen onEnter={enterGame} groupCode={groupCode} groupInfo={groupInfo} />
   } else if (phase === PHASE.FINALE) {
      content = <Finale solved={solved} groupState={groupState} onRestart={restart} onPhoto={registerTeamPhoto} />
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
                     onGotoFinale={() => goTo(PHASE.FINALE)}
                  />
                  <main key={phase + index} className={`content ${transition ? '' : 'fade-in'}`}>
                     {content}
                  </main>
                  <Footer solved={solved} onReset={resetGame} groupCode={groupCode} groupInfo={groupInfo} />
               </div>
            ) : (
               <div className="wrap full">{content}</div>
            )}
         </div>
      </div>
   )
}
