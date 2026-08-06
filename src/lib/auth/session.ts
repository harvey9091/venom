import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getCurrentSession() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function getWorkspaceMemberships() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('*, workspace:workspaces(*), user:users(*)')
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
