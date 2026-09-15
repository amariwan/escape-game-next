import ProjectorClient from '../../../components/ProjectorClient.jsx'

export default async function ProjectorPage({ params }) {
   const { code } = await params
   return <ProjectorClient groupCode={code.toUpperCase()} />
}
