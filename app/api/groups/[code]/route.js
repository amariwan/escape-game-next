import {
   getOrCreateGroup,
   resetGroup,
   solveStation,
   updateGroup,
} from '../../../../lib/group-store.js'

function fail(error) {
   console.error('[api/groups/[code]]', error?.message ?? error)
   return Response.json({ error: 'Gruppe konnte nicht geladen werden' }, { status: 500 })
}

export async function GET(request, { params }) {
   try {
      const { code } = await params
      const group = await getOrCreateGroup(code)
      return Response.json(group)
   } catch (error) {
      return fail(error)
   }
}

export async function POST(request, { params }) {
   try {
      const { code } = await params
      const body = await request.json().catch(() => ({}))

      if (body.action === 'reset') {
         const group = await resetGroup(code)
         return Response.json(group)
      }

      if (body.action === 'solve') {
         const result = await solveStation(code, body.station, body.value)
         return Response.json({ ...result.group, valid: result.valid })
      }

      if (
         [
            'settings',
            'rename',
            'timer',
            'unlock',
            'lock',
            'hint',
            'upload',
            'approve-upload',
            'reveal-finale',
         ].includes(body.action)
      ) {
         const group = await updateGroup(code, body.action, body)
         return Response.json(group)
      }

      const group = await getOrCreateGroup(code)
      return Response.json(group)
   } catch (error) {
      return fail(error)
   }
}
