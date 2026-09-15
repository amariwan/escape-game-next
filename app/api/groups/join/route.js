import { autoJoinGroup } from '../../../../lib/group-store.js'

export async function POST(request) {
   try {
      const body = await request.json().catch(() => ({}))
      const group = await autoJoinGroup(body.memberId, body.poolCode)

      return Response.json(group)
   } catch (error) {
      console.error('[api/groups/join]', error?.message ?? error)
      return Response.json({ error: 'Beitreten fehlgeschlagen' }, { status: 500 })
   }
}
