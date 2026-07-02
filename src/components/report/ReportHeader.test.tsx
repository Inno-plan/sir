import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportHeader } from '@/components/report/ReportHeader';

const hookState = vi.hoisted(() => ({
  workspace: {
    company_name: '테스트기업',
    ticker: 'TST',
  },
  report: {
    type: 'weekly',
    period_start: '2026-06-22',
    period_end: '2026-06-28',
  },
}));

vi.mock('@/hooks/workspace/useWorkspaceQuery', () => ({
  useWorkspaceSuspense: () => ({ data: hookState.workspace }),
}));

vi.mock('@/hooks/report/useReportQuery', () => ({
  useReportInfoSuspense: () => ({ data: hookState.report }),
}));

describe('ReportHeader render', () => {
  beforeEach(() => {
    hookState.workspace = {
      company_name: '테스트기업',
      ticker: 'TST',
    };
    hookState.report = {
      type: 'weekly',
      period_start: '2026-06-22',
      period_end: '2026-06-28',
    };
  });

  it('renders weekly report company and period copy', () => {
    const html = renderToStaticMarkup(
      <ReportHeader workspaceId="workspace-id" reportId="report-id" />,
    );

    expect(html).toContain('SIR Weekly Report');
    expect(html).toContain('테스트기업');
    expect(html).toContain('TST');
    expect(html).toContain('분석 기간');
    expect(html).toContain('2026.06.22 ~ 2026.06.28');
    expect(html).toContain('/report/workspace-id/report-id');
  });

  it('renders daily report date copy and can hide the report link', () => {
    hookState.report = {
      type: 'daily',
      period_start: '2026-07-02',
      period_end: '2026-07-02',
    };

    const html = renderToStaticMarkup(
      <ReportHeader workspaceId="workspace-id" reportId="report-id" showPdfButton={false} />,
    );

    expect(html).toContain('SIR Daily Report');
    expect(html).toContain('분석 일자');
    expect(html).toContain('2026.07.02');
    expect(html).not.toContain('보고서 보기');
  });

  it('renders initial reports as monthly reports', () => {
    hookState.report = {
      type: 'initial',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
    };

    const html = renderToStaticMarkup(
      <ReportHeader workspaceId="workspace-id" reportId="report-id" fullWidth />,
    );

    expect(html).toContain('SIR Monthly Report');
    expect(html).toContain('2026.06.01 ~ 2026.06.30');
  });
});
