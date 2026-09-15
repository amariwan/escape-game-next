import { createGroup, listGroups } from '../../../lib/group-store.js'

function fail(error) {
   console.error('[api/groups]', error?.message ?? error)
   return Response.json({ error: 'Gruppen konnten nicht geladen werden' }, { status: 500 })
}

export async function GET() {
   try {
      const groups = await listGroups()
      return Response.json({ groups })
   } catch (error) {
      return fail(error)
   }
}

export async function POST(request) {
   try {
      const body = await request.json().catch(() => ({}))
      const group = await createGroup(body.name ?? '')
      return Response.json(group)
   } catch (error) {
      return fail(error)
   }
}
