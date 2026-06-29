'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { LoadingOverlay } from '@/components/ui/Loading';

type PdfDownloadFailureReason = 'missing-api-url' | 'missing-session' | 'http-error';

class PdfDownloadError extends Error {
  reason: PdfDownloadFailureReason;
  status?: number;
  statusText?: string;
  responseBodyPreview?: string;

  constructor(
    reason: PdfDownloadFailureReason,
    message: string,
    details: Pick<PdfDownloadError, 'status' | 'statusText' | 'responseBodyPreview'> = {},
  ) {
    super(message);
    this.name = 'PdfDownloadError';
    this.reason = reason;
    this.status = details.status;
    this.statusText = details.statusText;
    this.responseBodyPreview = details.responseBodyPreview;
  }
}

function getPdfErrorToastMessage(error: unknown) {
  if (!(error instanceof PdfDownloadError)) {
    return 'PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (error.reason === 'missing-session') {
    return '로그인 세션이 만료되었습니다. 다시 로그인한 뒤 PDF를 다운로드해 주세요.';
  }

  if (error.status === 401 || error.status === 403) {
    return 'PDF 다운로드 권한을 확인할 수 없습니다. 다시 로그인 후 시도해 주세요.';
  }

  if (error.status === 404) {
    return '보고서 정보를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.';
  }

  return 'PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

async function readErrorBodyPreview(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/pdf')) return undefined;

  try {
    const body = await response.text();
    return body.replace(/\s+/g, ' ').trim().slice(0, 300) || undefined;
  } catch {
    return undefined;
  }
}

function logPdfDownloadFailure(
  error: unknown,
  context: {
    workspaceId: string;
    reportId: string;
  },
) {
  if (error instanceof PdfDownloadError) {
    console.error('PDF download failed', {
      ...context,
      reason: error.reason,
      status: error.status,
      statusText: error.statusText,
      responseBodyPreview: error.responseBodyPreview,
    });
    return;
  }

  console.error('PDF download failed', {
    ...context,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
}

function useReportMeta(workspaceId?: string, reportId?: string) {
  return useQuery({
    queryKey: ['pdf-meta', workspaceId, reportId],
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: ws }, { data: rp }] = await Promise.all([
        supabase.from('workspaces').select('company_name').eq('id', workspaceId!).maybeSingle(),
        supabase
          .from('reports')
          .select('period_start, period_end')
          .eq('id', reportId!)
          .maybeSingle(),
      ]);
      return {
        companyName: ws?.company_name as string | undefined,
        periodStart: rp?.period_start as string | undefined,
        periodEnd: rp?.period_end as string | undefined,
      };
    },
    enabled: !!workspaceId && !!reportId,
    staleTime: Infinity,
  });
}

interface PdfDownloadButtonProps {
  /** 'sidebar' (기본) — 사이드바 가로 버튼 / 'icon' — 모바일 헤더용 아이콘 버튼 */
  variant?: 'sidebar' | 'icon';
}

export function PdfDownloadButton({ variant = 'sidebar' }: PdfDownloadButtonProps = {}) {
  const [downloading, setDownloading] = useState(false);
  const downloadingRef = useRef(false);
  const params = useParams();
  const workspaceId = params?.workspaceId as string | undefined;
  const reportId = params?.reportId as string | undefined;
  const { data: meta } = useReportMeta(workspaceId, reportId);

  if (!workspaceId || !reportId) return null;

  const handleDownload = async () => {
    if (downloadingRef.current) return;

    downloadingRef.current = true;
    setDownloading(true);
    let downloadUrl: string | undefined;
    let downloadLink: HTMLAnchorElement | undefined;

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiBaseUrl) {
        throw new PdfDownloadError('missing-api-url', 'NEXT_PUBLIC_API_URL is not configured');
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !session?.refresh_token) {
        throw new PdfDownloadError('missing-session', 'Supabase session is missing required tokens');
      }
      const res = await fetch(`${apiBaseUrl}/api/report/${workspaceId}/${reportId}/pdf`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          // 백엔드 → Playwright 가 setSession 으로 사용자 신원 위임받기 위해 refresh_token 도 전달.
          'X-Supabase-Refresh-Token': session.refresh_token,
        },
      });
      if (!res.ok) {
        throw new PdfDownloadError('http-error', 'PDF API request failed', {
          status: res.status,
          statusText: res.statusText,
          responseBodyPreview: await readErrorBodyPreview(res),
        });
      }
      const blob = await res.blob();
      downloadUrl = URL.createObjectURL(blob);
      downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      const shortPeriod = (s?: string) => (s ?? '').replace(/^\d{2}/, '').replace(/-/g, '.');
      downloadLink.download = `${meta?.companyName ?? 'report'}(${shortPeriod(meta?.periodStart)}\u007E${shortPeriod(meta?.periodEnd)}).pdf`;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
    } catch (e) {
      logPdfDownloadFailure(e, { workspaceId, reportId });
      toast.error(getPdfErrorToastMessage(e));
    } finally {
      downloadLink?.remove();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadingRef.current = false;
      setDownloading(false);
    }
  };

  return (
    <>
      {downloading && typeof document !== 'undefined' &&
        createPortal(
          <LoadingOverlay title="보고서를 다운로드 하고 있어요" />,
          document.body,
        )}
      {variant === 'icon' ? (
        <button
          onClick={handleDownload}
          disabled={downloading}
          aria-busy={downloading}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="보고서 PDF 다운로드"
        >
          <Download size={18} />
        </button>
      ) : (
        <div className="px-3 w-full">
          <button
            onClick={handleDownload}
            disabled={downloading}
            aria-busy={downloading}
            className="w-full flex items-center gap-2.5 rounded-lg text-sm transition-colors cursor-pointer justify-center border border-bg-dark px-3 py-2.5 hover:bg-bg-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-text-dark font-semibold text-center">
              {downloading ? 'PDF 생성 중...' : '보고서 다운로드(PDF)'}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
