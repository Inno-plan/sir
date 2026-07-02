import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RiskTable } from '@/components/report/risk-content/RiskTable';
import type { RiskItem } from '@/lib/api/reportApi';

vi.mock('@/hooks/report/useReportMutation', () => ({
  useClearCriticalType: () => ({
    isPending: false,
    mutate: vi.fn(),
    variables: null,
  }),
}));

vi.mock('@/components/report/risk-content/RiskReportRequestModal', () => ({
  RiskReportRequestModal: () => null,
}));

function createRiskItem(index: number): RiskItem {
  return {
    id: `risk-${index}`,
    platform_id: index % 2 === 0 ? 'naver_blog' : 'youtube',
    title: `리스크 콘텐츠 ${index}`,
    link: `https://example.com/risk-${index}`,
    critical_type: 'defamation',
    critical_reason: `리스크 사유 ${index}`,
    published_at: '2026-07-02T00:00:00.000Z',
    session_id: `session-${index}`,
  };
}

function renderRiskTable(riskItems: RiskItem[], pdfMode = false) {
  return renderToStaticMarkup(
    <RiskTable
      riskItems={riskItems}
      workspaceId="workspace-id"
      reportId="report-id"
      reportedSourceIds={new Set()}
      riskReportBySourceId={new Map()}
      onCancelReport={vi.fn()}
      pdfMode={pdfMode}
    />,
  );
}

describe('RiskTable render', () => {
  it('renders an empty state when no risk item exists', () => {
    const html = renderRiskTable([]);

    expect(html).toContain('탐지된 리스크 콘텐츠가 없습니다.');
    expect(html).toContain('총 0건');
  });

  it('shows a pdf row-limit summary when more than ten filtered rows exist', () => {
    const riskItems = Array.from({ length: 12 }, (_, index) => createRiskItem(index + 1));

    const html = renderRiskTable(riskItems, true);

    expect(html).toContain('총 12건 중 상위 10건 표시');
  });
});
