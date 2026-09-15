import type { NextRequest } from 'next/server'
import { createGroup, listGroups } from '../../../lib/group-store'
import { HttpError } from '../../../lib/types'

function fail(error: unknown): Response {
   if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status })
   }
   console.error('[api/groups]', error instanceof Error ? error.message : error)
   return Response.json({ error: 'Gruppen konnten nicht geladen werden' }, { status: 500 })
}

export async function GET(): Promise<Response> {
   try {
      const groups = await listGroups()
      return Response.json({ groups })
   } catch (error) {
      return fail(error)
   }
}

export async function POST(request: NextRequest): Promise<Response> {
   try {
      const body = (await request.json().catch(() => ({}))) as { name?: unknown }
      const group = await createGroup(body.name ?? '')
      return Response.json(group)
   } catch (error) {
      return fail(error)
   }
}
