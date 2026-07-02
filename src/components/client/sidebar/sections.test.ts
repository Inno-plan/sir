import { describe, expect, it, vi } from 'vitest';
import { getClientReportSections } from '@/components/client/sidebar/sections';

vi.mock('@/components/icons/HighlightSidebarIcon', () => ({
  HighlightSidebarIcon: () => null,
}));

vi.mock('@/components/icons/OnlineReputationSidebarIcon', () => ({
  OnlineReputationSidebarIcon: () => null,
}));

vi.mock('@/components/icons/StrategySidebarIcon', () => ({
  StrategySidebarIcon: () => null,
}));

describe('getClientReportSections', () => {
  it('uses daily labels and omits strategy for daily reports', () => {
    const sections = getClientReportSections('daily');

    expect(sections.map((section) => section.id)).toEqual([
      'section-highlight',
      'section-reputation',
    ]);
    expect(sections.map((section) => section.label)).toEqual([
      '일간 하이라이트',
      '기업 평판 분석',
    ]);
  });

  it('keeps strategy for weekly or unknown report types', () => {
    expect(getClientReportSections('weekly').map((section) => section.label)).toEqual([
      '주간 하이라이트',
      '기업 평판 분석',
      '평판 제고 전략 제안',
    ]);
    expect(getClientReportSections(null).map((section) => section.id)).toEqual([
      'section-highlight',
      'section-reputation',
      'section-strategy',
    ]);
  });

  it('uses monthly copy for initial reports while preserving strategy', () => {
    const sections = getClientReportSections('initial');

    expect(sections.map((section) => section.label)).toEqual([
      '월간 하이라이트',
      '기업 평판 분석',
      '평판 제고 전략 제안',
    ]);
  });
});
