import type { NextRequest } from 'next/server'
import { autoJoinGroup, joinGroupByCode } from '../../../../lib/group-store'
import { HttpError } from '../../../../lib/types'

export async function POST(request: NextRequest): Promise<Response> {
   try {
      const body = (await request.json().catch(() => ({}))) as {
         memberId?: unknown
         poolCode?: unknown
         code?: unknown
      }
      // Expliziter Code-Beitritt (Direkt-Link) oder Pool-Auto-Join (QR).
      const group = body.code
         ? await joinGroupByCode(body.code, body.memberId)
         : await autoJoinGroup(body.memberId, body.poolCode)

      return Response.json(group)
   } catch (error) {
      if (error instanceof HttpError) {
         return Response.json({ error: error.message }, { status: error.status })
      }
      console.error('[api/groups/join]', error instanceof Error ? error.message : error)
      return Response.json({ error: 'Beitreten fehlgeschlagen' }, { status: 500 })
   }
}
