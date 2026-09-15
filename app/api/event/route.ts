import type { NextRequest } from 'next/server'
import { getEventSettings, setEventMode } from '../../../lib/group-store'
import { HttpError } from '../../../lib/types'

function fail(error: unknown): Response {
   if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status })
   }
   console.error('[api/event]', error instanceof Error ? error.message : error)
   return Response.json({ error: 'Event-Modus konnte nicht geladen werden' }, { status: 500 })
}

export async function GET(): Promise<Response> {
   try {
      return Response.json(await getEventSettings())
   } catch (error) {
      return fail(error)
   }
}

export async function POST(request: NextRequest): Promise<Response> {
   try {
      const body = (await request.json().catch(() => ({}))) as {
         mode?: unknown
         soloCode?: unknown
         name?: unknown
         adminToken?: unknown
      }
      return Response.json(await setEventMode(body.mode, body.soloCode, body.adminToken, body.name))
   } catch (error) {
      return fail(error)
   }
}
