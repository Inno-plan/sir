import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AiUsageClient } from './AiUsageClient';

export default async function AiUsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (user.role !== 'super_admin') redirect('/workspace');
  return <AiUsageClient />;
}
