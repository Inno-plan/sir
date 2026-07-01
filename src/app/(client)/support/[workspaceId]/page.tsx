import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SupportUserInquiries } from '@/components/support/SupportUserInquiries';

export default async function UserSupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (user.role !== 'user') redirect('/support');

  const [{ workspaceId }, sp] = await Promise.all([params, searchParams]);

  return (
    <div className="min-h-full bg-bg-light">
      <SupportUserInquiries defaultCategory={sp.type} workspaceId={workspaceId} />
    </div>
  );
}
