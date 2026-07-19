import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { getLegalContent } from '@/lib/legal/content';

export const metadata: Metadata = { title: '이용약관 | SIR' };

export default async function TermsPage() {
  return <LegalDocumentPage title="이용약관" content={await getLegalContent('terms')} />;
}
