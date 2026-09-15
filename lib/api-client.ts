// Einheitliche Client-Fetch-Helfer — Server-Fehlermeldungen ({ error }) kommen
// beim Nutzer an statt generischer Texte.
export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
   try {
      const data = (await response.json()) as { error?: unknown }
      return typeof data.error === 'string' ? data.error : fallback
   } catch {
      return fallback
   }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
   const response = await fetch(url, init)
   if (!response.ok) {
      throw new Error(await readErrorMessage(response, `Anfrage fehlgeschlagen (${response.status})`))
   }
   return (await response.json()) as T
}

export function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
   return fetchJson<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
   })
}
