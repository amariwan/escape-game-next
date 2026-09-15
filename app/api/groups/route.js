import { createGroup, listGroups } from '../../../lib/group-store.js'

export async function GET() {
   const groups = await listGroups()
   return Response.json({ groups })
}

export async function POST(request) {
   const body = await request.json().catch(() => ({}))
   const group = await createGroup(body.name ?? '')
   return Response.json(group)
}
