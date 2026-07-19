import { getCurrentUser } from '@/lib/auth';
import { ClientShell } from '@/components/client/layout/ClientShell';
import { ConsentGate } from '@/components/client/consent/ConsentGate';
import { needsConsent } from '@/lib/legal/consts';

// TODO: 미들웨어에서 role 체크 후 관리자/기업관계자 라우트 분기

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (user?.role === 'user' && needsConsent(user)) {
    return <ConsentGate />;
  }

  return <ClientShell user={user}>{children}</ClientShell>;
}
