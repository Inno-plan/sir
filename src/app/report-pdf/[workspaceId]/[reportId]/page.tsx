'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ReportHeader } from '@/components/report/ReportHeader';
import { Highlight } from '@/components/report/Highlight';
import { OnlineReputation } from '@/components/report/OnlineReputation';
// import { RiskContent } from '@/components/report/RiskContent';
import { Strategy } from '@/components/report/Strategy';
import { Loading } from '@/components/ui/Loading';
import { useReportInfoSuspense } from '@/hooks/report/useReportQuery';
import { createClient } from '@/lib/supabase/client';

type InjectedPdfSession = {
  accessToken?: string;
  refreshToken?: string;
};

declare global {
  interface Window {
    __SIR_PDF_SESSION__?: InjectedPdfSession;
    __SIR_PDF_SESSION_READY__?: Promise<void>;
  }
}

function consumeInjectedPdfSession() {
  const session = window.__SIR_PDF_SESSION__;
  delete window.__SIR_PDF_SESSION__;

  if (!session?.accessToken || !session.refreshToken) {
    return null;
  }

  return {
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  };
}

function getPdfSessionReadyPromise() {
  if (window.__SIR_PDF_SESSION_READY__) {
    return window.__SIR_PDF_SESSION_READY__;
  }

  const injectedSession = consumeInjectedPdfSession();
  if (!injectedSession) {
    return null;
  }

  const supabase = createClient();
  const readyPromise = supabase.auth.setSession(injectedSession)
    .then(() => undefined)
    .catch(() => undefined);

  window.__SIR_PDF_SESSION_READY__ = readyPromise;
  void readyPromise.finally(() => {
    delete window.__SIR_PDF_SESSION_READY__;
  });

  return readyPromise;
}

export default function ReportPdfPage() {
  // RLS 멤버십 격리 후 anon 으로는 데이터 0건. 백엔드 Playwright 가 init script 로
  // 호출자 세션을 주입하면 setSession 으로 사용자 신원 전환 → 본인 워크스페이스 RLS 통과.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const pdfSessionReady = getPdfSessionReadyPromise();

    const markReady = () => {
      if (mounted) {
        setReady(true);
      }
    };

    if (!pdfSessionReady) {
      markReady();
      return () => {
        mounted = false;
      };
    }

    pdfSessionReady.then(markReady);

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <ReportPdfContent />
    </Suspense>
  );
}

function PdfReadyMarker() {
  // Playwright headless 가 PDF 캡처 시점을 알 수 있도록 모든 Suspense 쿼리 해소 후 마커 부착.
  // useSuspenseQuery 가 throw 하면 후속 sibling 도 렌더 안 되므로 이 컴포넌트가 렌더되면 위 섹션들 데이터 모두 도착.
  useEffect(() => {
    delete document.documentElement.dataset.pdfError;
    document.documentElement.dataset.pdfReady = 'true';
  }, []);
  return null;
}

function PdfContractError() {
  useEffect(() => {
    delete document.documentElement.dataset.pdfReady;
    document.documentElement.dataset.pdfError = 'report-workspace-mismatch';
  }, []);

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-base font-semibold text-slate-900">보고서를 찾을 수 없습니다.</p>
        <p className="mt-2 text-sm text-slate-500">
          요청한 워크스페이스와 보고서 조합이 올바르지 않아 PDF 렌더링을 중단했습니다.
        </p>
      </div>
    </div>
  );
}

function ReportPdfContent() {
  const params = useParams();
  const workspaceId = params?.workspaceId as string;
  const reportId = params?.reportId as string;
  const { data: report } = useReportInfoSuspense(workspaceId, reportId);
  const isDaily = report?.type === 'daily';

  if (!report) return <PdfContractError />;

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <ReportHeader workspaceId={workspaceId} reportId={reportId} showPdfButton={false} />
        <Highlight workspaceId={workspaceId} reportId={reportId} pdfMode />
        <OnlineReputation workspaceId={workspaceId} reportId={reportId} pdfMode />
        {/* 리스크 콘텐츠 관리 섹션 임시 비노출.
        <RiskContent workspaceId={workspaceId} reportId={reportId} pdfMode />
        */}
        {!isDaily && <Strategy workspaceId={workspaceId} reportId={reportId} pdfMode />}
        <PdfReadyMarker />
      </div>
    </div>
  );
}
