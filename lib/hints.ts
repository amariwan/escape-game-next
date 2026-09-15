// Client-sichere Helfer — dieses Modul enthält KEINE Lösungen und darf
// überall (auch im Spieler-Bundle) importiert werden.
export interface HintSource {
   hintLevels?: string[]
   hints?: string[]
   hint?: string
}

export function normalizeInput(raw: unknown): string {
   return (raw ?? '')
      .toString()
      .trim()
      .replace(/[.,\s]/g, '')
      .replace(/^0+(?=\d)/, '')
}

// Hinweis-Stufen: hintLevels hat Vorrang vor hints (Station 5/12 haben
// zusätzlich ausführliche hints-Listen, die nicht als Stufen zählen).
export function hintLevelsFor(station: HintSource | null | undefined): string[] {
   return station?.hintLevels ?? station?.hints ?? (station?.hint ? [station.hint] : [])
}
