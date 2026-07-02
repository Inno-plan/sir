import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StrategyCard } from '@/components/report/strategy/StrategyCard';
import type { StrategyData } from '@/lib/api/reportApi';

const strategy: StrategyData = {
  background: {
    summary: '부정 이슈가 증가했습니다.',
    points: ['커뮤니티 언급량 증가', '부정 키워드 확산'],
  },
  proposal: {
    summary: '팩트 기반 해명 콘텐츠를 발행합니다.',
    actions: [
      {
        platform: 'news',
        topic: '정정 보도',
        contents: ['FAQ 배포', '공식 입장문 배포'],
      },
    ],
  },
};

describe('StrategyCard render', () => {
  it('renders only the proposal summary while closed in interactive report mode', () => {
    const html = renderToStaticMarkup(
      <StrategyCard category="news" label="뉴스" strategy={strategy} />,
    );

    expect(html).toContain('뉴스');
    expect(html).toContain('팩트 기반 해명 콘텐츠를 발행합니다.');
    expect(html).not.toContain('전략 도출 배경');
    expect(html).not.toContain('커뮤니티 언급량 증가');
  });

  it('expands strategy details in pdf mode', () => {
    const html = renderToStaticMarkup(
      <StrategyCard category="news" label="뉴스" strategy={strategy} pdfMode />,
    );

    expect(html).toContain('전략 도출 배경');
    expect(html).toContain('부정 이슈가 증가했습니다.');
    expect(html).toContain('커뮤니티 언급량 증가');
    expect(html).toContain('핵심 전략 제안');
    expect(html).toContain('정정 보도');
    expect(html).toContain('공식 입장문 배포');
  });
});
