// Winzige WebAudio-Soundeffekte, kein Asset nötig. Alles no-op ohne User-Geste.
let ctx = null

function audio() {
   if (typeof window === 'undefined') return null
   try {
      const AC = window.AudioContext ?? window.webkitAudioContext
      if (!AC) return null
      ctx ??= new AC()
      if (ctx.state === 'suspended') void ctx.resume()
      return ctx
   } catch {
      return null
   }
}

function tone(freq, at, dur, type = 'square', gain = 0.06) {
   const ac = audio()
   if (!ac) return
   try {
      const osc = ac.createOscillator()
      const g = ac.createGain()
      osc.type = type
      osc.frequency.value = freq
      g.gain.setValueAtTime(gain, ac.currentTime + at)
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + dur)
      osc.connect(g).connect(ac.destination)
      osc.start(ac.currentTime + at)
      osc.stop(ac.currentTime + at + dur)
   } catch {
      // still kaputt ist schlimmer als still
   }
}

export function playOk() {
   tone(660, 0, 0.12)
   tone(990, 0.1, 0.18)
}

export function playErr() {
   tone(220, 0, 0.2, 'sawtooth', 0.05)
   tone(160, 0.15, 0.25, 'sawtooth', 0.05)
}

export function playSolved() {
   tone(523, 0, 0.12)
   tone(659, 0.1, 0.12)
   tone(784, 0.2, 0.2)
}

export function playFinale() {
   ;[523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.18))
}
