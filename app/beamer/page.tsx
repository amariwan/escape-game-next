import type { Metadata } from 'next'
import BeamerDashboard from '../../components/BeamerDashboard'

export const metadata: Metadata = { title: 'Beamer-Wand · Miss Anti-lomene' }

export default function BeamerPage() {
   return <BeamerDashboard />
}
