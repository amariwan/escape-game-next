import { Suspense } from 'react'
import AutoJoin from '../../components/AutoJoin'

export default function JoinPage() {
   return (
      <Suspense fallback={null}>
         <AutoJoin />
      </Suspense>
   )
}
