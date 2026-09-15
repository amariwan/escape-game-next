'use client'

import { useEffect, useRef, useState } from 'react'

const VIDEO_ID = 'iyMq77jgDAU'

interface YouTubePlayer {
   mute(): void
   playVideo(): void
   destroy(): void
}

interface YouTubeNamespace {
   Player: new (
      elementId: string,
      options: {
         videoId: string
         playerVars: Record<string, number>
         events: {
            onReady: (event: { target: YouTubePlayer }) => void
            onStateChange: (event: { data: number }) => void
            onError: () => void
         }
      },
   ) => YouTubePlayer
   PlayerState: { ENDED: number }
}

declare global {
   interface Window {
      YT?: YouTubeNamespace
      onYouTubeIframeAPIReady?: () => void
   }
}

interface StartScreenProps {
   onStart: () => void
   onReset: () => void
   solvedCount: number
   groupCode: string
}

export default function StartScreen({ onStart, onReset, solvedCount, groupCode }: StartScreenProps) {
   const playerRef = useRef<YouTubePlayer | null>(null)
   const startRef = useRef(onStart)
   const [playerStatus, setPlayerStatus] = useState('video lauft')

   useEffect(() => {
      startRef.current = onStart
   }, [onStart])

   useEffect(() => {
      let disposed = false

      function createPlayer() {
         if (disposed || !window.YT?.Player || playerRef.current) return

         playerRef.current = new window.YT.Player('intro-video-player', {
            videoId: VIDEO_ID,
            playerVars: {
               autoplay: 1,
               controls: 1,
               modestbranding: 1,
               rel: 0,
               mute: 1,
               playsinline: 1,
            },
            events: {
               onReady: (event) => {
                  setPlayerStatus('video lauft')
                  event.target.mute()
                  event.target.playVideo()
               },
               onStateChange: (event) => {
                  if (window.YT && event.data === window.YT.PlayerState.ENDED) {
                     setPlayerStatus('video beendet')
                     startRef.current()
                  }
               },
               onError: () => {
                  setPlayerStatus('fallback bereit')
               },
            },
         })
      }

      if (window.YT?.Player) {
         createPlayer()
      } else {
         const previousReady = window.onYouTubeIframeAPIReady
         window.onYouTubeIframeAPIReady = () => {
            previousReady?.()
            createPlayer()
         }

         if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
            const tag = document.createElement('script')
            tag.src = 'https://www.youtube.com/iframe_api'
            tag.async = true
            tag.onerror = () => setPlayerStatus('fallback bereit')
            document.head.appendChild(tag)
         }
      }

      return () => {
         disposed = true
         playerRef.current?.destroy?.()
         playerRef.current = null
      }
   }, [])

   return (
      <div className="start">
         <div className="eyebrow">Miss Anti-lomene · Gruppe {groupCode}</div>
         <h1 className="title">
            Willkommen im
            <br />
            <span className="accent">Escape Game</span>
         </h1>

         <div className="video-frame">
            <div className="video-badge">● LIVE FEED · {playerStatus}</div>
            <div id="intro-video-player" title="Einführung" className="youtube-player" />
         </div>

         <p className="prompt center">
            Ein Video, ein QR-Code, zwanzig Stationen. Miss Anti-lomene hat das Chaos protokolliert. Euer Ziel: alle 20
            Lösungszahlen entschlüsseln — zusammen ergeben sie ein Wort.
         </p>

         <div className="fade-in">
            <div className="terminal-line fallback-line">
               <span className="caret">›</span>
               <span className="fallback-copy">Nach dem Video startet es automatisch.</span>
               <button type="button" className="link" onClick={onStart}>
                  Falls nicht: QR-Code öffnen
               </button>
            </div>
         </div>
         {solvedCount > 0 && (
            <button type="button" className="link" onClick={onReset}>
               Spielstand zurücksetzen
            </button>
         )}
      </div>
   )
}
