import GameClient from '../../../components/GameClient.jsx'

export default async function PlayPage({ params }) {
   const { code } = await params
   return <GameClient groupCode={code.toUpperCase()} />
}
