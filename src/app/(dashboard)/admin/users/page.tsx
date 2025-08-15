import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserManagement } from '@/components/admin/user-management'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  // Only admins can access this page
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch all users
  const { data: users } = await supabase
    .from('profiles')
    .select('*, warehouses(name)')
    .order('created_at', { ascending: false })

  // Fetch all warehouses for the dropdown
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*')
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">User Management</h1>
      <UserManagement users={users || []} warehouses={warehouses || []} />
    </div>
  )
}