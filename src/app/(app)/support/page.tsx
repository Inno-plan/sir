import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SupportAdminInbox } from '@/components/support/SupportAdminInbox';

export default async function AdminSupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (user.role === 'user') redirect('/');

  let assignedIds: string[] | null = null;
  if (user.role === 'admin') {
    const supabase = await createClient();
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('profile_id', user.id);
    assignedIds = (data ?? []).map((row) => row.workspace_id);
  }

  return <SupportAdminInbox assignedIds={assignedIds} />;
}
