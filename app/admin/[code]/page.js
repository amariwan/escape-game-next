import AdminClient from '../../../components/AdminClient.jsx'

export default async function AdminPage({ params }) {
   const { code } = await params
   return <AdminClient groupCode={code.toUpperCase()} />
}
