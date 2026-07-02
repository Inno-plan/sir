import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LeadingSirLabClient } from './LeadingSirLabClient';

export default async function LeadingSirPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (user.role !== 'super_admin' && user.role !== 'admin') redirect('/workspace');

  let assignedWorkspaceIds: string[] | null = null;
  if (user.role === 'admin') {
    const supabase = await createClient();
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('profile_id', user.id);
    assignedWorkspaceIds = (data ?? []).map((row) => row.workspace_id);
  }

  return <LeadingSirLabClient assignedWorkspaceIds={assignedWorkspaceIds} />;
}
