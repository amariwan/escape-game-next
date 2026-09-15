// Gemeinsame Typen für Store, API und Clients.

export type GameMode = 'linear' | 'open' | 'manual' | 'split'

/** Wo das Team gemeinsam steht — strikter Follow-Modus, serverseitig. */
export type ActivePhase = 'play' | 'finale'

export type StationKind =
   | 'logik'
   | 'rekonstruktion'
   | 'signal'
   | 'muster'
   | 'reihenfolge'
   | 'upload'
   | 'spiegel'
   | 'gedaechtnis'
   | 'kandidaten'
   | 'team'
   | 'kalender'
   | 'binär'
   | 'prüfung'
   | 'buchhaltung'
   | 'falten'
   | 'maske'
   | 'gleichung'
   | 'finale'

export interface ReportRow {
   i: number
   input: string
   claim: string
}

export interface TimelineEvent {
   label: string
   num: number
}

export interface CalendarAct {
   i: number
   label: string
}

export interface ShopItem {
   name: string
   amount: string
}

export interface Station {
   n: number
   title: string
   kind: StationKind
   prompt: string
   solution: number
   note?: string
   hint?: string
   hints?: string[]
   hintLevels?: string[]
   rows?: ReportRow[]
   events?: TimelineEvent[]
   reference?: string[]
   checklist?: string[]
   cipher?: string[]
   candidates?: number[]
   statements?: string[]
   acts?: CalendarAct[]
   slots?: string[]
   weights?: number[]
   items?: ShopItem[]
   grid?: string[]
   equations?: string[]
}

/** Station ohne Lösung — das einzige, was der Client je sehen darf. */
export type PublicStation = Omit<Station, 'solution'>

export interface SolutionEntry {
   n: number
   solution: number
   letter: string
}

export interface GroupSettings {
   mode: GameMode
   timerMinutes: number
   startedAt: string | null
   pausedAt: string | null
   elapsedPauseMs: number
   finishedAt: string | null
   revealFinale: boolean
}

export interface UploadMeta {
   name: string
   size: number
   type: string
   dataUrl: string | null
   hasImage: boolean
   approved: boolean
   uploadedAt: string
}

export interface TeamPhoto {
   name: string
   size: number
   type: string
   dataUrl: string | null
   hasImage: boolean
   uploadedAt: string
}

/** Split-Modus: genau eine Station pro Gerät (Aufgabenverteilung). */
export interface SplitState {
   /** memberId → Stationsnummer der eigenen Aufgabe. */
   assignments: Record<string, number>
}

export interface GroupRecord {
   code: string
   name: string
   solved: Record<number, string>
   unlocked: Record<number, boolean>
   split: SplitState
   hints: Record<number, number>
   attempts: Record<number, number>
   errors: Record<number, number>
   uploads: Record<number, UploadMeta>
   teamPhoto: TeamPhoto | null
   settings: GroupSettings
   members: string[]
   poolCode: string
   /** Gemeinsame Station aller Geräte (strikter Follow-Modus). */
   activeStation: number
   /** Gemeinsame Ansicht: Stationen oder Finale. Intro/QR bleiben lokal. */
   activePhase: ActivePhase
   createdAt: string
   updatedAt: string
}

/** Was tatsächlich auf Platte liegt — darf lückenhaft sein. */
export type StoredGroup = Partial<GroupRecord>

/** Event-Modus: solo = ein Event, eine Gruppe (alle Geräte gemeinsam);
 *  multi = beliebig viele Gruppen parallel. */
export type EventMode = 'solo' | 'multi'

export interface EventSettings {
   mode: EventMode
   /** Gruppen-Code der Solo-Gruppe (nur im Solo-Modus relevant). */
   soloCode: string | null
   updatedAt: string
}

export interface StoreShape {
   groups: Record<string, StoredGroup>
   event?: Partial<EventSettings>
}

export interface GroupPayload extends GroupRecord {
   memberCount: number
   maxMembers: number
   stationCount: number
   /** Buchstabe je gelöster Station — mehr sieht der Client nie. */
   letters: Record<number, string>
   /** Passwort nur bei revealFinale, sonst null. */
   finalWord: string | null
}

export interface SolveResult {
   group: GroupPayload
   valid: boolean
}

/** Datei-Metadaten für Uploads vom Client (vor Server-Persistenz). */
export interface UploadFile {
   name: string
   size: number
   type: string
   dataUrl: string | null
}

/** HTTP-Fehler mit Status — Routen mappen ihn auf die Response. */
export class HttpError extends Error {
   status: number
   constructor(status: number, message: string) {
      super(message)
      this.status = status
   }
}

export function httpError(status: number, message: string): HttpError {
   return new HttpError(status, message)
}
