import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SupportInquiryForm } from '@/components/support/SupportInquiryForm';

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
      <SupportInquiryForm
        defaultCategory={sp.type}
        workspaceId={workspaceId}
      />
    </div>
  );
}
