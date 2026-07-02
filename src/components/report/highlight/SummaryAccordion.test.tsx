import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SummaryAccordion } from '@/components/report/highlight/SummaryAccordion';
import type { SummarySection } from '@/lib/api/reportApi';

const sections: SummarySection[] = [
  {
    summary: '평판 요약입니다.',
    subsections: [
      {
        title: '긍정 요인',
        points: ['검색량 증가', '긍정 기사 증가'],
      },
    ],
  },
  {
    summary: '채널 요약입니다.',
    subsections: [
      {
        title: '커뮤니티 반응',
        points: ['비판 글 감소'],
      },
    ],
  },
];

describe('SummaryAccordion render', () => {
  it('keeps subsections collapsed by default in interactive report mode', () => {
    const html = renderToStaticMarkup(<SummaryAccordion sections={sections} />);

    expect(html).toContain('평판 요약입니다.');
    expect(html).toContain('채널 요약입니다.');
    expect(html).not.toContain('긍정 요인');
    expect(html).not.toContain('검색량 증가');
  });

  it('renders all subsections in pdf mode', () => {
    const html = renderToStaticMarkup(<SummaryAccordion sections={sections} pdfMode />);

    expect(html).toContain('평판 요약입니다.');
    expect(html).toContain('긍정 요인');
    expect(html).toContain('검색량 증가');
    expect(html).toContain('커뮤니티 반응');
    expect(html).toContain('비판 글 감소');
  });
});
