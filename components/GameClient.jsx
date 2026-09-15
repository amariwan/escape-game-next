'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { STATIONS } from '../lib/game-data/stations.js'
import StartScreen from './game/StartScreen.jsx'
import QRScreen from './game/QRScreen.jsx'
import StationView from './game/StationView.jsx'
import Finale from './game/Finale.jsx'
import Progress from './game/Progress.jsx'
import TopBar from './game/TopBar.jsx'
import Footer from './game/Footer.jsx'

const PHASE = {
   INTRO: 'intro',
   QR: 'qr',
   PLAY: 'play',
   FINALE: 'finale',
}

export default function GameClient({ groupCode }) {
   const [phase, setPhase] = useState(PHASE.INTRO)
   const [index, setIndex] = useState(0)
   const [solved, setSolved] = useState({})
   const [groupInfo, setGroupInfo] = useState({ memberCount: 0, maxMembers: 3 })
   const [groupState, setGroupState] = useState(null)
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState('')
   const [offline, setOffline] = useState(false)
   const [transition, setTransition] = useState(false)
   const failures = useRef(0)

   const total = STATIONS.length
   const solvedCount = useMemo(() => Object.keys(solved).length, [solved])
   const progressPct = Math.round((solvedCount / total) * 100)

   const refreshGroup = useCallback(async () => {
      const response = await fetch(`/api/groups/${groupCode}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Gruppe nicht erreichbar.')
      const data = await response.json()
      setSolved(data.solved ?? {})
      setGroupState(data)
      setGroupInfo({
         memberCount: data.memberCount ?? data.members?.length ?? 0,
         maxMembers: data.maxMembers ?? 3,
      })
      setError('')
      failures.current = 0
      setOffline(false)
      setLoading(false)
   }, [groupCode])

   useEffect(() => {
      let active = true

      async function tick() {
         try {
            if (active) await refreshGroup()
         } catch (err) {
            if (active) {
               failures.current += 1
               setError(err.message)
               if (failures.current >= 2) setOffline(true)
               setLoading(false)
            }
         }
      }

      tick()
      const id = window.setInterval(tick, 2000)
      return () => {
         active = false
         window.clearInterval(id)
      }
   }, [refreshGroup])

   function goTo(next) {
      setTransition(true)
      window.setTimeout(() => {
         setPhase(next)
         setTransition(false)
      }, 380)
   }

   async function writeGroup(payload) {
      const response = await fetch(`/api/groups/${groupCode}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Speichern fehlgeschlagen.')
      const data = await response.json()
      setSolved(data.solved ?? {})
      setGroupState(data)
      setGroupInfo({
         memberCount: data.memberCount ?? data.members?.length ?? 0,
         maxMembers: data.maxMembers ?? 3,
      })
   }

   function startGame() {
      goTo(PHASE.QR)
   }

   function enterGame() {
      goTo(PHASE.PLAY)
      setIndex(0)
   }

   async function onSolved(n, value) {
      await writeGroup({ action: 'solve', station: n, value })
   }

   async function requestHint(n) {
      await writeGroup({ action: 'hint', station: n })
   }

   async function registerUpload(station, file) {
      await writeGroup({
         action: 'upload',
         station,
         name: file.name,
         size: file.size,
         type: file.type,
         dataUrl: file.dataUrl ?? null,
      })
   }

   async function registerTeamPhoto(file) {
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

   async function resetGame() {
      await writeGroup({ action: 'reset' })
      setIndex(0)
      setPhase(PHASE.INTRO)
   }

   function restart() {
      resetGame()
      setPhase(PHASE.PLAY)
   }

   function openStation(n) {
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
            <button className="btn primary" onClick={refreshGroup}>Erneut verbinden</button>
         </div>
      )
   } else if (phase === PHASE.INTRO) {
      content = (
         <StartScreen
            onStart={startGame}
            onReset={resetGame}
            solvedCount={solvedCount}
            groupCode={groupCode}
         />
      )
   } else if (phase === PHASE.QR) {
      content = <QRScreen onEnter={enterGame} groupCode={groupCode} groupInfo={groupInfo} />
   } else if (phase === PHASE.FINALE) {
      content = <Finale solved={solved} groupState={groupState} onRestart={restart} onPhoto={registerTeamPhoto} />
   } else {
      const station = STATIONS[index]
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
                        <button className="btn small" onClick={refreshGroup}>Erneut verbinden</button>
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
                     unlocked={groupState?.unlocked ?? {}}
                  />
                  <main key={phase + index} className={`content ${transition ? '' : 'fade-in'}`}>
                     {content}
                  </main>
                  <Footer
                     solved={solved}
                     onReset={resetGame}
                     groupCode={groupCode}
                     groupInfo={groupInfo}
                  />
               </div>
            ) : (
               <div className="wrap full">{content}</div>
            )}
         </div>
      </div>
   )
}
