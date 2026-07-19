import Link from 'next/link';
import { Md } from '@/components/ui/Markdown';

interface LegalDocumentPageProps {
  title: string;
  content: string;
}

export function LegalDocumentPage({ title, content }: LegalDocumentPageProps) {
  return (
    <main className="min-h-screen bg-bg-light px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-4xl rounded-2xl bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        <div className="mb-8 border-b border-slate-100 pb-5">
          <Link href="/auth/login" className="text-xs font-medium text-text-accent hover:underline">
            SIR 로그인으로 돌아가기
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-text-dark sm:text-3xl">{title}</h1>
        </div>
        <div className="legal-document">
          <Md className="text-slate-700">{content}</Md>
        </div>
      </article>
    </main>
  );
}
