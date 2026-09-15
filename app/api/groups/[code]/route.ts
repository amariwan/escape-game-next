import type { NextRequest } from 'next/server'
import { getGroup, resetGroup, solveStation, updateGroup } from '../../../../lib/group-store'
import { HttpError } from '../../../../lib/types'

function fail(error: unknown): Response {
   if (error instanceof HttpError) {
      return Response.json({ error: error.message }, { status: error.status })
   }
   console.error('[api/groups/[code]]', error instanceof Error ? error.message : error)
   return Response.json({ error: 'Gruppe konnte nicht geladen werden' }, { status: 500 })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
   try {
      const { code } = await params
      const group = await getGroup(code)
      if (!group) return Response.json({ error: 'Gruppe nicht gefunden' }, { status: 404 })
      return Response.json(group)
   } catch (error) {
      return fail(error)
   }
}

interface ActionBody {
   action?: string
   station?: unknown
   value?: unknown
   [key: string]: unknown
}

const UPDATE_ACTIONS = new Set([
   'settings',
   'rename',
   'timer',
   'unlock',
   'lock',
   'hint',
   'upload',
   'approve-upload',
   'reveal-finale',
   'navigate',
])

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
   try {
      const { code } = await params
      const body = (await request.json().catch(() => ({}))) as ActionBody

      if (body.action === 'reset') {
         const group = await resetGroup(code, body.adminToken)
         return Response.json(group)
      }

      if (body.action === 'solve') {
         const result = await solveStation(code, body.station, body.value)
         return Response.json({ ...result.group, valid: result.valid })
      }

      if (body.action && UPDATE_ACTIONS.has(body.action)) {
         const group = await updateGroup(code, body.action, body)
         return Response.json(group)
      }

      const group = await getGroup(code)
      if (!group) return Response.json({ error: 'Gruppe nicht gefunden' }, { status: 404 })
      return Response.json(group)
   } catch (error) {
      return fail(error)
   }
}
