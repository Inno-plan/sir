import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { getLegalContent } from '@/lib/legal/content';

export const metadata: Metadata = { title: '개인정보처리방침 | SIR' };

export default async function PrivacyPage() {
  return <LegalDocumentPage title="개인정보처리방침" content={await getLegalContent('privacy')} />;
}
