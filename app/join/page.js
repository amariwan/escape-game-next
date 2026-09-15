import { Suspense } from 'react'
import AutoJoin from '../../components/AutoJoin.jsx'

export default function JoinPage() {
   return (
      <Suspense fallback={null}>
         <AutoJoin />
      </Suspense>
   )
}
