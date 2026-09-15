// Bild-Downscale für Uploads — ein Codepfad für PuzzleBody + Finale,
// damit die Spielleitung echte Bilder statt Metadaten sieht.
export function downscaleImage(img: HTMLImageElement, maxEdge = 1280, quality = 0.8): string {
   const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
   const canvas = document.createElement('canvas')
   canvas.width = Math.round(img.width * scale)
   canvas.height = Math.round(img.height * scale)
   const ctx = canvas.getContext('2d')
   if (!ctx) throw new Error('Canvas ohne 2D-Kontext')
   ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
   return canvas.toDataURL('image/jpeg', quality)
}
