import AdminClient from '../../../components/AdminClient'

export default async function AdminPage({ params }: { params: Promise<{ code: string }> }) {
   const { code } = await params
   return <AdminClient groupCode={code.toUpperCase()} />
}
