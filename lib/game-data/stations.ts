// Quelle: EscapeGame_Anti-lomene.pdf — 20 Stationen + Lösungsschlüssel (Seite 22)
// Jede Lösungszahl wird mit A=1..Z=26 in einen Buchstaben umgewandelt.
// Am Ende ergibt die Folge: ZUSAMMENSINDWIRSTARK.
//
// WICHTIG: `solution` darf nie an den Client — PUBLIC_STATIONS ist die
// entschärfte Projektion für alle Game-Komponenten. Die Prüfung passiert
// ausschließlich serverseitig in lib/group-store.ts.
import type { PublicStation, SolutionEntry, Station } from '../types'

// Client-sichere Helfer (keine Lösungen) — Re-Export für Server-Code,
// Clients importieren direkt aus lib/hints.ts, damit kein Solution-Byte
// ins Spieler-Bundle gelangt.
export { hintLevelsFor, normalizeInput } from '../hints'
export type { HintSource } from '../hints'

const N2L = (n: number): string => String.fromCharCode(64 + ((Number(n) % 26) || 26))

export const STATIONS: Station[] = [
   {
      n: 1,
      title: 'Der manipulierte Bericht',
      kind: 'logik',
      prompt:
         'Prüft jede Berechnung im Statusbericht und markiert sie als korrekt oder falsch. Die Zeilennummern aller falschen Berechnungen von oben nach unten gelesen ergeben die Lösungszahl.',
      rows: [
         { i: 1, input: '18 von 72', claim: '25 %' },
         { i: 2, input: '15 von 60', claim: '30 %' },
         { i: 3, input: '7 Teams × 12 Min.', claim: '84 Min.' },
         { i: 4, input: '2 Std. 15 Min.', claim: '135 Min.' },
         { i: 5, input: '3 von 8', claim: '37,5 %' },
         { i: 6, input: '144 Teile ÷ 12 Boxen', claim: '11 pro Box' },
      ],
      hint: '18/72 = 25 % (richtig), 15/60 = 25 % (falsch), 84 richtig, 135 richtig, 37,5 richtig, 144/12 = 12 (falsch).',
      hints: [
         'Prüft Prozentrechnung und Division getrennt.',
         'Nur die falschen Zeilen zählen, nicht die richtigen.',
         'Falsch sind Zeile 2 und 6. Zusammengelesen: 26.',
      ],
      solution: 26,
   },
   {
      n: 2,
      title: 'Das geschredderte Dokument',
      kind: 'rekonstruktion',
      prompt:
         'Miss Anti-lomene hat ein Dokument in Teile zerlegt. Setzt alle Fragmente so zusammen, dass Text, Linien und Grafiken wieder durchgängig sind. Erst das vollständige Dokument verrät euch, wie ihr die Lösungszahl berechnet.',
      note: 'Hinweis: Zählt alle Buchstaben. Die Summe ist eure Zahl.',
      hints: [
         'Achtet nicht auf Leerzeichen oder Satzzeichen.',
         'Erst zusammensetzen, dann nur Buchstaben zählen.',
         'Die rekonstruierte Akte führt auf 21.',
      ],
      solution: 21,
   },
   {
      n: 3,
      title: 'Die Funkstörung',
      kind: 'signal',
      prompt: 'Die Nachricht wurde mehrfach von kurzen Funkstörungen unterbrochen. Welche Zahl versteckt Miss Anti-lomene?',
      hints: [
         'Die Störung ist nicht zufällig, betrachtet helle und dunkle Blöcke.',
         'Sucht eine Zahl, die optisch im Signal steckt.',
         'Die versteckte Zahl ist 19.',
      ],
      solution: 19,
   },
   {
      n: 4,
      title: 'Das Original',
      kind: 'muster',
      prompt:
         'Nur eine der sechs Karten zeigt das Referenzmuster exakt um 180° gedreht. Spiegeln zählt nicht. Die Nummer der richtigen Karte ist eure Lösungszahl.',
      reference: ['▲ ○ ■', '◆ + ×', '○ ■ ▲'],
      hints: [
         'Drehen ist erlaubt, Spiegeln nicht.',
         'Vergleicht zuerst die Ecken nach einer 180-Grad-Drehung.',
         'Karte 1 ist die gesuchte Karte.',
      ],
      solution: 1,
   },
   {
      n: 5,
      title: 'Die chaotische Reihenfolge',
      kind: 'reihenfolge',
      prompt:
         'Sieben Ereignisse sind aus Miss Anti-lomene’ Protokoll gefallen. Bringt die Karten mit Hilfe aller Hinweise in eine eindeutige Reihenfolge. Die Zahl auf der letzten Karte ist eure Lösungszahl.',
      events: [
         { label: 'SERVER STARTET', num: 4 },
         { label: 'LICHT FLACKERT', num: 7 },
         { label: 'KAFFEE KIPPT', num: 9 },
         { label: 'WLAN VERSCHWINDET', num: 6 },
         { label: 'DRUCKER DRUCKT', num: 8 },
         { label: 'ALARM SPRINGT AN', num: 2 },
         { label: 'TRESOR VERRIEGELT', num: 13 },
      ],
      hints: [
         'Der Server startet zuerst.',
         'Das Licht flackert vor dem Kaffee.',
         'Zwischen Serverstart und Kaffee liegt genau ein Ereignis.',
         'Das WLAN verschwindet direkt nachdem Kaffee.',
         'Der Alarm passiert nach dem WLAN.',
         'Der Drucker passiert direkt vor dem Tresor.',
         'Zwischen Licht und Drucker liegen genau drei Ereignisse.',
      ],
      hintLevels: [
         'Setzt SERVER STARTET fest auf Platz 1.',
         'LICHT muss auf Platz 2 liegen, damit zwischen Licht und Drucker drei Ereignisse passen.',
         'Die letzte Karte ist TRESOR VERRIEGELT mit Zahl 13.',
      ],
      solution: 13,
   },
   {
      n: 6,
      title: 'Die zerstörte Brücke',
      kind: 'upload',
      prompt:
         'Verbindet Ufer A und Ufer B mit einer frei stehenden Papierbrücke. Sie muss alle Bedingungen erfüllen. Danach fotografiert ihr das Ergebnis und ladet das Bild hoch.',
      checklist: [
         'Benutzt nur das Material in dem Umschlag.',
         'Die Konstruktion darf nur auf den Feldern stehen.',
         'Lade das Bild anschließend hoch.',
      ],
      hints: [
         'Die Brücke muss frei stehen, nicht gehalten werden.',
         'Fotografiert so, dass beide Ufer und Standflächen sichtbar sind.',
         'Nach Upload kann die Spielleitung die Station freigeben.',
      ],
      solution: 13,
   },
   {
      n: 7,
      title: 'Familienangelegenheiten',
      kind: 'upload',
      prompt:
         'Miss Anti-lomene hat kein Familienfoto mehr. Genau genommen hat sie auch keine Familie. Das sollt ihr jetzt lösen. Inszeniert ein neues Familienfoto.',
      checklist: [
         'mindestens 8 Personen',
         'eine übertrieben stolze Elternfigur',
         'ein rebellisches „Kind“',
         'ein Haustier aus einem Gegenstand',
         'einen klaren freien Platz für Miss Anti-lomene',
      ],
      hints: [
         'Übertreibung hilft: Rollen müssen auf dem Foto eindeutig erkennbar sein.',
         'Miss Anti-lomene braucht sichtbar einen leeren Platz.',
         'Nach Upload kann die Spielleitung die Station freigeben.',
      ],
      solution: 5,
   },
   {
      n: 8,
      title: 'Spieglein, Spieglein',
      kind: 'spiegel',
      prompt:
         'Die Nachricht ist vollständig vorhanden, aber in Miss Anti-lomene’ bevorzugter Leserichtung. Entschlüsselt sie. Danach müsst ihr ihre Anweisung auf die Wortreihe anwenden.',
      cipher: [
         'treitirr gill v etueh thciellei negeil lebaK',
         'tenhce rebuas hcilkri lamni dnamein dnerh',
         'hcafni tniehcsre treizil mok hcilmei sella lho bo',
         'lamro sella tbielb tr hniH nam nne',
      ],
      hint: 'Hilfsmittel aus eurem Alltag sind erlaubt (ein Spiegel reicht).',
      hints: [
         'Lest die Zeilen rückwärts.',
         'Ein digitaler Spiegel im Terminal reicht, aber die Wortreihenfolge bleibt wichtig.',
         'Die gesuchte Lösungszahl ist 14.',
      ],
      solution: 14,
   },
   {
      n: 9,
      title: 'Die Gedächtnislücke',
      kind: 'gedaechtnis',
      prompt:
         'Für zehn Sekunden seht ihr einen Schreibtisch mit mehreren Gegenständen. Anschließend müsst ihr einige Fragen beantworten.',
      hints: [
         'Nicht nur Gegenstände merken, auch ihre Anzahl.',
         'Startet den Timer erst, wenn alle bereit sind.',
         'Die Antworten führen zusammen auf 19.',
      ],
      solution: 19,
   },
   {
      n: 10,
      title: 'Genau drei Wahrheiten',
      kind: 'kandidaten',
      prompt:
         'Miss Anti-lomene hat fünf mögliche Codes notiert. Für den richtigen Code sind genau drei der vier Aussagen wahr. Prüft alle Kandidaten. Der passende Kandidat ist eure Lösungszahl.',
      candidates: [8, 9, 15, 21, 25],
      statements: [
         'A: Die Zahl ist ungerade.',
         'B: Die Zahl ist eine Quadratzahl.',
         'C: Die Zahl hat genau drei positive Teiler.',
         'D: Die Zahl ist größer als 20.',
      ],
      hints: [
         'Prüft jeden Kandidaten gegen alle vier Aussagen.',
         'Gesucht ist nicht die Zahl mit allen wahren Aussagen.',
         'Bei 9 sind genau drei Aussagen wahr.',
      ],
      solution: 9,
   },
   {
      n: 11,
      title: 'Welche Skizze?',
      kind: 'team',
      prompt:
         'Eine Person aus eurem Team darf die geheime Skizze im Umschlag ansehen. Alle anderen sehen vier mögliche Skizzen. Stellt der Person Fragen, die nur mit Ja oder Nein beantwortet werden dürfen, und findet gemeinsam heraus, welche der vier Skizzen mit der geheimen Vorlage übereinstimmt. Wichtig: Die geheime Skizze darf nicht gezeigt oder beschrieben werden.',
      hints: [
         'Fragt zuerst nach groben Formen, dann nach Positionen.',
         'Ja/Nein-Fragen wie "Ist oben links ein Kreis?" sind erlaubt.',
         'Die passende Skizze führt auf 14.',
      ],
      solution: 14,
   },
   {
      n: 12,
      title: 'Der chaotische Terminkalender',
      kind: 'kalender',
      prompt:
         'Miss Anti-lomene hat fünf Termine aus dem Kalender gerissen. Ordnet jede Akte genau einer Uhrzeit zu. Welcher Termin liegt um 13:00 Uhr? Die Aktennummer dieses Termins ist eure Lösungszahl.',
      acts: [
         { i: 1, label: 'Sicherheitscheck' },
         { i: 2, label: 'Budgetreview' },
         { i: 3, label: 'Kaffeepause' },
         { i: 4, label: 'Strategiegespräch' },
         { i: 5, label: 'Teammeeting' },
      ],
      hints: [
         'Das Teammeeting findet direkt nach dem Budgetreview statt.',
         'Zwischen Teammeeting und Strategiegespräch liegt genau ein Termin.',
         'Die Kaffeepause findet später als das Strategiegespräch statt.',
         'Der Sicherheitscheck liegt nach dem Teammeeting, aber vor dem Strategiegespräch.',
      ],
      slots: ['09:00', '10:00', '11:00', '13:00', '14:00'],
      hintLevels: [
         'Budgetreview und Teammeeting sind ein direkter Block.',
         'Sicherheitscheck liegt zwischen Teammeeting und Strategiegespräch.',
         'Um 13:00 liegt Akte 4.',
      ],
      solution: 4,
   },
   {
      n: 13,
      title: 'Akte 404',
      kind: 'binär',
      prompt:
         'Die Datei ist angeblich verschwunden. Das Backup ist noch da, aber Miss Anti-lomene speichert Codes lieber binär. Öffnet die Fehlerseite und übersetzt den fünfstelligen Binärcode in eine Dezimalzahl.',
      weights: [16, 8, 4, 2, 1],
      hints: [
         'Jede aktive Stelle addiert ihr Gewicht.',
         'Der Code ist fünfstellig mit Gewichten 16, 8, 4, 2, 1.',
         'Die Summe ergibt 23.',
      ],
      solution: 23,
   },
   {
      n: 14,
      title: 'Das Fehlerbild',
      kind: 'prüfung',
      prompt:
         'Miss Anti-lomene behauptet, dieses Kontrollpanel sei vollkommen korrekt. Das wäre ein Novum. Prüft alle zwölf Felder und markiert jedes Detail, das logisch oder mathematisch nicht stimmen kann. Die Anzahl der fehlerhaften Felder ist eure Lösungszahl.',
      note: 'Tipp: Nicht alles, was seltsam aussieht, ist automatisch falsch.',
      hints: [
         'Markiert nur logisch oder mathematisch unmögliche Felder.',
         'Zählt die fehlerhaften Felder, nicht deren Werte.',
         'Es sind 9 Fehler.',
      ],
      solution: 9,
   },
   {
      n: 15,
      title: 'Die Buchhaltung von Miss Anti-lomene',
      kind: 'buchhaltung',
      prompt:
         'Die Einkaufsliste wurde in der falschen Reihenfolge exportiert. Miss Anti-lomene’ Buchhaltung ordnet ausschließlich vom kleinsten zum größten Betrag. Danach „zählt immer der Anfangsbuchstabe“. Welche Zahl ergibt sich?',
      items: [
         { name: 'Headset', amount: '23,40 €' },
         { name: 'Aktenordner', amount: '7,40 €' },
         { name: 'Etiketten', amount: '19,95 €' },
         { name: 'Tacker', amount: '14,10 €' },
         { name: 'Notizbuch', amount: '28,70 €' },
         { name: 'Haftnotizen', amount: '12,80 €' },
         { name: 'Zollstock', amount: '17,60 €' },
         { name: 'Collegeblock', amount: '9,15 €' },
      ],
      hints: [
         'Sortiert zuerst nach Betrag aufsteigend.',
         'Danach zählen die Anfangsbuchstaben der sortierten Gegenstände.',
         'Die sortierte Buchstabenfolge führt auf 18.',
      ],
      solution: 18,
   },
   {
      n: 16,
      title: 'Der gefaltete Code',
      kind: 'falten',
      prompt: 'Miss Anti-lomene hat den Code auf eine überraschend analoge Weise gesichert. Durch das richtige Falten solltet ihr eine Zahl erkennen.',
      hints: [
         'Die Faltkante ist Teil des Codes.',
         'Legt Kanten exakt aufeinander, nicht ungefähr.',
         'Nach dem Falten erkennt ihr 19.',
      ],
      solution: 19,
   },
   {
      n: 17,
      title: 'Die Lochmasken',
      kind: 'maske',
      prompt:
         'Zwischen diesen Buchstaben steckt eure Zahl. Miss Anti-lomene hat vier mögliche Entschlüsselungsmasken hinterlassen. Legt die Masken nacheinander exakt auf das Buchstabenfeld. Nur eine Maske ergibt eine sinnvolle Botschaft. Lest die sichtbaren Buchstaben von oben nach unten.',
      grid: [
         'M Z P Q L R V',
         'C H N T E W B',
         'F U A J K S D',
         'Y O L X N G P',
         'Z B R M T C H',
         'E K P V Q D I',
         'S N F G U A W',
      ],
      hints: [
         'Testet die Masken systematisch und dreht sie nicht frei.',
         'Nur eine Maske ergibt eine lesbare Botschaft von oben nach unten.',
         'Die sichtbaren Buchstaben ergeben die Zahl 20.',
      ],
      solution: 20,
   },
   {
      n: 18,
      title: 'Der Zahlensalat',
      kind: 'gleichung',
      prompt:
         'Jedes Symbol steht immer für dieselbe positive ganze Zahl. Löst das kleine Gleichungssystem und berechnet am Ende □ − △. Das Ergebnis ist eure Lösungszahl.',
      equations: ['△ + △ + □ = 13', '□ + ○ = 12', '○ − △ = 3', 'GESUCHT: □ − △ = ?'],
      hints: [
         'Drückt ○ über △ aus.',
         'Setzt □ und ○ in die zweite Gleichung ein.',
         '□ − △ ergibt 1.',
      ],
      solution: 1,
   },
   {
      n: 19,
      title: 'Der Konsonantenfilter',
      kind: 'maske',
      prompt:
         'Miss Anti-lomene hält Vokale für „administrativen Ballast“. Streicht in der Matrix alle A, E, I, O und U vollständig durch. Betrachtet anschließend nur die übrig gebliebenen Buchstaben aus etwas Abstand.',
      grid: [
         'A E K I O U A N F S E',
         'I R T O U A M E I O L',
         'U A K E I O N U A E F',
         'I O S U A E I R T M O',
         'U A L E I O K U A E N',
         'I O F U A E S I O U R',
         'A T M L E I O K N F U',
      ],
      hint: 'Tipp: Nach dem Streichen zwei Schritte zurückgehen.',
      hints: [
         'Streicht A, E, I, O und U wirklich überall.',
         'Betrachtet nur die Konsonanten, nicht die leeren Stellen.',
         'Die übrig gebliebene Botschaft führt auf 18.',
      ],
      solution: 18,
   },
   {
      n: 20,
      title: 'Das letzte Geständnis',
      kind: 'finale',
      prompt:
         'Miss Anti-lomene sagt genau drei Sätze. Zählt die Wörter in jedem Satz separat. Wandelt jede Wortanzahl mit A=1, B=2, C=3 usw. in einen Buchstaben um. Welches Zahlwort entsteht?',
      hints: [
         'Zählt jeden der drei Sätze separat.',
         'Wandelt die drei Wortzahlen in Buchstaben um.',
         'Das Zahlwort ist ELF, also 11.',
      ],
      solution: 11,
   },
]

// Lösungsschlüssel Seite 22: n -> Zahl -> Buchstabe
export const SOLUTIONS: SolutionEntry[] = STATIONS.map((s) => ({
   n: s.n,
   solution: s.solution,
   letter: N2L(s.solution),
}))

export const FINAL_PASSWORD = 'ZUSAMMENSINDWIRSTARK'

/** Entschärfte Projektion für den Client — enthält garantiert keine Lösung. */
export const PUBLIC_STATIONS: PublicStation[] = STATIONS.map((s) => {
   const { solution: _omit, ...rest } = s
   void _omit
   return rest
})

export function publicStationFor(n: number): PublicStation | undefined {
   return PUBLIC_STATIONS.find((s) => s.n === n)
}
