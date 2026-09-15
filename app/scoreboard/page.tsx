import type { Metadata } from 'next'
import Scoreboard from '../../components/Scoreboard'

export const metadata: Metadata = { title: 'Scoreboard · Miss Anti-lomene' }

export default function ScoreboardPage() {
   return <Scoreboard />
}
