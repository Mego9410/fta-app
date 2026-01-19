import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';

export type AdminAccessStatus =
  | { status: 'not_configured' }
  | { status: 'not_signed_in' }
  | { status: 'not_admin'; userId: string; email: string }
  | { status: 'admin'; userId: string; email: string };

export async function getAdminAccess(): Promise<AdminAccessStatus> {
  if (!isSupabaseConfigured) return { status: 'not_configured' };

  const supabase = requireSupabase();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return { status: 'not_signed_in' };

  const userId = session.user.id;
  const email = session.user.email ?? '';

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;

  if (!profile?.is_admin) return { status: 'not_admin', userId, email };
  return { status: 'admin', userId, email };
}

