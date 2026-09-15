import { autoJoinGroup } from '../../../../lib/group-store.js'

export async function POST(request) {
   const body = await request.json().catch(() => ({}))
   const group = await autoJoinGroup(body.memberId, body.poolCode)

   return Response.json(group)
}
