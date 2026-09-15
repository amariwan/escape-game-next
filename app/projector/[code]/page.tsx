import ProjectorClient from '../../../components/ProjectorClient'

export default async function ProjectorPage({ params }: { params: Promise<{ code: string }> }) {
   const { code } = await params
   return <ProjectorClient groupCode={code.toUpperCase()} />
}
