'use client';

import { useSearchParams } from 'next/navigation';
import { saveAs } from 'file-saver';
import { Packer } from 'docx';
import { MOCK_CRAWL_RESULTS } from '@/constants/crawlResults';
import { MOCK_ANALYSIS_RESULTS } from '@/constants/analysisResults';
import { MOCK_CONTENT_STRATEGIES } from '@/constants/contentStrategies';
import { PLATFORM_CATEGORIES } from '@/constants/platforms';
import { generateReportDocx } from '@/utils/reportDocx';

// TODO: AI API 연동 — 리포트 미리보기 본문도 AI가 생성하도록

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-xl px-4 py-3 flex-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  );
}

export function ReportResult() {
  const searchParams = useSearchParams();
  const company = searchParams?.get('company') ?? 'Company';
  const startDate = searchParams?.get('startDate') ?? '';
  const endDate = searchParams?.get('endDate') ?? '';
  const dateRange = `${startDate} ~ ${endDate}`;

  const totalArticles = MOCK_CRAWL_RESULTS.reduce((sum, p) => sum + p.articles.length, 0);
  const totalScore = Math.round(
    MOCK_ANALYSIS_RESULTS.reduce((sum, p) => sum + p.sirScore, 0) / MOCK_ANALYSIS_RESULTS.length
  );
  const totalFlagged = MOCK_ANALYSIS_RESULTS.reduce((sum, p) => sum + p.flagged.length, 0);
  const overallPositive = Math.round(
    MOCK_ANALYSIS_RESULTS.reduce((s, p) => s + p.positive, 0) / MOCK_ANALYSIS_RESULTS.length
  );
  const responseCount = MOCK_CONTENT_STRATEGIES.filter((s) => !s.reportable).length;
  const reportableCount = MOCK_CONTENT_STRATEGIES.filter((s) => s.reportable).length;

  const handleDownloadDocx = async () => {
    const doc = generateReportDocx(company, dateRange);
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `SIR_Report_${company}_${startDate}.docx`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="수집 자료" value={`${totalArticles}건`} color="text-blue-600" />
        <StatCard label="SIR 지수" value={String(totalScore)} color={totalScore >= 70 ? 'text-green-600' : totalScore >= 50 ? 'text-yellow-600' : 'text-red-600'} />
        <StatCard label="주의 컨텐츠" value={`${totalFlagged}건`} color="text-red-600" />
        <StatCard label="긍정 비율" value={`${overallPositive}%`} color="text-green-600" />
      </div>

      {/* Report preview */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">리포트 미리보기</span>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4 text-sm">
          {/* Section 1 */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-slate-800">1. 크롤링 요약</h4>
            <p className="text-slate-600">
              총 <span className="font-semibold text-blue-600">{totalArticles}건</span>의 자료를
              {' '}{PLATFORM_CATEGORIES.length}개 카테고리에서 수집했습니다.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORM_CATEGORIES.map((category) => {
                const items = MOCK_CRAWL_RESULTS.filter((p) => p.category === category);
                const count = items.reduce((sum, p) => sum + p.articles.length, 0);
                if (count === 0) return null;
                return (
                  <div key={category} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-slate-600">{category}</span>
                    <span className="text-xs font-bold text-slate-800">{count}건</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2 */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-slate-800">2. 감정 분석</h4>
            <p className="text-slate-600">
              종합 SIR 지수는{' '}
              <span className={`font-bold ${totalScore >= 70 ? 'text-green-600' : totalScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {totalScore}점
              </span>
              이며, 주의가 필요한 컨텐츠가{' '}
              <span className="font-semibold text-red-600">{totalFlagged}건</span> 발견되었습니다.
            </p>
            <div className="flex flex-col gap-1">
              {MOCK_ANALYSIS_RESULTS.filter((p) => p.flagged.length > 0).map((p) => (
                <div key={p.platformId} className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{p.category}</span>
                  <span className="font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{p.platformLabel}</span>
                  <span className="text-red-500 font-medium">주의 {p.flagged.length}건</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-slate-800">3. 대응 전략</h4>
            <p className="text-slate-600">
              대응 전략 <span className="font-semibold text-amber-600">{responseCount}건</span>,
              신고 대상 <span className="font-semibold text-red-600">{reportableCount}건</span>이
              포함되었습니다.
            </p>
          </div>

          <p className="text-xs text-slate-400 italic">
            * 전체 상세 내용은 DOCX 파일을 다운로드하여 확인하세요.
          </p>
        </div>
      </div>

      {/* Download button */}
      <div className="flex items-center">
        <button
          onClick={handleDownloadDocx}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <path d="M8 2v8M8 10l-3-3M8 10l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          DOCX 다운로드
        </button>
      </div>
    </div>
  );
}
